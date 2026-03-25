# Gaode Geocoding (Web Service API)

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- Geocoding: address -> lon/lat.
- Reverse geocoding: lon/lat -> structured address + POI/AOI (extensions=all).
- Endpoint encoding: UTF-8.
- Requires Web Service API Key.

## Geocoding

Endpoint:
- https://restapi.amap.com/v3/geocode/geo

Required params:
- key: Web Service API Key
- address: structured address string

Optional params:
- city: city name/pinyin/citycode/adcode (limits search)
- output: JSON|XML (default JSON)
- sig, callback

Example:
```
https://restapi.amap.com/v3/geocode/geo?address=北京市朝阳区阜通东大街6号&city=北京&key=<KEY>
```

Response fields:
- status (0/1), count, info, geocodes[]
- geocodes[].location = "lng,lat"
- geocodes[] includes country/province/city/district/street/number/adcode/level

## Reverse Geocoding

Endpoint:
- https://restapi.amap.com/v3/geocode/regeo

Required params:
- key: Web Service API Key
- location: "lng,lat" (<=6 decimals)

Optional params:
- radius (0-3000, default 1000)
- extensions: base|all (default base)
- poitype, roadlevel, homeorcorp, output, sig, callback

Example:
```
https://restapi.amap.com/v3/geocode/regeo?location=116.310003,39.991957&radius=1000&extensions=all&key=<KEY>
```

Response fields:
- status, info, regeocode{}
- regeocode.addressComponent{...}
- roads/roadinters/pois/aois returned when extensions=all

## Notes
- Use Web Service API Key (not JS key).
- City parameter improves precision.
