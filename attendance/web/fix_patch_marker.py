from pathlib import Path
import re

p = Path("src/pages/Dashboard.tsx")
s = p.read_text(encoding="utf-8")

# Confirm the exact source markers before changing anything
checks = {
    "trendDate": "const trendDate=" in s,
    "fetchRequestId": "const fetchRequestId = useRef(0);" in s,
    "analytics": '<div className="card chart">' in s,
    "request CSS": ".request-status{" in s,
}
print("Marker check:", checks)

if not all(checks.values()):
    raise SystemExit("STOP: Required markers missing; Dashboard.tsx was not changed.")

# Fix the trendDate matching issue in the earlier patch script.
script = Path("update_dashboard.py")
if script.exists():
    old = script.read_text(encoding="utf-8-sig")
    old = old.replace(
        "marker = '  const trendDate=(s:string)=>new Date(s).toLocaleDateString(\"en-GB\",{day:\"2-digit\",month:\"short\"});'",
        'marker = next((line for line in s.splitlines() if "const trendDate=" in line), None)'
    )
    old = old.replace(
        's = s.replace(marker, marker + "\\n" + pending_logic, 1)',
        's = s.replace(marker, marker + "\\n" + pending_logic, 1)'
    )
    script.write_text(old, encoding="utf-8")
    print("Updated patch script marker matching.")
else:
    print("update_dashboard.py not found; no source files changed.")
