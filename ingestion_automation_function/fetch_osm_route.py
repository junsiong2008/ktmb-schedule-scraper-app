"""
Build a single LineString (plus named stop points) from an OSM route relation and
append it to the Overpass GeoJSON used by ingest_overpass_shapes.py.

OSM route relations store the track as many `way` members. This script stitches
them end to end into one ordered polyline, flipping ways as needed, so routes that
are missing from the original Overpass export (e.g. the East Coast line) can get
real track geometry instead of straight station-to-station lines.

Usage:
    python fetch_osm_route.py 2893513 20414742 \
        --json ../ktmb_api/ktmb_overpass_route/ktm.json

    # or from a relation JSON already downloaded with `relation(<id>);out geom;`
    python fetch_osm_route.py --from-file rel_2893513.json --json ...
"""
import argparse
import json
import math
import time
import urllib.parse
import urllib.request

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def haversine(lat1, lon1, lat2, lon2):
    r = 6371e3
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_relation(rel_id, retries=5):
    query = f"[out:json][timeout:150];relation({rel_id});out geom;"
    data = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(OVERPASS_URL, data=data, headers={"User-Agent": "route-shape-script/1.0"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.load(resp)
        except Exception as e:  # Overpass is often at capacity; back off and retry
            wait = 15 * (2 ** attempt)
            print(f"  Overpass request failed ({e}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError(f"Could not fetch relation {rel_id} from Overpass")


def stitch_ways(ways):
    """Join way geometries (lists of (lon, lat)) into one ordered line.

    Ways are taken in relation order. Each way is flipped if its end, rather than its
    start, is the one nearest the current tail. A gap (unconnected ways) is bridged
    with a straight segment and reported.
    """
    ways = [w for w in ways if len(w) >= 2]
    if not ways:
        return [], []

    # Orient the first way towards the second one.
    line = list(ways[0])
    if len(ways) > 1:
        nxt = ways[1]
        d_end = min(haversine(line[-1][1], line[-1][0], p[1], p[0]) for p in (nxt[0], nxt[-1]))
        d_start = min(haversine(line[0][1], line[0][0], p[1], p[0]) for p in (nxt[0], nxt[-1]))
        if d_start < d_end:
            line.reverse()

    gaps = []
    for w in ways[1:]:
        tail = line[-1]
        d_fwd = haversine(tail[1], tail[0], w[0][1], w[0][0])
        d_rev = haversine(tail[1], tail[0], w[-1][1], w[-1][0])
        seg = w if d_fwd <= d_rev else list(reversed(w))
        gap = min(d_fwd, d_rev)
        if gap > 50:
            gaps.append((round(gap), tail))
        # Skip the duplicated join node.
        line.extend(seg[1:] if gap < 1 else seg)
    return line, gaps


def relation_to_features(rel):
    tags = rel.get("tags", {})
    name = tags.get("name", f"relation {rel['id']}")

    ways = []
    stops = []
    for m in rel.get("members", []):
        if m["type"] == "way" and m.get("role", "") in ("", "route", "forward", "backward") and m.get("geometry"):
            ways.append([(p["lon"], p["lat"]) for p in m["geometry"]])
        elif m["type"] == "node" and m.get("role", "").startswith("stop"):
            stops.append(m)

    line, gaps = stitch_ways(ways)
    length_km = sum(haversine(a[1], a[0], b[1], b[0]) for a, b in zip(line, line[1:])) / 1000
    print(f"  {name}: {len(ways)} ways -> {len(line)} points, {length_km:.0f} km, {len(gaps)} gaps > 50 m")
    for g, at in gaps:
        print(f"    gap of {g} m near ({at[1]:.4f}, {at[0]:.4f})")

    features = [{
        "type": "Feature",
        "properties": {**tags, "@id": f"relation/{rel['id']}"},
        "geometry": {"type": "LineString", "coordinates": [list(p) for p in line]},
    }]
    return features, stops


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("relation_ids", nargs="*", type=int)
    ap.add_argument("--from-file", action="append", default=[], help="Relation JSON from `out geom` (repeatable)")
    ap.add_argument("--json", required=True, help="Overpass GeoJSON to append LineStrings to (e.g. ktm.json)")
    ap.add_argument("--stops-out", help="Optional path to write the relations' named stop nodes as JSON")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rels = []
    for path in args.from_file:
        with open(path) as f:
            rels += [e for e in json.load(f)["elements"] if e["type"] == "relation"]
    for rid in args.relation_ids:
        print(f"Fetching relation {rid}...")
        rels += [e for e in fetch_relation(rid)["elements"] if e["type"] == "relation"]

    with open(args.json) as f:
        geo = json.load(f)

    all_stops = {}
    for rel in rels:
        feats, stops = relation_to_features(rel)
        name = feats[0]["properties"].get("name")
        # Replace any existing LineString with the same name so re-runs are idempotent.
        geo["features"] = [
            x for x in geo["features"]
            if not (x.get("geometry", {}).get("type") == "LineString" and x.get("properties", {}).get("name") == name)
        ]
        geo["features"].extend(feats)
        for s in stops:
            all_stops[s["ref"]] = {"lat": s["lat"], "lon": s["lon"], "relation": rel["id"]}

    if args.stops_out:
        with open(args.stops_out, "w") as f:
            json.dump(all_stops, f, indent=1)

    if args.dry_run:
        print("Dry run: not writing", args.json)
        return
    with open(args.json, "w") as f:
        json.dump(geo, f)
    print(f"Wrote {args.json}")


if __name__ == "__main__":
    main()
