# Gaode Routing v5 (Web Service API 2.0)

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- Web API v5 for driving/walking/bicycling/electrobike/transit.
- UTF-8, JSON only.
- Web Service API Key required.

## Driving
Endpoint:
- https://restapi.amap.com/v5/direction/driving

Required params:
- key
- origin: lon,lat
- destination: lon,lat

Optional:
- strategy (32 default; 33 avoid congestion; 34 highway; 35 no highway; 36 low toll; 37 main road; 38 fastest; 39/40/41/42/43/44/45 combos)
- waypoints (up to 16)
- avoidpolygons (up to 32)
- plate, cartype (0/1/2), ferry
- show_fields (filter response), output=json

Example:
```
https://restapi.amap.com/v5/direction/driving?origin=116.434307,39.90909&destination=116.434446,39.90816&key=<KEY>
```

Key response fields:
- status, info, infocode, count
- route.paths[].distance, steps[].instruction, steps[].road_name, steps[].step_distance
- optional via show_fields: cost(duration,tolls,toll_distance,traffic_lights), tmcs, navi(action,assistant_action), cities, polyline

## Walking
Endpoint:
- https://restapi.amap.com/v5/direction/walking

Required params:
- key, origin, destination

Optional:
- alternative_route (1-3)
- show_fields
- isindoor (0/1)

Example:
```
https://restapi.amap.com/v5/direction/walking?origin=116.466485,39.995197&destination=116.46424,40.020642&key=<KEY>
```

Key response fields:
- route.paths[].distance, steps[].instruction, steps[].road_name, steps[].step_distance
- optional via show_fields: cost(duration,taxi), navi(action,assistant_action), walk_type, polyline

## Bicycling
Endpoint:
- https://restapi.amap.com/v5/direction/bicycling

Required params:
- key, origin, destination

Optional:
- alternative_route (1-3)
- show_fields

Example:
```
https://restapi.amap.com/v5/direction/bicycling?origin=116.466485,39.995197&destination=116.46424,40.020642&key=<KEY>
```

Key response fields:
- route.paths[].distance, steps[].instruction, steps[].road_name, steps[].step_distance
- optional via show_fields: cost(duration), navi(action,assistant_action), walk_type, polyline

## Electrobike
Endpoint:
- https://restapi.amap.com/v5/direction/electrobike

Required params:
- key, origin, destination

Optional:
- alternative_route (1-3)
- show_fields

Example:
```
https://restapi.amap.com/v5/direction/electrobike?origin=116.466485,39.995197&destination=116.46424,40.020642&key=<KEY>
```

## Transit (Integrated)
Endpoint:
- https://restapi.amap.com/v5/direction/transit/integrated

Required params:
- key, origin, destination, city1, city2

Optional:
- originpoi/destinationpoi (paired)
- ad1/ad2, strategy (0-8), AlternativeRoute (1-10)
- multiexport, nightflag, date/time
- show_fields

Example:
```
https://restapi.amap.com/v5/direction/transit/integrated?origin=116.466485,39.995197&destination=116.46424,40.020642&city1=010&city2=010&key=<KEY>
```

Key response fields:
- route.transits[].distance, segments(walking/bus/railway/taxi)
- optional via show_fields: cost(duration,taxi_fee,transit_fee), navi(action,assistant_action), walk_type, polyline
