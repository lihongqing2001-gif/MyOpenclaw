# Gaode Routing (Web Service API)

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- HTTP/HTTPS route planning APIs (walking, transit, driving, bicycling) and distance.
- Response JSON/XML, UTF-8.
- Results may vary over time due to data/road changes.
- Requires Web Service API Key.

## Walking
Endpoint:
- https://restapi.amap.com/v3/direction/walking

Required params:
- key
- origin: lon,lat
- destination: lon,lat

Optional:
- origin_id, destination_id, output, sig, callback

Example:
```
https://restapi.amap.com/v3/direction/walking?origin=116.434307,39.90909&destination=116.434446,39.90816&key=<KEY>
```

Key fields:
- route.paths[].distance (m), duration (s), steps[].instruction, polyline, action, assistant_action, walk_type

## Transit (Public Transit)
Endpoint:
- https://restapi.amap.com/v3/direction/transit/integrated

Required params:
- key
- origin: lon,lat
- destination: lon,lat
- city: city name/citycode

Optional:
- cityd (cross-city), extensions=base|all, strategy, nightflag, date, time, output, sig, callback

Example:
```
https://restapi.amap.com/v3/direction/transit/integrated?origin=116.481499,39.990475&destination=116.465063,39.999538&city=010&key=<KEY>
```

Key fields:
- route.transits[].duration, cost, walking_distance, segments[] (walking/bus/entrance/exit/railway)

## Driving
Endpoint:
- https://restapi.amap.com/v3/direction/driving

Required params:
- key
- origin: lon,lat (or multiple points for heading)
- destination: lon,lat

Optional:
- strategy (0-20), waypoints (max 16), avoidpolygons, province/number (license), cartype, ferry, roadaggregation, nosteps, extensions=base|all

Example:
```
https://restapi.amap.com/v3/direction/driving?origin=116.481028,39.989643&destination=116.465302,40.004717&extensions=all&key=<KEY>
```

Key fields:
- route.paths[].distance, duration, tolls, restriction, steps[].instruction, polyline, tmcs

## Bicycling
Endpoint:
- https://restapi.amap.com/v4/direction/bicycling

Required params:
- key
- origin: lon,lat
- destination: lon,lat

Example:
```
https://restapi.amap.com/v4/direction/bicycling?origin=116.434307,39.90909&destination=116.434446,39.90816&key=<KEY>
```

Key fields:
- data.paths[].distance, duration, steps[].instruction, polyline, action, assistant_action

## Distance
Endpoint:
- https://restapi.amap.com/v3/distance

Required params:
- key
- origins: lon,lat|lon,lat (up to 100)
- destination: lon,lat

Optional:
- type: 0 (straight), 1 (driving), 3 (walking)

Example:
```
https://restapi.amap.com/v3/distance?origins=116.481028,39.989643|114.481028,39.989643&destination=114.465302,40.004717&key=<KEY>
```

Key fields:
- results[].distance (m), duration (s)
