# Gaode Coordinate Convert

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- Converts non-AMap coordinates to AMap coordinates.
- Supports gps/mapbar/baidu/autonavi.
- UTF-8, JSON/XML, Web Service API Key required.

## Endpoint
- https://restapi.amap.com/v3/assistant/coordinate/convert

## Required params
- key
- locations: lon,lat|lon,lat (max 40 pairs)

## Optional params
- coordsys: gps|mapbar|baidu|autonavi (default autonavi)
- output: JSON|XML
- sig

## Example
```
https://restapi.amap.com/v3/assistant/coordinate/convert?locations=116.481499,39.990475|116.481499,39.990375&coordsys=gps&key=<KEY>
```

## Key response fields
- status, info, locations (converted; separated by ";")
