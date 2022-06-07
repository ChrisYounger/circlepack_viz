define([
    'api/SplunkVisualizationBase',
    'api/SplunkVisualizationUtils',
    'jquery',
    'd3'
],
function(
    SplunkVisualizationBase,
    vizUtils,
    $,
    d3
) {
    var vizObj = {
        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            var viz = this;
            viz.instance_id = "circlepack_viz_" + Math.round(Math.random() * 1000000);
            viz.instance_id_ctr = 0;
            var theme = 'light'; 
            if (typeof vizUtils.getCurrentTheme === "function") {
                theme = vizUtils.getCurrentTheme();
            }
            viz.$container_wrap = $(viz.el);
            viz.$container_wrap.addClass("circlepack_viz-container");
        },

        formatData: function(data) {
            return data;
        },

        updateView: function(data, config) {
            var viz = this;
            viz.config = {
                labels: "show",
                labelsize: "100",
                colormode: "depth",
                labelcolor: "#000000",
                labelwrap: "on",
                labeltruncate: "on",
                packing: "circle",
                shadow: "show",
                onclick: "none",
                maxrows: "1500",
                coloroverride: "",
                nulltoken: "",
                color: "schemeCategory10"
            };
            // Override defaults with selected items from the UI
            for (var opt in config) {
                if (config.hasOwnProperty(opt)) {
                    viz.config[ opt.replace(viz.getPropertyNamespaceInfo().propertyNamespace,'') ] = config[opt];
                }
            }
            viz.config._coloroverride = {};
            if (viz.config.coloroverride.substr(0,1) === "{") {
                try{ viz.config._coloroverride = JSON.parse(viz.config.coloroverride); } catch(e) {}
            } else {
                var parts = viz.config.coloroverride.split(",");
                for (var i = 0; i+1 < parts.length; i+=2) {
                    viz.config._coloroverride[parts[i]] = parts[i+1];
                }
            }
            viz.data = data;
            viz.scheduleDraw();
        },

        // debounce the draw
        scheduleDraw: function(){
            var viz = this;
            clearTimeout(viz.drawtimeout);
            viz.drawtimeout = setTimeout(function(){
                viz.doDraw();
            }, 300);
        },

        doDraw: function(){
            var viz = this;
            function tooltipCreate(d) {
                var parts = d.ancestors().map(function(d) { return d.data.name; }).reverse();
                var tt = $("<div></div>");
                for (var i = 1; i < parts.length; i++) {
                    $("<span></span>").text(parts[i]).appendTo(tt);
                    if (i < (parts.length - 1)) {
                        $("<span class='circlepack_viz-tooltip-divider'> / </span>").appendTo(tt);
                    }
                }
                $("<div></div>").text(format(d.value) + " - " + Math.round(d.value / total * 10000) / 100 + " %").appendTo(tt);
                viz.container_wrap_offset = viz.$container_wrap.offset();
                return tooltip.css("visibility", "visible").html(tt);
            }
            // move tooltip during mousemove
            function tooltipMove(event) {
                return tooltip.css({"top": (event.pageY - viz.container_wrap_offset.top - 30) + "px", "left": (event.pageX - viz.container_wrap_offset.left + 20) + "px"});
            }
            // hide our tooltip on mouseout
            function tooltiphide() {
                return tooltip.css("visibility", "hidden");
            }
            function zoomTo(v) {
                var k = Math.min(width, height) / v[2];
                view = v;
                label.attr("transform", function(d) { return "translate(" + ((d.x - v[0]) * k) + "," + ((d.y - v[1]) * k) + ")"; });
                node.attr("transform", function(d) { return "translate(" + ((d.x - v[0]) * k) + "," + ((d.y - v[1]) * k) +")"; });
                node.attr("r", function(d) { return d.r * k; });
            }
            function zoom(d) {
                focus = d;
                var transition = svg.transition()
                    .duration(d3.event.altKey ? 7500 : 750)
                    .tween("zoom", function(d) {
                        var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                        return function(t) { zoomTo(i(t)); };
                    });
                label
                .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
                .transition(transition)
                    .style("fill-opacity", function(d) { return d.parent === focus ? 1 : 0; })
                    .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
                    .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
            }
            function pack(data) { 
                return d3.pack()
                    .size([width - 2, height - 2])
                    .padding(5)
                (d3.hierarchy(data)
                    .sum(function(d) { return d.value; })
                    .sort(function(a, b) {
                        // If need to add Rectangle packing try adding this
                        // https://observablehq.com/@mbostock/packing-circles-inside-a-rectangle
                        if (viz.config.packing === "circle") { 
                            return b.value - a.value;
                        } else {
                            return 0;
                        }
                    })
                );
            }
            // Dont draw unless this is a real element under body
            if (! viz.$container_wrap.parents().is("body")) {
                return;
            }
            if (!(viz.$container_wrap.height() > 0)) {
                return;
            }
            var total = 0;
            for (var l = 0; l < viz.data.rows.length; l++) {
                total += Number(viz.data.rows[l][viz.data.rows[l].length-1]);
            }
            viz.valueFieldName = "";
            if (viz.data.fields.length > 1) {
                viz.valueFieldName = viz.data.fields[viz.data.fields.length-1].name;
            }
            // Convert splunk tabular data to a heirachy format for d3
            var data = {"name": "root", "children": []};
            var drilldown, i, j, k;
            var skippedRows = 0;
            var validRows = 0;
            for (i = 0; i < viz.data.rows.length; i++) {
                var parts = viz.data.rows[i].slice();
                var nodesize = parts.pop();
                if (nodesize === "" || nodesize === null || isNaN(Number(nodesize))) {
                    skippedRows++;
                    continue;
                } else {
                    validRows++;
                }
                while (parts[parts.length-1] === null || parts[parts.length-1] === "") {
                    parts.pop();
                }
                var first_col = null;
                if (viz.config.colormode.substr(0,9) === "firstdata") {
                    first_col = parts.shift();
                }
                var currentNode = data;
                for (j = 0; j < parts.length; j++) {
                    var children = currentNode.children;
                    var nodeName = parts[j];
                    var childNode;
                    if (j + 1 < parts.length) {
                        // Not yet at the end of the sequence; move down the tree.
                        var foundChild = false;
                        for (k = 0; k < children.length; k++) {
                            if (children[k].name == nodeName && typeof children[k].children !== "undefined") {
                                childNode = children[k];
                                foundChild = true;
                                break;
                            }
                        }
                        // If we don't already have a child node for this branch, create it.
                        if (!foundChild) {
                            drilldown = {};
                            for (k = 0; k <= j; k++) {
                                drilldown[viz.data.fields[k].name] = viz.data.rows[i][k];
                            }
                            childNode = {"name": nodeName, "color": first_col, "drilldown": drilldown, "children": []};
                            children.push(childNode);
                        }
                        currentNode = childNode;
                    } else {
                        drilldown = {};
                        for (k = 0; k < viz.data.rows[i].length - 1; k++) {
                            drilldown[viz.data.fields[k].name] = viz.data.rows[i][k];
                        }
                        // Reached the end of the sequence; create a leaf node.
                        childNode = {"name": nodeName, "color": first_col, "drilldown": drilldown, "value": nodesize};
                        children.push(childNode);
                    }
                }
            }
            if (skippedRows) {
                console.log("Rows skipped because last column is not numeric: ", skippedRows);
            }
            if (skippedRows && ! validRows) {
                viz.$container_wrap.empty().append("<div class='circlepack_viz-bad_data'>Last column of data must contain numeric values.<br /><a href='/app/circlepack_viz/documentation' target='_blank'>Examples and Documentation</a></div>");
                return;
            }
            if (viz.data.fields.length <= 1) {
                viz.$container_wrap.empty().append("<div class='circlepack_viz-bad_data'>There must be at least 1 column of labels.<br /><a href='/app/circlepack_viz/documentation' target='_blank'>Examples and Documentation</a></div>");
                return;
            }
            if (validRows > Number(viz.config.maxrows)) {
                viz.$container_wrap.empty().append("<div class='circlepack_viz-bad_data'>Too many rows of data.  Increase limit in formatting settings. (Total rows:" + validRows + ", Limit: " + viz.config.maxrows + "). </div>");
                return;
            }
            var svg;
            var labelsize = Number(viz.config.labelsize) / 100 * 16;
            var format = d3.format(",d");
            var height = 800;
            var width = 800 * (viz.$container_wrap.width() / viz.$container_wrap.height());
            var color;
            svg = d3.create("svg")
                .style("font", labelsize + "px sans-serif")
                .style("box-sizing", "border-box");
            if (viz.config.onclick === "zoom") {
                svg.attr("viewBox", [-0.5 * width, -0.5 * height, width, height]);
            } else {
                svg.attr("viewBox", [0, 0, width, height]);
            }
            viz.$container_wrap.empty().append(svg.node());
            var svg_node = viz.$container_wrap.children();
            var size = Math.min(viz.$container_wrap.height(),viz.$container_wrap.width());
            svg.attr("width", (viz.$container_wrap.width() - 20) + "px").attr("height", (viz.$container_wrap.height() - 20) + "px");
            var tooltip = $("<div class='circlepack_viz-tooltip'></div>");
            viz.$container_wrap.append(tooltip);
            var root = pack(data);
            if (viz.config.colormode === "depth") {
                if (viz.config.color.substr(0,1) === "s") {
                    color = d3.scaleOrdinal(d3[viz.config.color]);
                } else {
                    color = d3.scaleSequential([viz.data.rows[0].length + 1, -3], d3[viz.config.color]);
                }
            } else if (viz.config.colormode === "size") {
                if (viz.config.color.substr(0,1) === "s") {
                    // There isn't ideal becuase the ordinal scale isnt spread across the full range of sizes
                    color = d3.scaleOrdinal(d3[viz.config.color]);
                } else {
                    // do some scale trickery to get the colors to look best
                    color = d3.scaleSequentialPow([ -1 * Number(root.value) / 8, Number(root.value) / 4], d3[viz.config.color]).clamp(true);
                }
            // name, parent, firstdata, firstdatacodes
            } else {
                if (viz.config.color.substr(0,1) === "s") {
                    color = d3.scaleOrdinal(d3[viz.config.color]);
                } else {
                    color = d3.scaleOrdinal(d3.quantize(d3[viz.config.color], 20 + 1));
                }
            }
            var shadow_id = viz.instance_id + "_" + (viz.instance_id_ctr++);
            // This doesnt work in IE11 and Edge: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/18760697/
            //var filter = svg.append("filter").attr("id", shadow_id).append("feDropShadow").attr("flood-opacity", viz.config.shadow === "show" ? 0.3 : 0).attr("dx", 0).attr("dy", 1);
            var defs = svg.append("defs");
            // height=120% so that the shadow is not clipped
            var filter = defs.append("filter").attr("id", shadow_id).attr("height", "120%");
            // From: http://bl.ocks.org/cpbotha/raw/5200394/dropshadow.js with tweaks.
            filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 2).attr("result", shadow_id + "A");
            filter.append("feColorMatrix").attr("in", shadow_id + "A").attr("type","matrix").attr("values", "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 " + (viz.config.shadow === "show" ? 0.35 : 0) + " 0").attr("result", shadow_id + "B");
            filter.append("feOffset").attr("in", shadow_id + "B").attr("dx", 0).attr("dy", 1).attr("result", shadow_id + "C");
            var feMerge = filter.append("feMerge");
            feMerge.append("feMergeNode").attr("in", shadow_id + "C")
            feMerge.append("feMergeNode").attr("in", "SourceGraphic");

            var focus = root;
            var node, label, view;
            if (viz.config.onclick === "zoom") {
                //https://observablehq.com/@d3/zoomable-circle-packing
                svg /*.style("background", color(0))*/
                    .style("cursor", "pointer")
                    .on("click", function() { zoom(root); });
                node = svg.append("g")
                    .selectAll("circle")
                    .data(root.descendants().slice(1))
                    .join("circle")
                        .attr("id", function(d) { 
                            d.leafUid = viz.instance_id + "-" + (viz.instance_id_ctr++);
                            return (d.leafUid);
                        })
                        .attr("filter", "url(#" + shadow_id + ")")
                        .attr("fill", function(d) { 
                            if (viz.config._coloroverride.hasOwnProperty(d.data.name)) {
                                return viz.config._coloroverride[d.data.name];
                            }
                            if (viz.config.colormode === "depth") {
                                return color(d.height);
                            }
                            if (viz.config.colormode === "size") {
                                return color(Number(d.value));
                            }
                            if (viz.config.colormode === "name") {
                                return color(d.data.name);
                            }
                            if (viz.config.colormode === "parent") {
                                return color(d.parent.data.name);
                            }
                            if (viz.config.colormode === "firstdata") {
                                return color(d.data.color);
                            }
                            if (viz.config.colormode === "firstdatacodes") {
                                if (d.hasOwnProperty("children")) {
                                    return color(d.data.color);
                                }
                                return d.data.color;
                            }
                        })
                        .attr("pointer-events", function(d) { return !d.children ? "none" : null;})
                        .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
                        .on("mouseout", function() { d3.select(this).attr("stroke", null); })
                        .on("click", function(d) { return focus !== d && (zoom(d), d3.event.stopPropagation()); });
                label = svg.append("g")
                    .attr("pointer-events", "none")
                    .attr("text-anchor", "middle")
                    .selectAll("text")
                    .data(root.descendants())
                    .join("text")
                        .attr("fill", viz.config.labelcolor)
                        .style("fill-opacity", function(d) { return d.parent === root ? 1 : 0;})
                        .style("display", function(d) { return d.parent === root ? "inline" : "none";})
                        .text(function(d) { return d.data.name;});
                zoomTo([root.x, root.y, root.r * 2]);

            } else {
                // https://observablehq.com/@d3/circle-packing

                node = svg.selectAll("g")
                    .data(d3.nest().key(function(d) { return d.height; }).entries(root.descendants().slice(1)))
                    .join("g")
                    .attr("filter", "url(#" + shadow_id + ")")
                    .selectAll("g")
                    .data(function(d) { return d.values; })
                    .join("g")
                    .attr("transform", function(d) { return "translate(" + (d.x + 1) +"," + (d.y + 1) + ")"; });
                node.append("circle")
                    .attr("r", function(d) { return d.r; })
                    .attr("id", function(d) {
                        d.leafUid = viz.instance_id + "-" + (viz.instance_id_ctr++);
                        return d.leafUid;
                    })
                    //.attr("fill-opacity", 0.8)
                    .attr("fill", function(d) { 
                        if (viz.config._coloroverride.hasOwnProperty(d.data.name)) {
                            return viz.config._coloroverride[d.data.name];
                        }
                        if (viz.config.colormode === "depth") {
                            return color(d.height);
                        }
                        if (viz.config.colormode === "size") {
                            return color(Number(d.value));
                        }
                        if (viz.config.colormode === "name") {
                            return color(d.data.name);
                        }
                        if (viz.config.colormode === "parent") {
                            return color(d.parent.data.name);
                        }
                        if (viz.config.colormode === "firstdata") {
                            return color(d.data.color);
                        }
                        if (viz.config.colormode === "firstdatacodes") {
                            if (d.hasOwnProperty("children")) {
                                return color(d.data.color);
                            }
                            return d.data.color;
                        }
                    });

                node.on("mouseover", function(d) { tooltipCreate(d); })
                    .on("mousemove", function() { tooltipMove(event); })
                    .on("mouseout", tooltiphide);
                if (viz.config.onclick === "token" || viz.config.onclick === "drilldown") {
                    node.style("cursor", "pointer")
                        .on("click", function(d){
                            var defaultTokenModel = splunkjs.mvc.Components.get('default');
                            var submittedTokenModel = splunkjs.mvc.Components.get('submitted');
                            var drilldown_obj = {};
                            for (var i = 0; i < viz.data.fields.length; i++) {
                                if (viz.valueFieldName !== viz.data.fields[i].name) {
                                    var tokenName = "circlepack_viz_" + viz.data.fields[i].name;
                                    if (d.data.drilldown.hasOwnProperty(viz.data.fields[i].name)) {
                                        drilldown_obj[tokenName] = d.data.drilldown[viz.data.fields[i].name];
                                    } else {
                                        drilldown_obj[tokenName] = viz.config.nulltoken;
                                    }
                                    console.log("Setting token $" +  tokenName + "$ to", drilldown_obj[tokenName]);
                                    if (defaultTokenModel) {
                                        defaultTokenModel.set(tokenName, drilldown_obj[tokenName]);
                                    }
                                    if (submittedTokenModel) {
                                        submittedTokenModel.set(tokenName, drilldown_obj[tokenName]);
                                    }
                                }
                            }
                            viz.drilldown({
                                action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                                data: drilldown_obj
                            }, event);
                        });
                }
                var tt_data = root.descendants().filter(function(d){
                    if (viz.config.labels === "show") {
                        return !d.children;
                    } else if (viz.config.labels === "show1") {
                        return d.depth == 1;
                    } else if (viz.config.labels === "show2") {
                        return d.depth == 2;
                    } else if (viz.config.labels === "show3") {
                        return d.depth == 3;
                    } else if (viz.config.labels === "show4") {
                        return d.depth == 4;
                    } else if (viz.config.labels === "show5") {
                        return d.depth == 5;
                    }
                    return false;
                });
                var leaf = svg.append("g");
                if (viz.config.labeltruncate === "on") {
                    leaf.selectAll("clipPath")
                        .data(tt_data)
                        .join("clipPath")
                        .attr("id", function(d)  {
                            d.clipUid = viz.instance_id + "-" + (viz.instance_id_ctr++);
                            return d.clipUid;
                        })
                        .append("use")
                        .attr("xlink:href", function(d) { return "#" + d.leafUid; });
                }
                leaf.selectAll("text")
                    .data(tt_data)
                    .join("text")
                        .attr("pointer-events", "none")
                        .attr("transform", function(d) { return "translate(" + (d.x + 1) + "," + (d.y + 1) + ")";})
                        .attr("clip-path", function(d) { return d.hasOwnProperty("clipUid") ? "url(#" + d.clipUid + ")" : ""; })
                        .attr("text-anchor", "middle")
                        .attr("fill", viz.config.labelcolor)
                    .selectAll("tspan")
                        .data(function(d) { if (viz.config.labelwrap === "on") { return d.data.name.split(/(?=[A-Z][^A-Z])/g); } else { return [d.data.name]; }} )
                        .join("tspan")
                        .attr("x", 0)
                        .attr("y", function(d, i, nodes) { return (i - nodes.length / 2 + 0.8) + "em"; })
                        .text(function(d) { return d; });
            }
        },

        // Override to respond to re-sizing events
        reflow: function() {
            this.scheduleDraw();
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            });
        },
    };
    return SplunkVisualizationBase.extend(vizObj);
});