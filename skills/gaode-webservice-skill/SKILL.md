---
name: gaode-webservice-skill
description: "Gaode (Amap) Web Service CLI: geocoding, reverse geocoding, routing, district, IP, static map, and coordinate conversion. Uses local AMAP_API_KEY from skills/gaodemapskill/.env by default."
---

# Gaode Web Service Skill

Use this skill to query Gaode (Amap) Web Service APIs via a local CLI.

## Files

- `scripts/gaode_cli.py` - CLI entry point
- `README.md` - usage examples

## Default Routing

- Geocode an address -> `gaode_cli.py geocode`
- Reverse geocode a coordinate -> `gaode_cli.py regeo`
- Routing (v3/v5) -> `gaode_cli.py route`
- District lookup -> `gaode_cli.py district`
- IP lookup -> `gaode_cli.py ip`
- Static map image -> `gaode_cli.py staticmap`
- Coordinate conversion -> `gaode_cli.py convert`

## Key Handling

By default, the CLI reads `AMAP_API_KEY` from:
`/Users/liumobei/.openclaw/workspace/skills/gaodemapskill/.env`

Override with:
- `--key` for a one-off
- `--env` to point to a different .env file
- environment variable `AMAP_API_KEY`

## Error Handling

- HTTP errors -> non-zero exit with message
- API errors -> non-zero exit with message
- Rate limits -> explicit message with infocode
