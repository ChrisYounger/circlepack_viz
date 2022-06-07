[1mdiff --git a/appserver/static/visualizations/circlepack_viz/src/visualization_source.js b/appserver/static/visualizations/circlepack_viz/src/visualization_source.js[m
[1mindex 890aff5..f53f958 100644[m
[1m--- a/appserver/static/visualizations/circlepack_viz/src/visualization_source.js[m
[1m+++ b/appserver/static/visualizations/circlepack_viz/src/visualization_source.js[m
[36m@@ -135,6 +135,7 @@[m [mfunction([m
                     })[m
                 );[m
             }[m
[32m+[m
             // Dont draw unless this is a real element under body[m
             if (! viz.$container_wrap.parents().is("body")) {[m
                 return;[m
[36m@@ -180,7 +181,7 @@[m [mfunction([m
                         // Not yet at the end of the sequence; move down the tree.[m
                         var foundChild = false;[m
                         for (k = 0; k < children.length; k++) {[m
[31m-                            if (children[k].name == nodeName) {[m
[32m+[m[32m                            if (children[k].name == nodeName && typeof children[k].children !== "undefined") {[m
                                 childNode = children[k];[m
                                 foundChild = true;[m
                                 break;[m
[36m@@ -234,6 +235,8 @@[m [mfunction([m
             if (viz.config.onclick === "zoom") {[m
                 svg.attr("viewBox", [-0.5 * width, -0.5 * height, width, height]);[m
             } else {[m
[32m+[m[32m                // width = width / 1.5[m
[32m+[m[32m                // height = height / 1.5[m
                 svg.attr("viewBox", [0, 0, width, height]);[m
             }[m
             viz.$container_wrap.empty().append(svg.node());[m
[36m@@ -344,12 +347,14 @@[m [mfunction([m
                     .data(d3.nest().key(function(d) { return d.height; }).entries(root.descendants().slice(1)))[m
                     .join("g")[m
                     .attr("filter", "url(#" + shadow_id + ")")[m
[31m-                    .selectAll("g")[m
[32m+[m[32m                    .selectAll("circle")[m
                     .data(function(d) { return d.values; })[m
[31m-                    .join("g")[m
[31m-                    .attr("transform", function(d) { return "translate(" + (d.x + 1) +"," + (d.y + 1) + ")"; });[m
[31m-                node.append("circle")[m
[31m-                    .attr("r", function(d) { return d.r; })[m
[32m+[m[32m                    .join("circle")[m
[32m+[m[32m                    //.attr("transform", function(d) { return "translate(" + (d.x + 1) +"," + (d.y + 1) + ")"; });[m
[32m+[m[32m                    .attr("cx", function(d) { return d.x + 1; })[m
[32m+[m[32m                    .attr("cy", function(d) { return d.y + 1; })[m
[32m+[m[32m                //node.append("circle")[m
[32m+[m[32m                    .attr("r", function(d) { d.r = d.r * 1.5; return d.r; })[m
                     .attr("id", function(d) {[m
                         d.leafUid = viz.instance_id + "-" + (viz.instance_id_ctr++);[m
                         return d.leafUid;[m
[36m@@ -457,6 +462,34 @@[m [mfunction([m
                         .attr("y", function(d, i, nodes) { return (i - nodes.length / 2 + 0.8) + "em"; })[m
                         .text(function(d) { return d; });[m
             }[m
[32m+[m[32m// constants used in the simulation[m
[32m+[m
[32m+[m[32mvar center = {x: width / 2, y: height / 2};[m
[32m+[m[32mvar forceStrength = 0.3[m
[32m+[m[32mvar simulation = d3.forceSimulation()[m
[32m+[m[32m    .velocityDecay(0.2)[m
[32m+[m[32m    .force('x', d3.forceX().strength(forceStrength * (height / width)).x(center.x))[m
[32m+[m[32m    .force('y', d3.forceY().strength(forceStrength * (width / height)).y(center.y))[m
[32m+[m[32m    //.force('charge', d3.forceManyBody().strength(function(d) {[m
[32m+[m[32m        //console.log("charge:", d);[m
[32m+[m[32m        // this is how hard the item repel each other[m
[32m+[m[32m    //    return -0.01 * Math.pow(d.r, 2);[m
[32m+[m[32m    //}))[m
[32m+[m[32m    .on('tick', function() {[m
[32m+[m[32m        console.log("tick2");[m
[32m+[m[32m        node[m
[32m+[m[32m        .attr("cx", function(d) { return (d.x + 1); })[m
[32m+[m[32m        .attr("cy", function(d) { return (d.y + 1); });[m
[32m+[m[32m    });[m
[32m+[m[32m//simulation.stop();[m
[32m+[m[32m    simulation[m
[32m+[m[32m    .nodes(root.descendants().filter(function(d){[m
[32m+[m[32m        return d.depth == 1;[m
[32m+[m[32m    }))[m
[32m+[m[32m    .force("collide", d3.forceCollide().strength(0.6).radius(function(d){ return d.r + 20; }).iterations(1));[m
[32m+[m
[32m+[m
[32m+[m
         },[m
 [m
         // Override to respond to re-sizing events[m
[1mdiff --git a/appserver/static/visualizations/circlepack_viz/visualization.js b/appserver/static/visualizations/circlepack_viz/visualization.js[m
[1mindex 672aa23..95c1fd8 100644[m
[1m--- a/appserver/static/visualizations/circlepack_viz/visualization.js[m
[1m+++ b/appserver/static/visualizations/circlepack_viz/visualization.js[m
[36m@@ -180,6 +180,7 @@[m [mdefine(["api/SplunkVisualizationBase","api/SplunkVisualizationUtils"], function([m
 	                    })[m
 	                );[m
 	            }[m
[32m+[m
 	            // Dont draw unless this is a real element under body[m
 	            if (! viz.$container_wrap.parents().is("body")) {[m
 	                return;[m
[36m@@ -225,7 +226,7 @@[m [mdefine(["api/SplunkVisualizationBase","api/SplunkVisualizationUtils"], function([m
 	                        // Not yet at the end of the sequence; move down the tree.[m
 	                        var foundChild = false;[m
 	                        for (k = 0; k < children.length; k++) {[m
[31m-	                            if (children[k].name == nodeName) {[m
[32m+[m	[32m                            if (children[k].name == nodeName && typeof children[k].children !== "undefined") {[m
 	                                childNode = children[k];[m
 	                                foundChild = true;[m
 	                                break;[m
[36m@@ -279,6 +280,8 @@[m [mdefine(["api/SplunkVisualizationBase","api/SplunkVisualizationUtils"], function([m
 	            if (viz.config.onclick === "zoom") {[m
 	                svg.attr("viewBox", [-0.5 * width, -0.5 * height, width, height]);[m
 	            } else {[m
[32m+[m	[32m                // width = width / 1.5[m
[32m+[m	[32m                // height = height / 1.5[m
 	                svg.attr("viewBox", [0, 0, width, height]);[m
 	            }[m
 	            viz.$container_wrap.empty().append(svg.node());[m
[36m@@ -389,12 +392,14 @@[m [mdefine(["api/SplunkVisualizationBase","api/SplunkVisualizationUtils"], function([m
 	                    .data(d3.nest().key(function(d) { return d.height; }).entries(root.descendants().slice(1)))[m
 	                    .join("g")[m
 	                    .attr("filter", "url(#" + shadow_id + ")")[m
[31m-	                    .selectAll("g")[m
[32m+[m	[32m                    .selectAll("circle")[m
 	                    .data(function(d) { return d.values; })[m
[31m-	                    .join("g")[m
[31m-	                    .attr("transform", function(d) { return "translate(" + (d.x + 1) +"," + (d.y + 1) + ")"; });[m
[31m-	                node.append("circle")[m
[31m-	                    .attr("r", function(d) { return d.r; })[m
[32m+[m	[32m                    .join("circle")[m
[32m+[m	[32m                    //.attr("transform", function(d) { return "translate(" + (d.x + 1) +"," + (d.y + 1) + ")"; });[m
[32m+[m	[32m                    .attr("cx", function(d) { return d.x + 1; })[m
[32m+[m	[32m                    .attr("cy", function(d) { return d.y + 1; })[m
[32m+[m	[32m                //node.append("circle")[m
[32m+[m	[32m                    .attr("r", function(d) { d.r = d.r * 1.5; return d.r; })[m
 	                    .attr("id", function(d) {[m
 	                        d.leafUid = viz.instance_id + "-" + (viz.instance_id_ctr++);[m
 	                        return d.leafUid;[m
[36m@@ -502,6 +507,34 @@[m [mdefine(["api/SplunkVisualizationBase","api/SplunkVisualizationUtils"], function([m
 	                        .attr("y", function(d, i, nodes) { return (i - nodes.length / 2 + 0.8) + "em"; })[m
 	                        .text(function(d) { return d; });[m
 	            }[m
[32m+[m	[32m// constants used in the simulation[m
[32m+[m
[32m+[m	[32mvar center = {x: width / 2, y: height / 2};[m
[32m+[m	[32mvar forceStrength = 0.3[m
[32m+[m	[32mvar simulation = d3.forceSimulation()[m
[32m+[m	[32m    .velocityDecay(0.2)[m
[32m+[m	[32m    .force('x', d3.forceX().strength(forceStrength * (height / width)).x(center.x))[m
[32m+[m	[32m    .force('y', d3.forceY().strength(forceStrength * (width / height)).y(center.y))[m
[32m+[m	[32m    //.force('charge', d3.forceManyBody().strength(function(d) {[m
[32m+[m	[32m        //console.log("charge:", d);[m
[32m+[m	[32m        // this is how hard the item repel each other[m
[32m+[m	[32m    //    return -0.01 * Math.pow(d.r, 2);[m
[32m+[m	[32m    //}))[m
[32m+[m	[32m    .on('tick', function() {[m
[32m+[m	[32m        console.log("tick2");[m
[32m+[m	[32m        node[m
[32m+[m	[32m        .attr("cx", function(d) { return (d.x + 1); })[m
[32m+[m	[32m        .attr("cy", function(d) { return (d.y + 1); });[m
[32m+[m	[32m    });[m
[32m+[m	[32m//simulation.stop();[m
[32m+[m	[32m    simulation[m
[32m+[m	[32m    .nodes(root.descendants().filter(function(d){[m
[32m+[m	[32m        return d.depth == 1;[m
[32m+[m	[32m    }))[m
[32m+[m	[32m    .force("collide", d3.forceCollide().strength(0.6).radius(function(d){ return d.r + 20; }).iterations(1));[m
[32m+[m
[32m+[m
[32m+[m
 	        },[m
 [m
 	        // Override to respond to re-sizing events[m
