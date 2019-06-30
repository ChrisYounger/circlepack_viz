![screenshot](https://raw.githubusercontent.com/ChrisYounger/circlepack_viz/master/appserver/static/demo.png)

# Circlepack Viz

Circle packing / Pack layout / bubble chart visualization built with D3.  Optional click-to-zoom and plenty of color themes.

Copyright (C) 2019 Chris Younger. I am a Splunk Professional Services consultant working for JDS Australia, in Brisbane Australia.

[Splunkbase](https://splunkbase.splunk.com/app/4574/#/details) | [Source code](https://github.com/ChrisYounger/circlepack_viz) |  [Questions, Bugs or Suggestions](https://answers.splunk.com/app/questions/4574.html) | [My Splunk apps](https://splunkbase.splunk.com/apps/#/author/chrisyoungerjds)




## Usage
 
This visualisation expects tabular data, with any amount of text/category columns, but the last column must be a numerical value. 

For example, the following data:

|field1|field2|field3|numeric_value|
| --- | --- | --- | --- |
| outer1 | mid1 | node1 | 5 |
| outer1 | mid1 | node2 | 4 |
| outer1 | mid2 | node3 | 9 |
| outer2 | mid3 | node4 | 13 |

Would produce this:
![screenshot](https://raw.githubusercontent.com/ChrisYounger/circlepack_viz/master/appserver/static/example.png)

The typical search uses `stats` command like so:
```
index=* | stats count BY index sourcetype source
```

Sidenote: a much faster search to do the same thing is 
```
|tstats count where index=* BY index sourcetype source
```

Note that `stats` does not return rows when the group BY field is `null`. Convert nulls to be an empty string like this:

```
index=_internal 
| eval component = coalesce(component,"") 
| eval log_level = coalesce(log_level,"") 
| stats count BY sourcetype component log_level
```

Add more fields after the "BY" keyword to increase the depth





## Formatting options

![screenshot](https://raw.githubusercontent.com/ChrisYounger/circlepack_viz/master/appserver/static/formatting.png)

The "Color overrides" field accepts either a JSON object (in curly braces) or comma separated pairs. For example to make sure that "INFO" values are green, WARN's are orange and ERROR's are red, set the value like so: 
```
INFO,#1a9035,ERROR,#b22b32,WARN,#AF5300
``` 

The "Set color by" options "First field.." allow for data to set the color of the leaf node but not affect the grouping. The  "First field as color codes (n/g)" option allows for valid HTML color codes to be passed in from the search. Here is an example search:
```
index=_internal 
| stats sum(count) as count BY log_level component 
| eval color = case(log_level=="ERROR", "#b22b32",log_level=="INFO", "#1a9035",log_level=="WARN", "#AF5300", true(), "blue") 
| table color component count
```

Note that when using "Click action" of "Zoom in" the labels are not clipped and will probably overlap.





## Third party software

The following third-party libraries are used by this app. Thank you!

* jQuery - MIT - https://jquery.com/
* D3 - BSD 3-Clause - https://d3js.org/
* Font Awesome - Creative Commons Attribution-ShareAlike 4.0 License - https://fontawesome.com/

