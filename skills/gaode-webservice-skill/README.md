# Gaode Web Service CLI

A small CLI for Gaode (Amap) Web Service APIs. Uses the API key from
`/Users/liumobei/.openclaw/workspace/skills/gaodemapskill/.env` by default.

## Install

```bash
python3 -m pip install requests
```

## Usage

All commands share:
- `--env` Path to .env file containing `AMAP_API_KEY`
- `--key` Override API key
- `--normalize` Wrap response in a standard JSON envelope (default: true)
- `--raw` Return raw API JSON (disables normalization)

### Geocode

```bash
python3 scripts/gaode_cli.py geocode --address "Beijing Tiananmen" --city "Beijing"
```

### Reverse Geocode

```bash
python3 scripts/gaode_cli.py regeo --location "116.481488,39.990464" --extensions all
```

### Routing (v3/v5)

```bash
python3 scripts/gaode_cli.py route --version v3 --mode driving \
  --origin "116.481028,39.989643" --destination "116.465302,40.004717"
```

```bash
python3 scripts/gaode_cli.py route --version v5 --mode bicycling \
  --origin "116.481028,39.989643" --destination "116.465302,40.004717"
```

### District

```bash
python3 scripts/gaode_cli.py district --keywords "Beijing" --subdistrict 1
```

### IP Lookup

```bash
python3 scripts/gaode_cli.py ip --ip "8.8.8.8"
```

### Static Map

```bash
python3 scripts/gaode_cli.py staticmap --location "116.481028,39.989643" \
  --zoom 13 --size 600*400 --save /tmp/map.png
```

### Coordinate Conversion

```bash
python3 scripts/gaode_cli.py convert --locations "116.481028,39.989643" --coordsys gps
```

## Notes

- JSON responses are pretty-printed to stdout.
- Static maps can be written to a file via `--save`, otherwise the binary is streamed to stdout.
- API errors and rate limits return a non-zero exit code with details on stderr.
