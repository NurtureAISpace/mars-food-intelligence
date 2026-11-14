"""
Literature parameter registry for the Crew Health model.

All physiological, kinetic and synthetic-crew parameters live in
app/data/literature_params.json, one entry per parameter with its source,
location in the source and a status ("literature" | "derived" | "assumed").
Model code reads values through `param(name)` so every number is traceable.
"""

import json
from functools import lru_cache
from typing import Any, Dict, List

from app.core.config import settings

PARAMS_FILE = settings.DATA_DIR / "literature_params.json"
VALID_STATUS = ("literature", "derived", "assumed")
REQUIRED_FIELDS = ("name", "value", "unit", "source", "where_in_source", "status", "note")


@lru_cache(maxsize=1)
def load_params_file() -> Dict[str, Any]:
    with open(PARAMS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _by_name() -> Dict[str, Dict[str, Any]]:
    entries = {}
    for entry in load_params_file()["parameters"]:
        if entry["name"] in entries:
            raise ValueError(f"Duplicate parameter '{entry['name']}' in {PARAMS_FILE.name}")
        entries[entry["name"]] = entry
    return entries


def param_entry(name: str) -> Dict[str, Any]:
    try:
        return _by_name()[name]
    except KeyError:
        raise KeyError(f"Parameter '{name}' missing from {PARAMS_FILE.name}") from None


def param(name: str) -> Any:
    """Value of a registered parameter."""
    return param_entry(name)["value"]


def sources() -> Dict[str, Dict[str, Any]]:
    return load_params_file()["sources"]


def parameter_table() -> List[Dict[str, Any]]:
    """Every parameter with its source resolved to citation + DOI/URL."""
    srcs = sources()
    rows = []
    for entry in load_params_file()["parameters"]:
        src = srcs.get(entry["source"], {})
        rows.append({
            **entry,
            "source_citation": src.get("citation"),
            "doi_or_url": src.get("doi_or_url"),
            "source_access": src.get("access"),
        })
    return rows


def parameter_provenance() -> Dict[str, Any]:
    """Compact provenance block for API responses."""
    entries = load_params_file()["parameters"]
    counts = {s: sum(1 for e in entries if e["status"] == s) for s in VALID_STATUS}
    used = {e["source"] for e in entries}
    return {
        "parameters_file": f"app/data/{PARAMS_FILE.name}",
        "status_counts": counts,
        "assumed_parameters": [e["name"] for e in entries if e["status"] == "assumed"],
        "sources": [
            {"id": sid, "citation": s["citation"], "doi_or_url": s["doi_or_url"], "access": s["access"]}
            for sid, s in sources().items() if sid in used
        ],
    }
