#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path

import requests

DEFAULT_ENV_PATH = "/Users/liumobei/.openclaw/workspace/skills/gaodemapskill/.env"

RATE_LIMIT_INFOCODES = {
    "10044",  # daily quota exceeded
    "10016",  # IP query over limit (varies)
}


def load_env_file(env_path):
    data = {}
    if not env_path:
        return data
    path = Path(env_path)
    if not path.exists():
        return data
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            data[key.strip()] = value.strip()
    except Exception:
        return data
    return data


def resolve_api_key(env_path):
    env_data = load_env_file(env_path)
    return (
        os.environ.get("AMAP_API_KEY")
        or os.environ.get("GAODE_API_KEY")
        or env_data.get("AMAP_API_KEY")
        or env_data.get("GAODE_API_KEY")
    )


def request_json(url, params, timeout=20, normalize=False):
    try:
        resp = requests.get(url, params=params, timeout=timeout)
    except requests.RequestException as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if resp.status_code >= 400:
        print(f"HTTP {resp.status_code}: {resp.text}", file=sys.stderr)
        sys.exit(1)

    text = resp.text
    try:
        data = resp.json()
    except ValueError:
        print(text)
        return

    status = data.get("status")
    if status == "0":
        info = data.get("info", "Unknown error")
        infocode = data.get("infocode", "")
        if infocode in RATE_LIMIT_INFOCODES:
            print(f"Rate limit: {info} (infocode {infocode})", file=sys.stderr)
        else:
            print(f"API error: {info} (infocode {infocode})", file=sys.stderr)
        sys.exit(1)

    if normalize:
        payload = {
            "ok": True,
            "status": status,
            "info": data.get("info", "OK"),
            "infocode": data.get("infocode"),
            "data": data,
        }
        print(json.dumps(payload, ensure_ascii=True, indent=2))
    else:
        print(json.dumps(data, ensure_ascii=True, indent=2))


def add_common_args(parser):
    parser.add_argument(
        "--env",
        default=DEFAULT_ENV_PATH,
        help="Path to .env file containing AMAP_API_KEY",
    )
    parser.add_argument(
        "--key",
        help="Override API key (otherwise env/AMAP_API_KEY)",
    )
    parser.add_argument(
        "--normalize",
        action="store_true",
        default=True,
        help="Wrap response in standard JSON envelope (default: true)",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Return raw API response (disables normalization)",
    )


def geocode(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)
    params = {
        "key": key,
        "address": args.address,
    }
    if args.city:
        params["city"] = args.city
    if args.batch:
        params["batch"] = "true"
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output
    request_json(
        "https://restapi.amap.com/v3/geocode/geo",
        params,
        normalize=(args.normalize and not args.raw),
    )


def regeo(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)
    params = {
        "key": key,
        "location": args.location,
    }
    if args.radius:
        params["radius"] = args.radius
    if args.extensions:
        params["extensions"] = args.extensions
    if args.poitype:
        params["poitype"] = args.poitype
    if args.batch:
        params["batch"] = "true"
    if args.roadlevel:
        params["roadlevel"] = args.roadlevel
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output
    request_json(
        "https://restapi.amap.com/v3/geocode/regeo",
        params,
        normalize=(args.normalize and not args.raw),
    )


def district(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)
    params = {
        "key": key,
        "keywords": args.keywords,
    }
    if args.subdistrict is not None:
        params["subdistrict"] = args.subdistrict
    if args.page:
        params["page"] = args.page
    if args.offset:
        params["offset"] = args.offset
    if args.extensions:
        params["extensions"] = args.extensions
    if args.filter:
        params["filter"] = args.filter
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output
    request_json(
        "https://restapi.amap.com/v3/config/district",
        params,
        normalize=(args.normalize and not args.raw),
    )


def ip_lookup(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)
    params = {"key": key}
    if args.ip:
        params["ip"] = args.ip
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output
    request_json(
        "https://restapi.amap.com/v3/ip",
        params,
        normalize=(args.normalize and not args.raw),
    )


def static_map(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)
    params = {"key": key}
    if args.location:
        params["location"] = args.location
    if args.zoom:
        params["zoom"] = args.zoom
    if args.size:
        params["size"] = args.size
    if args.scale:
        params["scale"] = args.scale
    if args.markers:
        params["markers"] = args.markers
    if args.labels:
        params["labels"] = args.labels
    if args.paths:
        params["paths"] = args.paths
    if args.traffic:
        params["traffic"] = args.traffic
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output

    url = "https://restapi.amap.com/v3/staticmap"
    try:
        resp = requests.get(url, params=params, timeout=20)
    except requests.RequestException as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if resp.status_code >= 400:
        print(f"HTTP {resp.status_code}: {resp.text}", file=sys.stderr)
        sys.exit(1)

    content_type = resp.headers.get("Content-Type", "")
    if "application/json" in content_type:
        try:
            data = resp.json()
        except ValueError:
            print(resp.text)
            return
        status = data.get("status")
        if status == "0":
            info = data.get("info", "Unknown error")
            infocode = data.get("infocode", "")
            if infocode in RATE_LIMIT_INFOCODES:
                print(f"Rate limit: {info} (infocode {infocode})", file=sys.stderr)
            else:
                print(f"API error: {info} (infocode {infocode})", file=sys.stderr)
            sys.exit(1)
        if args.normalize and not args.raw:
            payload = {
                "ok": True,
                "status": status,
                "info": data.get("info", "OK"),
                "infocode": data.get("infocode"),
                "data": data,
            }
            print(json.dumps(payload, ensure_ascii=True, indent=2))
        else:
            print(json.dumps(data, ensure_ascii=True, indent=2))
        return

    if args.save:
        Path(args.save).write_bytes(resp.content)
        print(f"Saved static map to {args.save}")
    else:
        sys.stdout.buffer.write(resp.content)


def convert(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)
    params = {
        "key": key,
        "locations": args.locations,
        "coordsys": args.coordsys,
    }
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output
    request_json(
        "https://restapi.amap.com/v3/assistant/coordinate/convert",
        params,
        normalize=(args.normalize and not args.raw),
    )


def route(args):
    key = args.key or resolve_api_key(args.env)
    if not key:
        print("Missing API key. Set AMAP_API_KEY or provide --key.", file=sys.stderr)
        sys.exit(1)

    version = args.version
    mode = args.mode
    if version == "v3":
        base = "https://restapi.amap.com/v3/direction"
    else:
        base = "https://restapi.amap.com/v5/direction"

    url = f"{base}/{mode}"

    params = {
        "key": key,
        "origin": args.origin,
        "destination": args.destination,
    }

    if args.strategy is not None:
        params["strategy"] = args.strategy
    if args.waypoints:
        params["waypoints"] = args.waypoints
    if args.avoidpolygons:
        params["avoidpolygons"] = args.avoidpolygons
    if args.avoidroad:
        params["avoidroad"] = args.avoidroad
    if args.city:
        params["city"] = args.city
    if args.extensions:
        params["extensions"] = args.extensions
    if args.alternatives is not None:
        params["alternatives"] = args.alternatives
    if args.nightflag is not None:
        params["nightflag"] = args.nightflag
    if args.ferry is not None:
        params["ferry"] = args.ferry
    if args.sig:
        params["sig"] = args.sig
    if args.output:
        params["output"] = args.output

    request_json(url, params, normalize=(args.normalize and not args.raw))


def build_parser():
    parser = argparse.ArgumentParser(
        description="Gaode (Amap) Web Service CLI"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_geo = subparsers.add_parser("geocode", help="Address to coordinate")
    add_common_args(p_geo)
    p_geo.add_argument("--address", required=True)
    p_geo.add_argument("--city")
    p_geo.add_argument("--batch", action="store_true")
    p_geo.add_argument("--sig")
    p_geo.add_argument("--output")
    p_geo.set_defaults(func=geocode)

    p_regeo = subparsers.add_parser("regeo", help="Coordinate to address")
    add_common_args(p_regeo)
    p_regeo.add_argument("--location", required=True)
    p_regeo.add_argument("--radius")
    p_regeo.add_argument("--extensions", choices=["base", "all"])
    p_regeo.add_argument("--poitype")
    p_regeo.add_argument("--batch", action="store_true")
    p_regeo.add_argument("--roadlevel")
    p_regeo.add_argument("--sig")
    p_regeo.add_argument("--output")
    p_regeo.set_defaults(func=regeo)

    p_route = subparsers.add_parser("route", help="Routing (v3/v5)")
    add_common_args(p_route)
    p_route.add_argument("--version", choices=["v3", "v5"], default="v3")
    p_route.add_argument(
        "--mode",
        choices=["driving", "walking", "transit", "bicycling", "electrobike"],
        default="driving",
    )
    p_route.add_argument("--origin", required=True)
    p_route.add_argument("--destination", required=True)
    p_route.add_argument("--strategy")
    p_route.add_argument("--waypoints")
    p_route.add_argument("--avoidpolygons")
    p_route.add_argument("--avoidroad")
    p_route.add_argument("--city")
    p_route.add_argument("--extensions")
    p_route.add_argument("--alternatives")
    p_route.add_argument("--nightflag")
    p_route.add_argument("--ferry")
    p_route.add_argument("--sig")
    p_route.add_argument("--output")
    p_route.set_defaults(func=route)

    p_dist = subparsers.add_parser("district", help="Administrative district")
    add_common_args(p_dist)
    p_dist.add_argument("--keywords", required=True)
    p_dist.add_argument("--subdistrict", type=int)
    p_dist.add_argument("--page")
    p_dist.add_argument("--offset")
    p_dist.add_argument("--extensions")
    p_dist.add_argument("--filter")
    p_dist.add_argument("--sig")
    p_dist.add_argument("--output")
    p_dist.set_defaults(func=district)

    p_ip = subparsers.add_parser("ip", help="IP location lookup")
    add_common_args(p_ip)
    p_ip.add_argument("--ip")
    p_ip.add_argument("--sig")
    p_ip.add_argument("--output")
    p_ip.set_defaults(func=ip_lookup)

    p_map = subparsers.add_parser("staticmap", help="Static map image")
    add_common_args(p_map)
    p_map.add_argument("--location")
    p_map.add_argument("--zoom")
    p_map.add_argument("--size")
    p_map.add_argument("--scale")
    p_map.add_argument("--markers")
    p_map.add_argument("--labels")
    p_map.add_argument("--paths")
    p_map.add_argument("--traffic")
    p_map.add_argument("--save", help="Save image to file")
    p_map.add_argument("--sig")
    p_map.add_argument("--output")
    p_map.set_defaults(func=static_map)

    p_conv = subparsers.add_parser("convert", help="Coordinate conversion")
    add_common_args(p_conv)
    p_conv.add_argument("--locations", required=True)
    p_conv.add_argument(
        "--coordsys",
        choices=["gps", "mapbar", "baidu", "autonavi"],
        required=True,
    )
    p_conv.add_argument("--sig")
    p_conv.add_argument("--output")
    p_conv.set_defaults(func=convert)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
