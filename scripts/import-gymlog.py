"""Copies gym-log's day rows into jinsei through its API.

Runs against the deployed instance rather than the database so the same
validation applies to imported rows as to hand-entered ones. Every endpoint is
an upsert keyed on the date, which makes a second run harmless.

Workouts are deliberately skipped: jinsei pulls those from Hevy directly, and
gym-log's copies of the same sessions carry no provider id to match them on.
"""
import json
import os
import ssl
import sqlite3
import subprocess
import sys
import urllib.request

BASE = "https://pi.tail3e1947.ts.net:9443"
DRY_RUN = "--apply" not in sys.argv

rows = json.loads(subprocess.run(
    ["sshpass", "-p", "root", "ssh", "-o", "StrictHostKeyChecking=no", "n8n@100.112.146.39",
     'docker exec gymlog python3 -c "'
     "import sqlite3, json;"
     'c = sqlite3.connect(\\"/app/data/gymlog.db\\");'
     "c.row_factory = sqlite3.Row;"
     'print(json.dumps([dict(r) for r in c.execute(\\"select * from day_logs order by log_date\\")]))'
     '"'],
    capture_output=True, text=True, check=True).stdout)

ctx = ssl.create_default_context()
jar = []


def call(path, payload=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json", "Cookie": "; ".join(jar)},
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(req, context=ctx, timeout=30) as res:
        for header in res.headers.get_all("Set-Cookie") or []:
            jar.append(header.split(";")[0])
        return res.status


call("/api/auth/login", {"email": os.environ["EMAIL"], "password": os.environ["PASSWORD"]})

# Only send a section when the source row has something for it, so an import
# cannot blank a field that jinsei already holds.
def some(d, *keys):
    return any(d.get(k) not in (None, "") for k in keys)


planned = []
for r in rows:
    date = r["log_date"]

    if some(r, "weight_kg", "waist_cm"):
        planned.append(("/api/weight", {
            "date": date, "weightKg": r.get("weight_kg"), "waistCm": r.get("waist_cm"), "notes": None}))

    if some(r, "kcal", "protein_g", "carbs_g", "fat_g", "water_l", "coffee_ml", "last_coffee"):
        planned.append(("/api/nutrition", {
            "date": date, "kcal": r.get("kcal"), "proteinG": r.get("protein_g"),
            "carbsG": r.get("carbs_g"), "fatG": r.get("fat_g"), "waterL": r.get("water_l"),
            "coffeeMl": r.get("coffee_ml"), "lastCoffee": r.get("last_coffee"), "notes": None}))

    if some(r, "sleep_bed_min", "sleep_actual_min", "sleep_quality"):
        planned.append(("/api/sleep", {
            "date": date, "timeInBedMinutes": r.get("sleep_bed_min"),
            "actualSleepMinutes": r.get("sleep_actual_min"), "quality": r.get("sleep_quality"),
            "notes": None}))

    # cardio is 0/1 in gym-log and never null, so it always says something.
    if some(r, "steps", "cardio_min") or r.get("cardio") is not None:
        planned.append(("/api/activity", {
            "date": date, "steps": r.get("steps"),
            "cardio": bool(r.get("cardio")), "cardioMinutes": r.get("cardio_min")}))

    if some(r, "hunger", "energy", "notes"):
        planned.append(("/api/wellbeing", {
            "date": date, "hunger": r.get("hunger"), "energy": r.get("energy"),
            "notes": r.get("notes")}))

for path, payload in planned:
    if DRY_RUN:
        print(f"would POST {path:<18} {json.dumps(payload, ensure_ascii=False)}")
    else:
        print(f"POST {path:<18} {payload['date']} -> {call(path, payload)}")

print(f"\n{len(planned)} requests across {len(rows)} days"
      + (" (dry run, nothing written)" if DRY_RUN else ""))
