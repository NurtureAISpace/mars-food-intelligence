"""
Prints the Crew Health literature range check and the parameter table.

    model output vs published value, tolerance, PASS/FAIL, source, parameter status

Run from the backend directory:
    python scripts/literature_check.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ml.literature_check import run_checks, summary
from app.ml.params import parameter_table


def _fmt(v):
    if v is None:
        return "-"
    if isinstance(v, list):
        return "[" + ", ".join(_fmt(x) for x in v) + "]"
    if isinstance(v, float):
        return f"{v:.4g}"
    return str(v)


def print_table(rows, cols, widths):
    header = " | ".join(c.ljust(w) for c, w in zip(cols, widths))
    print(header)
    print("-" * len(header))
    for r in rows:
        print(" | ".join(_fmt(r[c])[:w].ljust(w) for c, w in zip(cols, widths)))


checks = run_checks()
for c in checks:
    c["result"] = "INFO" if c["passed"] is None else ("PASS" if c["passed"] else "FAIL")

print("LITERATURE RANGE CHECK\n")
print_table(checks, ["check", "model_value", "literature_value", "unit", "tolerance", "result", "kind", "source", "status"],
            [62, 11, 14, 9, 11, 6, 20, 22, 10])
s = summary(checks)
print(f"\n{s['passed']}/{s['graded']} graded checks pass "
      f"({s['independent_passed']}/{s['independent_total']} independent; the rest are calibration identities).")
for c in checks:
    if c["result"] == "FAIL":
        print(f"  FAIL: {c['check']}: model {_fmt(c['model_value'])} vs {_fmt(c['literature_value'])} {c['unit']}. {c['note']}")

print("\n\nPARAMETERS (app/data/literature_params.json)\n")
print_table(parameter_table(), ["name", "value", "unit", "status", "source"], [42, 44, 22, 10, 22])
assumed = [p["name"] for p in parameter_table() if p["status"] == "assumed"]
print(f"\n{len(assumed)} assumed parameters: {', '.join(assumed)}")
