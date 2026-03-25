# Gaode IP Location

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- IPv4 only, China IPs only.
- UTF-8, JSON/XML, Web Service API Key required.

## Endpoint
- https://restapi.amap.com/v3/ip

## Required params
- key

## Optional params
- ip: IPv4 string (if omitted, uses request IP)
- output: JSON|XML
- sig

## Example
```
https://restapi.amap.com/v3/ip?ip=114.247.50.2&key=<KEY>
```

## Key response fields
- status, info, infocode
- province, city, adcode, rectangle
