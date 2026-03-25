# Gaode Static Map

Source: user-provided tutorial excerpt (2026-03-05).

## Overview
- Returns a static map image (PNG) via HTTP.
- UTF-8, Web Service API Key required.

## Endpoint
- https://restapi.amap.com/v3/staticmap

## Required params
- key

## Common params
- location: map center lon,lat (optional if overlays provided)
- zoom: 1-17
- size: WxH (max 1024x1024)
- scale: 1 normal, 2 HD
- markers, labels, paths, traffic (0/1)

## Example
```
https://restapi.amap.com/v3/staticmap?location=116.481485,39.990464&zoom=10&size=750*300&markers=mid,,A:116.481485,39.990464&key=<KEY>
```

## Markers
Format:
```
markers=style1:lon,lat;lon,lat|style2:lon,lat
```
style: size,color,label (size: small|mid|large; color hex; label 0-9/A-Z/one CJK char)

## Labels
Format:
```
labels=content,font,bold,fontSize,fontColor,background:lon,lat
```

## Paths
Format:
```
paths=weight,color,transparency,fillcolor,fillTransparency:lon,lat;lon,lat
```
