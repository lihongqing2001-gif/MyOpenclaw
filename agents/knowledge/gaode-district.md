# Gaode District (Administrative District)

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- Administrative district lookup by keyword (name/citycode/adcode).
- UTF-8, JSON/XML, Web Service API Key required.
- Some cities have no county level; township/streets do not return polylines.

## Endpoint
- https://restapi.amap.com/v3/config/district

## Required params
- key

## Optional params
- keywords: single keyword (name/citycode/adcode)
- subdistrict: 0..3 (levels of children)
- page (default 1), offset (default 20)
- extensions: base|all (boundary polyline for current district only)
- filter: adcode (recommended for accuracy)
- output: JSON|XML
- callback

## Example
```
https://restapi.amap.com/v3/config/district?keywords=北京&subdistrict=2&key=<KEY>
```

## Key response fields
- status, info, infocode
- suggestion.keywords, suggestion.cities
- districts[].{citycode, adcode, name, center, level, polyline, districts[]}
