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
            viz.instance_id = Math.round(Math.random() * 1000000);
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
                packing: "circle",
                shadow: "show",
                onclick: "none",
                coloroverride: "",
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
                try{ viz.config._coloroverride = JSON.parse(viz.config.coloroverride) } catch(e) {}
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
            // Dont draw unless this is a real element under body
            if (! viz.$container_wrap.parents().is("body")) {
                return;
            }
            if (!(viz.$container_wrap.height() > 0)) {
                return;
            }
            var total = 0;
            for (var i = 0; i < viz.data.rows.length; i++) {
                total += Number(viz.data.rows[i][viz.data.rows[i].length-1]);
            }
            var data;
            var newData = [];
            var mapping = {};
            // Convert splunk tabular data to a heirachy format for d3
            var data = {"name": "root", "children": []};
            var drilldown, i, j, k;
            var skippedRows = 0;
            var validRows = 0;
            for (i = 0; i < viz.data.rows.length; i++) {
                var parts = viz.data.rows[i].slice();
                var size = parts.pop();
                if (size === "" || isNaN(Number(size))) {
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
                        for (var k = 0; k < children.length; k++) {
                            if (children[k].name == nodeName) {
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
                            childNode = {"name": nodeName, color: first_col, drilldown: drilldown, "children": []};
                            children.push(childNode);
                        }
                        currentNode = childNode;
                    } else {
                        drilldown = {};
                        for (k = 0; k < viz.data.rows[i].length - 1; k++) {
                            drilldown[viz.data.fields[k].name] = viz.data.rows[i][k];
                        }
                        // Reached the end of the sequence; create a leaf node.
                        childNode = {"name": nodeName, color: first_col, drilldown: drilldown, "value": size};
                        children.push(childNode);
                    }
                }
            }
            if (skippedRows) {
                console.log("Rows skipped because last column is not numeric: ", skippedRows);
            }
            if (skippedRows && ! validRows) {
                viz.$container_wrap.empty().append("<div class='circlepack_viz-bad_data'>Last column of data must contain numeric values.</div>");
                return;
            }
            function tooltipCreate(d) {
                var parts = d.ancestors().map(d => d.data.name).reverse();
                var tt = $("<div></div>");
                for (var i = 1; i < parts.length; i++) {
                    $("<span></span>").text(parts[i]).appendTo(tt);
                    if (i < (parts.length - 1)) {
                        $("<span class='circlepack_viz-tooltip-divider'> / </span>").appendTo(tt);
                    }
                }
                $("<div></div>").text(format(d.value) + " - " + Math.round(d.value / total * 10000) / 100 + " %").appendTo(tt);
                var clientRectangle = svg_node[0].getBoundingClientRect();
                var clientRectangleWrap = viz.$container_wrap[0].getBoundingClientRect();
                viz.widthOffset = clientRectangle.x - clientRectangleWrap.x;
                return tooltip.css("visibility", "visible").html(tt);
            }
            // move tooltip during mousemove
            function tooltipMove(event) {
                return tooltip.css("top", (event.offsetY - 30) + "px").css("left", (event.offsetX + viz.widthOffset + 20) + "px"); // 
            }
            // hide our tooltip on mouseout
            function tooltiphide() {
                return tooltip.css("visibility", "hidden");
            }

            var svg;
            var labelsize = Number(viz.config.labelsize) / 100 * 16;
            var format = d3.format(",d");
            var height = 800;
            var width = 800 * (viz.$container_wrap.width() / viz.$container_wrap.height());
            var radius, color, arc, partition;
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
            pack = data => d3.pack()
                .size([width - 2, height - 2])
                .padding(5)
            (d3.hierarchy(data)
                .sum(d => d.value)
                .sort(function(a, b) {
                    // If need to add Rectangle packing try adding this
                    // https://observablehq.com/@mbostock/packing-circles-inside-a-rectangle
                    if (viz.config.packing === "circle") { 
                        return b.value - a.value;
                    } else {
                        return 0;
                    }
                }));
            const root = pack(data);
            if (viz.config.colormode === "depth") {
                if (viz.config.color.substr(0,1) === "s") {
                    color = d3.scaleOrdinal(d3[viz.config.color]);
                } else {
                    color = d3.scaleSequential([viz.data.rows[0].length + 1, -3], d3[viz.config.color])
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
            const shadow_id = viz.instance_id + "-" + (viz.instance_id_ctr++);
            svg.append("filter")
                .attr("id", shadow_id)
                .append("feDropShadow")
                .attr("flood-opacity", viz.config.shadow === "show" ? 0.3 : 0)
                .attr("dx", 0)
                .attr("dy", 1);

            if (viz.config.onclick === "zoom") {
                //https://observablehq.com/@d3/zoomable-circle-packing
                let focus = root;
                let view;
                svg /*.style("background", color(0))*/
                    .style("cursor", "pointer")
                    .on("click", () => zoom(root));
                const node = svg.append("g")
                    .selectAll("circle")
                    .data(root.descendants().slice(1))
                    .join("circle")
                        .attr("id", d => (d.leafUid = viz.instance_id + "-" + (viz.instance_id_ctr++)))
                        .attr("filter", "url(#" + shadow_id + ")")
                        .attr("fill", d => { 
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
                                return color(d.parent.data.name)
                            }
                            if (viz.config.colormode === "firstdata") {
                                return color(d.data.color);
                            }
                            if (viz.config.colormode === "firstdatacodes") {
                                return d.data.color;
                            }
                        })
                        .attr("pointer-events", d => !d.children ? "none" : null)
                        .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
                        .on("mouseout", function() { d3.select(this).attr("stroke", null); })
                        .on("click", d => focus !== d && (zoom(d), d3.event.stopPropagation()));
                const label = svg.append("g")
                    .attr("pointer-events", "none")
                    .attr("text-anchor", "middle")
                    .selectAll("text")
                    .data(root.descendants())
                    .join("text")
                        .style("fill-opacity", d => d.parent === root ? 1 : 0)
                        .style("display", d => d.parent === root ? "inline" : "none")
                        .text(d => d.data.name);
                zoomTo([root.x, root.y, root.r * 2]);

                function zoomTo(v) {
                    const k = Math.min(width, height) / v[2];
                    view = v;
                    label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
                    node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
                    node.attr("r", d => d.r * k);
                }
                function zoom(d) {
                    const focus0 = focus;
                    focus = d;
                    const transition = svg.transition()
                        .duration(d3.event.altKey ? 7500 : 750)
                        .tween("zoom", d => {
                            const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                            return t => zoomTo(i(t));
                        });
                    label
                    .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
                    .transition(transition)
                        .style("fill-opacity", d => d.parent === focus ? 1 : 0)
                        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
                        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
                }

            } else {
                // https://observablehq.com/@d3/circle-packing

                const node = svg.selectAll("g")
                    .data(d3.nest().key(d => d.height).entries(root.descendants().slice(1)))
                    .join("g")
                    .attr("filter", "url(#" + shadow_id + ")")
                    .selectAll("g")
                    .data(d => d.values)
                    .join("g")
                    .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`);
                node.append("circle")
                    .attr("r", d => d.r)
                    //.attr("fill-opacity", 0.8)
                    .attr("fill", d => { 
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
                            return color(d.parent.data.name)
                        }
                        if (viz.config.colormode === "firstdata") {
                            return color(d.data.color);
                        }
                        if (viz.config.colormode === "firstdatacodes") {
                            return d.data.color;
                        }
                    });

                const leaf = node.filter(d => !d.children);
                leaf.select("circle")
                    .attr("id", d => (d.leafUid = viz.instance_id + "-" + (viz.instance_id_ctr++)));
                leaf.append("clipPath")
                    .attr("id", d => (d.clipUid = viz.instance_id + "-" + (viz.instance_id_ctr++)))
                    .append("use")
                    .attr("xlink:href", d => "#" + d.leafUid);
                if (viz.config.labels === "show") {
                leaf.append("text")
                    .attr("clip-path", d => "url(#" + d.clipUid + ")")
                    .attr("text-anchor", "middle")
                    .attr("fill", viz.config.labelcolor)
                    .selectAll("tspan")
                    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
                    .join("tspan")
                    .attr("x", 0)
                    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
                    .text(d => d);
                }
                node.on("mouseover", function(d) { tooltipCreate(d); })
                    .on("mousemove", function() { tooltipMove(event); })
                    .on("mouseout", tooltiphide);
                if (viz.config.onclick === "token" || viz.config.onclick === "drilldown") {
                    node.style("cursor", "pointer")
                        .on("click", function(d, browserEvent){
                            if (viz.config.onclick === "token") {
                                var defaultTokenModel = splunkjs.mvc.Components.get('default');
                                var submittedTokenModel = splunkjs.mvc.Components.get('submitted');
                                for (var item in d.data.drilldown) {
                                    if (d.data.drilldown.hasOwnProperty(item)) {
                                        console.log("Setting token $circlepack_viz_" +  item + "$ to", d.data.drilldown[item]);
                                        if (defaultTokenModel) {
                                            defaultTokenModel.set("circlepack_viz_" + item, d.data.drilldown[item]);
                                        } 
                                        if (submittedTokenModel) {
                                            submittedTokenModel.set("circlepack_viz_" + item, d.data.drilldown[item]);
                                        }
                                    }
                                }
                            } else {
                                viz.drilldown({
                                    action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                                    data: d.data.drilldown
                                });
                            }
                        });
                }
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