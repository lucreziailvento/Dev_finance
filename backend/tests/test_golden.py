"""Golden test: i numeri esposti dall'API devono restare identici al baseline.

Il baseline e' stato generato con il codice pre-refactoring a partire da
`backend/portfolio_v2.db`. Se cambia intenzionalmente la logica di calcolo,
rigenerare il baseline con:

    python3 -m backend.tests.golden

e revisionare il diff di `backend/tests/golden_baseline.json` prima del commit.
"""

import json
import math

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.tests.golden import BASELINE, collect

TOLERANCE = 0.01


def _diff(actual, expected, path=""):
    """Confronto ricorsivo con tolleranza sui float. Ritorna lista di differenze."""
    problems = []
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{path}: atteso dict, ricevuto {type(actual).__name__}"]
        missing = set(expected) - set(actual)
        extra = set(actual) - set(expected)
        if missing:
            problems.append(f"{path}: chiavi mancanti {sorted(missing)}")
        if extra:
            problems.append(f"{path}: chiavi inattese {sorted(extra)}")
        for key in sorted(set(expected) & set(actual)):
            problems.extend(_diff(actual[key], expected[key], f"{path}.{key}"))
        return problems
    if isinstance(expected, list):
        if not isinstance(actual, list):
            return [f"{path}: attesa list, ricevuto {type(actual).__name__}"]
        if len(actual) != len(expected):
            return [f"{path}: lunghezza {len(actual)} != {len(expected)}"]
        for index, (got, want) in enumerate(zip(actual, expected)):
            problems.extend(_diff(got, want, f"{path}[{index}]"))
        return problems
    if isinstance(expected, bool) or isinstance(actual, bool):
        if actual != expected:
            problems.append(f"{path}: {actual!r} != {expected!r}")
        return problems
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if not math.isclose(actual, expected, abs_tol=TOLERANCE):
            problems.append(f"{path}: {actual!r} != {expected!r}")
        return problems
    if actual != expected:
        problems.append(f"{path}: {actual!r} != {expected!r}")
    return problems


@pytest.mark.skipif(not BASELINE.exists(), reason="baseline non generato")
def test_api_numbers_match_baseline():
    expected = json.loads(BASELINE.read_text(encoding="utf-8"))
    with TestClient(app) as client:
        actual = collect(client)

    problems = _diff(actual, expected)
    assert not problems, (
        "I numeri esposti dall'API sono cambiati rispetto al baseline "
        f"({len(problems)} differenze):\n" + "\n".join(problems[:40])
    )
