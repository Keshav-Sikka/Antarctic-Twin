"""PolarCore: deterministic, offline-first station digital-twin API.

The module deliberately keeps its data model in memory.  This makes the
prototype useful on an isolated station network while retaining the original
REST and websocket contracts used by the dashboard.
"""

import asyncio
import copy
import json
import math
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="PolarCore Antarctic Digital Twin", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScenarioRequest(BaseModel):
    scenario: str


class StationRequest(BaseModel):
    station: Optional[str] = None
    station_id: Optional[str] = None


class CopilotRequest(BaseModel):
    question: str = ""


class RoomDemoRequest(BaseModel):
    cause: str = "HEATER_FAULT"


STATION_PROFILES = {
    "BHARATI_STATION": {
        "label": "Bharati Research Station",
        "location": {"latitude": -69.413, "longitude": 76.187},
        "temp": -38.5,
        "wind": 28.0,
        "pressure": 982,
        "humidity": 64,
        "visibility": 18.0,
        "fuel": 72,
        "load": 338,
        "output": 412,
        "personnel": 42,
        "mesh_id": "bharati-mesh-01",
    },
    "MAITRI_STATION": {
        "label": "Maitri Research Station",
        "location": {"latitude": -70.769, "longitude": 11.733},
        "temp": -31.2,
        "wind": 22.0,
        "pressure": 976,
        "humidity": 58,
        "visibility": 22.0,
        "fuel": 64,
        "load": 302,
        "output": 386,
        "personnel": 38,
        "mesh_id": "maitri-mesh-01",
    },
}

STATION_ALIASES = {
    "BHARATI": "BHARATI_STATION",
    "BHARATI_STATION": "BHARATI_STATION",
    "MAITRI": "MAITRI_STATION",
    "MAITRI_STATION": "MAITRI_STATION",
}

DOMAIN_NAMES = [
    "environment",
    "weather",
    "energy",
    "generator",
    "fuel",
    "logistics",
    "risk",
    "water",
    "air_quality",
    "habitat",
    "personnel",
    "medical",
    "communications",
    "research",
    "transport",
    "cybersecurity",
]

ROOM_BLUEPRINTS = {
    "BHARATI_STATION": [
        ("B-01", "Crew Quarters", "LIVING", 3, 21.4),
        ("B-02", "Laboratory", "RESEARCH", 4, 22.1),
        ("B-03", "Power Room", "UTILITY", 1, 24.8),
        ("B-04", "Medical Bay", "MEDICAL", 1, 21.8),
        ("B-05", "Operations Hub", "CONTROL", 2, 22.4),
        ("B-06", "Storage / Galley", "LOGISTICS", 3, 19.6),
        ("B-07", "Communications Room", "COMMS", 1, 22.0),
    ],
    "MAITRI_STATION": [
        ("M-01", "Crew Quarters", "LIVING", 3, 21.0),
        ("M-02", "Laboratory", "RESEARCH", 5, 21.7),
        ("M-03", "Generator Control", "UTILITY", 1, 25.2),
        ("M-04", "Medical Bay", "MEDICAL", 1, 21.5),
        ("M-05", "Operations Hub", "CONTROL", 2, 22.2),
        ("M-06", "Workshop / Storage", "LOGISTICS", 2, 19.2),
        ("M-07", "Communications Room", "COMMS", 1, 21.8),
    ],
}

SCENARIO_PRESETS = {
    "NOMINAL": {"label": "Nominal operations", "description": "Baseline station operations."},
    "BLIZZARD": {"label": "Blizzard", "description": "High wind and near-zero visibility."},
    "GEN_FAILURE": {"label": "Generator failure", "description": "Primary generator trips offline."},
    "FUEL_FREEZE": {"label": "Fuel freeze", "description": "Fuel lines freeze and usable reserve falls."},
    "EXTREME_COLD": {"label": "Extreme cold", "description": "Temperature stress increases heating demand."},
    "SUPPLY_DELAY": {"label": "Supply delay", "description": "The next resupply window is delayed."},
    "MEDICAL_SURGE": {"label": "Medical surge", "description": "Medical consumption and staffing pressure rise."},
    "COMMS_OUTAGE": {"label": "Communications outage", "description": "Satellite link is unavailable; mesh remains active."},
}

HARD_LIMITS = {
    "outside_temp_c": {"low": -65.0, "high": 5.0, "unit": "°C"},
    "wind_knots": {"low": 0.0, "high": 90.0, "unit": "kt"},
    "generator_output_kw": {"low": 150.0, "high": 500.0, "unit": "kW"},
    "fuel_level_pct": {"low": 15.0, "high": 100.0, "unit": "%"},
    "battery_level_pct": {"low": 20.0, "high": 100.0, "unit": "%"},
    "pressure_hpa": {"low": 900.0, "high": 1060.0, "unit": "hPa"},
}


def _station_id(value: str) -> str:
    return STATION_ALIASES.get(str(value or "").strip().upper(), "")


def detect_anomalies(
    values: Dict[str, float],
    limits: Optional[Dict[str, Dict[str, float]]] = None,
    z_threshold: float = 3.0,
    use_isolation_forest: bool = False,
    baseline: Optional[Dict[str, List[float]]] = None,
) -> Dict[str, Any]:
    """Detect hard-limit and z-score anomalies without requiring sklearn.

    If scikit-learn happens to be installed, ``use_isolation_forest`` enables
    it as an optional second opinion; the prototype never requires it.
    """
    limits = limits or HARD_LIMITS
    history = baseline or {
        "outside_temp_c": [-38.5, -39.0, -37.8, -38.2, -38.7],
        "wind_knots": [27.0, 29.0, 28.0, 27.5, 28.5],
        "generator_output_kw": [408.0, 414.0, 410.0, 412.0, 411.0],
        "fuel_level_pct": [74.0, 73.0, 73.0, 72.5, 72.0],
        "battery_level_pct": [87.0, 86.0, 86.0, 85.0, 86.0],
        "pressure_hpa": [984.0, 983.0, 982.0, 983.0, 982.0],
    }
    anomalies: List[Dict[str, Any]] = []
    for metric, raw_value in values.items():
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        rule = limits.get(metric)
        if rule and (value < rule["low"] or value > rule["high"]):
            anomalies.append(
                {
                    "metric": metric,
                    "value": value,
                    "kind": "hard_limit",
                    "severity": "CRITICAL",
                    "explanation": f"{metric} is outside {rule['low']}..{rule['high']} {rule.get('unit', '')}".strip(),
                }
            )
        sample = history.get(metric, [])
        if len(sample) >= 3:
            mean = sum(sample) / len(sample)
            variance = sum((item - mean) ** 2 for item in sample) / len(sample)
            stdev = math.sqrt(variance)
            z_score = abs(value - mean) / stdev if stdev else 0.0
            if z_score >= z_threshold:
                anomalies.append(
                    {
                        "metric": metric,
                        "value": value,
                        "kind": "z_score",
                        "z_score": round(z_score, 2),
                        "severity": "WARNING",
                        "explanation": "Value deviates from the deterministic station baseline.",
                    }
                )
    detector = "rules+zscore"
    if use_isolation_forest:
        try:
            from sklearn.ensemble import IsolationForest  # type: ignore

            detector = "rules+zscore+isolation_forest"
            matrix = [[history.get(metric, [value])[-1]] for metric, value in values.items()]
            if matrix:
                model = IsolationForest(random_state=0, contamination="auto").fit(matrix)
                if -1 in model.predict(matrix):
                    anomalies.append(
                        {
                            "metric": "multivariate",
                            "kind": "isolation_forest",
                            "severity": "WARNING",
                            "explanation": "Optional IsolationForest flagged a multivariate deviation.",
                        }
                    )
        except (ImportError, ValueError, RuntimeError):
            detector = "rules+zscore"
    return {"detector": detector, "z_threshold": z_threshold, "anomalies": anomalies}


def _mesh_metadata(profile: Dict[str, Any], online: bool = True) -> Dict[str, Any]:
    return {
        "node_id": profile["mesh_id"],
        "protocol": "PolarMesh/1.0",
        "transport": "LoRa + Wi-Fi store-and-forward",
        "offline_first": True,
        "satellite_online": online,
        "sync_state": "CONNECTED" if online else "MESH_ONLY",
        "queued_packets": 0 if online else 7,
        "last_sync": "just now" if online else "2026-09-11T04:58:00Z",
        "peers": [
            {"station": "BHARATI_STATION", "reachable": online},
            {"station": "MAITRI_STATION", "reachable": True},
        ],
    }


def _build_domains(station: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {
        "environment": {"status": "NORMAL", "temperature_c": station["environment"]["outside_temp_c"]},
        "weather": {"status": "NORMAL", "visibility_km": station["environment"]["visibility_km"]},
        "energy": {"status": "NORMAL", "net_power_kw": station["energy"]["generator_output_kw"] - station["energy"]["power_consumption_kw"]},
        "generator": {"status": "NORMAL", "output_kw": station["energy"]["generator_output_kw"]},
        "fuel": {"status": "NORMAL", "reserve_pct": station["energy"]["fuel_level_pct"]},
        "logistics": {"status": "NORMAL", "food_days": 38, "medical_days": 14},
        "risk": {"status": "LOW", "score": 18},
        "water": {"status": "NORMAL", "storage_pct": 88.5},
        "air_quality": {"status": "NORMAL", "co2_ppm": 618},
        "habitat": {"status": "NORMAL", "indoor_temp_c": station["environment"]["indoor_temp_c"]},
        "personnel": {"status": "NORMAL", "headcount": station["personnel"]["total"]},
        "medical": {"status": "WARNING", "days_remaining": 14},
        "communications": {"status": "NORMAL" if station["satellite_online"] else "DEGRADED"},
        "research": {"status": "NORMAL", "active_projects": 6},
        "transport": {"status": "NORMAL", "next_window_hours": 36},
        "cybersecurity": {"status": "NORMAL", "trust_score": 99},
    }


def _build_station(station_id: str) -> Dict[str, Any]:
    profile = STATION_PROFILES[station_id]
    station = {
        "station": station_id,
        "station_label": profile["label"],
        "location": profile["location"],
        "active_scenario": "NOMINAL",
        "satellite_online": True,
        "station_health": "HEALTHY",
        "environment": {
            "outside_temp_c": profile["temp"],
            "indoor_temp_c": 21.4 if station_id == "BHARATI_STATION" else 20.8,
            "wind_knots": profile["wind"],
            "wind_direction": "SE" if station_id == "BHARATI_STATION" else "E",
            "pressure_hpa": profile["pressure"],
            "humidity_pct": profile["humidity"],
            "visibility_km": profile["visibility"],
            "snow_accumulation_cm": 3.2 if station_id == "BHARATI_STATION" else 2.7,
        },
        "energy": {
            "generator_output_kw": profile["output"],
            "power_consumption_kw": profile["load"],
            "peak_load_kw": 465 if station_id == "BHARATI_STATION" else 438,
            "fuel_level_pct": profile["fuel"],
            "battery_level_pct": 86 if station_id == "BHARATI_STATION" else 79,
            "renewable_kw": 38 if station_id == "BHARATI_STATION" else 31,
            "efficiency_pct": 82 if station_id == "BHARATI_STATION" else 80,
            "anomaly": "No active anomaly.",
        },
        "inventory": [
            {"item": "Diesel", "value": profile["fuel"], "unit": "%", "status": "GOOD", "runway": "18 days" if station_id == "BHARATI_STATION" else "15 days"},
            {"item": "Food supplies", "value": 38 if station_id == "BHARATI_STATION" else 34, "unit": "days", "status": "GOOD", "runway": "38 days" if station_id == "BHARATI_STATION" else "34 days"},
            {"item": "Medical supplies", "value": 14, "unit": "days", "status": "WARNING", "runway": "14 days"},
            {"item": "Spare generator parts", "value": 2, "unit": "kits", "status": "GOOD", "runway": "—"},
            {"item": "Oxygen", "value": 61 if station_id == "BHARATI_STATION" else 58, "unit": "%", "status": "GOOD", "runway": "24 days"},
        ],
        "personnel": {
            "total": profile["personnel"],
            "safe": profile["personnel"] - 2,
            "medical": 1,
            "unaccounted": 1,
            "last_check_in": "02:14 ago",
        },
        "alerts": [
            {"id": "a1", "severity": "WARNING", "title": "Generator telemetry under observation", "impact": "Preventive inspection due", "action": "Inspect cooling loop"},
            {"id": "a2", "severity": "WARNING", "title": "Diesel below projected threshold", "impact": "Runway risk", "action": "Prioritize resupply"},
            {"id": "a3", "severity": "WARNING", "title": "Medical inventory low", "impact": "14 days remaining", "action": "Add to next flight manifest"},
        ],
        "machines": {
            "gen1": {"id": "gen1", "name": "Diesel Generator #1", "mesh_id": "mesh_gen1", "metric_1_name": "Core Temp", "metric_1_val": 81.4, "metric_1_unit": "°C", "metric_2_name": "Vibration", "metric_2_val": 49.8, "metric_2_unit": "Hz", "status": "NORMAL"},
            "fuel": {"id": "fuel", "name": "Main Fuel Tanks", "mesh_id": "mesh_fuel", "metric_1_name": "Reserve", "metric_1_val": profile["fuel"] * 1730, "metric_1_unit": "L", "metric_2_name": "Line Temp", "metric_2_val": -4.2, "metric_2_unit": "°C", "status": "NORMAL"},
            "water": {"id": "water", "name": "Snow Melter & Recycling", "mesh_id": "mesh_water", "metric_1_name": "Storage", "metric_1_val": 88.5, "metric_1_unit": "%", "metric_2_name": "Flow Rate", "metric_2_val": 14.2, "metric_2_unit": "L/m", "status": "NORMAL"},
            "hvac": {"id": "hvac", "name": "Life Support HVAC", "mesh_id": "mesh_hvac", "metric_1_name": "Hab Temp", "metric_1_val": 21.2, "metric_1_unit": "°C", "metric_2_name": "Airflow", "metric_2_val": 1200, "metric_2_unit": "CFM", "status": "NORMAL"},
        },
        "offline_mesh": _mesh_metadata(profile),
    }
    station["domains"] = _build_domains(station)
    _derive(station)
    return station


def _derive(station: Dict[str, Any]) -> None:
    env = station["environment"]
    energy = station["energy"]
    machines = station["machines"]
    scenario = station["active_scenario"]
    # This is intentionally a transparent causal model: each downstream
    # node is derived from the preceding node rather than random telemetry.
    weather_stress = max(0.0, (abs(env["outside_temp_c"]) - 35) / 30) + max(0.0, (env["wind_knots"] - 35) / 55)
    energy["efficiency_pct"] = round(max(35.0, min(98.0, energy["generator_output_kw"] / max(energy["power_consumption_kw"], 1) * 100 - weather_stress * 4)), 1)
    fuel_runway = round(energy["fuel_level_pct"] * 0.25, 1)
    risk_score = 10 + weather_stress * 25
    if energy["generator_output_kw"] < energy["power_consumption_kw"]:
        risk_score += 30
    if energy["fuel_level_pct"] < 30:
        risk_score += 25
    if station["personnel"]["unaccounted"]:
        risk_score += 8
    if scenario in {"SUPPLY_DELAY", "MEDICAL_SURGE"}:
        risk_score += 16
    if scenario == "COMMS_OUTAGE":
        risk_score += 12
    if scenario in {"GEN_FAILURE", "FUEL_FREEZE"}:
        risk_score = max(risk_score, 70)
    risk_score = int(max(0, min(100, round(risk_score))))
    risk_level = "CRITICAL" if risk_score >= 70 else "HIGH" if risk_score >= 50 else "MEDIUM" if risk_score >= 30 else "LOW"
    station["station_health"] = "CRITICAL" if risk_level == "CRITICAL" else "WARNING" if risk_level in {"HIGH", "MEDIUM"} else "HEALTHY"
    factors = [
        {"factor": "environmental_stress", "contribution": round(weather_stress * 25, 1), "evidence": f"{env['outside_temp_c']}°C, {env['wind_knots']} kt"},
        {"factor": "energy_margin", "contribution": 30 if energy["generator_output_kw"] < energy["power_consumption_kw"] else 0, "evidence": f"{energy['generator_output_kw'] - energy['power_consumption_kw']} kW net"},
        {"factor": "fuel_runway", "contribution": 25 if energy["fuel_level_pct"] < 30 else 0, "evidence": f"{fuel_runway} days estimated"},
        {"factor": "personnel_accountability", "contribution": 8 if station["personnel"]["unaccounted"] else 0, "evidence": f"{station['personnel']['unaccounted']} unaccounted"},
    ]
    station["risk"] = {"score": risk_score, "level": risk_level, "drivers": [item for item in factors if item["contribution"] > 0]}
    station["explainability"] = {"method": "deterministic causal model", "factors": factors, "recommendation": "Prioritize fuel and generator inspection." if risk_score >= 30 else "Continue scheduled operations."}
    station["domains"]["risk"] = {"status": risk_level, "score": risk_score}
    station["domains"]["environment"] = {"status": "WARNING" if weather_stress > 0.5 else "NORMAL", "temperature_c": env["outside_temp_c"]}
    station["domains"]["weather"] = {"status": "WARNING" if env["visibility_km"] < 5 else "NORMAL", "visibility_km": env["visibility_km"]}
    station["domains"]["energy"] = {"status": "CRITICAL" if energy["generator_output_kw"] < energy["power_consumption_kw"] else "NORMAL", "net_power_kw": energy["generator_output_kw"] - energy["power_consumption_kw"]}
    station["domains"]["fuel"] = {"status": "CRITICAL" if energy["fuel_level_pct"] < 25 else "WARNING" if energy["fuel_level_pct"] < 40 else "NORMAL", "reserve_pct": energy["fuel_level_pct"], "runway_days": fuel_runway}
    station["domains"]["generator"] = {"status": machines["gen1"]["status"], "output_kw": energy["generator_output_kw"]}
    station["domains"]["communications"] = {"status": "NORMAL" if station["satellite_online"] else "DEGRADED"}
    station["domains"]["logistics"] = {"status": "WARNING" if scenario == "SUPPLY_DELAY" else "NORMAL", "food_days": station["inventory"][1]["value"], "medical_days": station["inventory"][2]["value"]}
    values = {
        "outside_temp_c": env["outside_temp_c"],
        "wind_knots": env["wind_knots"],
        "generator_output_kw": energy["generator_output_kw"],
        "fuel_level_pct": energy["fuel_level_pct"],
        "battery_level_pct": energy["battery_level_pct"],
        "pressure_hpa": env["pressure_hpa"],
    }
    profile = STATION_PROFILES[station["station"]]
    station_baseline = {
        "outside_temp_c": [profile["temp"] - 0.4, profile["temp"] + 0.2, profile["temp"] - 0.1, profile["temp"] + 0.3, profile["temp"]],
        "wind_knots": [profile["wind"] - 1, profile["wind"] + 1, profile["wind"], profile["wind"] - 0.5, profile["wind"] + 0.5],
        "generator_output_kw": [profile["output"] - 4, profile["output"] + 2, profile["output"] - 1, profile["output"] + 1, profile["output"]],
        "fuel_level_pct": [profile["fuel"] + 2, profile["fuel"] + 1, profile["fuel"] + 1, profile["fuel"] + 0.5, profile["fuel"]],
        "battery_level_pct": [86 if station["station"] == "BHARATI_STATION" else 79, 85 if station["station"] == "BHARATI_STATION" else 78, 86 if station["station"] == "BHARATI_STATION" else 79, 85 if station["station"] == "BHARATI_STATION" else 78, 86 if station["station"] == "BHARATI_STATION" else 79],
        "pressure_hpa": [profile["pressure"] + 2, profile["pressure"] + 1, profile["pressure"], profile["pressure"] + 1, profile["pressure"]],
    }
    station["anomalies"] = detect_anomalies(values, baseline=station_baseline)
    station["energy"]["anomaly"] = station["anomalies"]["anomalies"][0]["explanation"] if station["anomalies"]["anomalies"] else "No active anomaly."
    station["causal_chain"] = [
        {"id": "environment", "name": "Environment", "status": station["domains"]["environment"]["status"], "output": {"weather_stress": round(weather_stress, 2)}, "explanation": "Temperature, wind and visibility determine operational stress."},
        {"id": "energy", "name": "Energy", "status": station["domains"]["energy"]["status"], "input": "environment", "output": {"net_power_kw": energy["generator_output_kw"] - energy["power_consumption_kw"]}, "explanation": "Environmental stress changes heating demand and power margin."},
        {"id": "generator", "name": "Generator", "status": machines["gen1"]["status"], "input": "energy", "output": {"output_kw": energy["generator_output_kw"]}, "explanation": "Generator capacity is compared with station load."},
        {"id": "fuel", "name": "Fuel", "status": station["domains"]["fuel"]["status"], "input": "generator", "output": {"runway_days": fuel_runway}, "explanation": "Generation rate consumes fuel and determines runway."},
        {"id": "logistics", "name": "Logistics", "status": station["domains"]["logistics"]["status"], "input": "fuel", "output": {"resupply_days": station["inventory"][1]["value"]}, "explanation": "Runway and weather affect resupply planning."},
        {"id": "risk", "name": "Risk", "status": risk_level, "input": "logistics", "output": {"score": risk_score}, "explanation": "Transparent weighted factors produce the operational risk score."},
    ]
    station["chain"] = station["causal_chain"]


station_states = {station_id: _build_station(station_id) for station_id in STATION_PROFILES}
state: Dict[str, Any] = copy.deepcopy(station_states["BHARATI_STATION"])


def _save_active_state() -> None:
    station_states[state["station"]] = copy.deepcopy(state)


def _activate_station(station_id: str) -> Dict[str, Any]:
    station_id = _station_id(station_id)
    if not station_id:
        raise ValueError("station must be BHARATI_STATION or MAITRI_STATION")
    state.clear()
    state.update(copy.deepcopy(station_states[station_id]))
    return state


def _apply_scenario(scenario: str) -> Dict[str, Any]:
    scenario = str(scenario or "").strip().upper()
    if scenario not in SCENARIO_PRESETS:
        raise ValueError(f"unknown scenario: {scenario}")
    station_id = state["station"]
    fresh = _build_station(station_id)
    fresh["active_scenario"] = scenario
    if scenario == "BLIZZARD":
        fresh["environment"].update({"outside_temp_c": -54.0, "wind_knots": 72.0, "visibility_km": 0.8})
        fresh["machines"]["hvac"].update({"status": "WARNING", "metric_1_val": 16.4})
    elif scenario == "GEN_FAILURE":
        fresh["machines"]["gen1"].update({"status": "CRITICAL", "metric_1_val": 96.8, "metric_2_val": 76.5})
        fresh["energy"].update({"generator_output_kw": 188, "power_consumption_kw": 356})
    elif scenario == "FUEL_FREEZE":
        fresh["machines"]["fuel"].update({"status": "CRITICAL", "metric_2_val": -28.4})
        fresh["energy"]["fuel_level_pct"] = 21
    elif scenario == "EXTREME_COLD":
        fresh["environment"].update({"outside_temp_c": -62.0, "wind_knots": 46.0})
        fresh["energy"]["power_consumption_kw"] += 54
    elif scenario == "SUPPLY_DELAY":
        fresh["inventory"][1].update({"value": 12, "status": "WARNING", "runway": "12 days"})
    elif scenario == "MEDICAL_SURGE":
        fresh["inventory"][2].update({"value": 5, "status": "CRITICAL", "runway": "5 days"})
        fresh["personnel"]["medical"] = 4
    elif scenario == "COMMS_OUTAGE":
        fresh["satellite_online"] = False
        fresh["offline_mesh"] = _mesh_metadata(STATION_PROFILES[station_id], online=False)
    _derive(fresh)
    state.clear()
    state.update(fresh)
    _save_active_state()
    return state


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        for conn in list(self.active):
            try:
                await conn.send_json(payload)
            except Exception:
                self.disconnect(conn)


manager = ConnectionManager()


def get_full_payload() -> Dict[str, Any]:
    # Micro-fluctuations across all nominal machines so all graphs tick live
    m = state.get("machines", {})
    if m.get("gen1", {}).get("status") == "NORMAL":
        m["gen1"]["metric_1_val"] = round(81.2 + random.uniform(-0.3, 0.3), 1)
        m["gen1"]["metric_2_val"] = round(49.8 + random.uniform(-0.2, 0.2), 1)
    if m.get("water", {}).get("status") == "NORMAL":
        m["water"]["metric_2_val"] = round(14.2 + random.uniform(-0.4, 0.4), 1)
    if m.get("hvac", {}).get("status") == "NORMAL":
        m["hvac"]["metric_1_val"] = round(21.2 + random.uniform(-0.2, 0.2), 1)

    payload = copy.deepcopy(state)
    payload["timestamp"] = datetime.now(timezone.utc).isoformat()
    payload["domain_count"] = len(payload.get("domains", {}))
    return payload


@app.get("/")
def read_root() -> Dict[str, str]:
    return {"status": "ONLINE", "station": "BHARATI_ANTARCTICA"}


@app.get("/api/state")
@app.get("/api/twin")
@app.get("/api/telemetry")
def get_state() -> Dict[str, Any]:
    return get_full_payload()


@app.get("/api/stations")
def list_stations() -> Dict[str, Any]:
    return {
        "active": state["station"],
        "stations": [
            {"id": station_id, "label": profile["label"], "location": profile["location"]}
            for station_id, profile in STATION_PROFILES.items()
        ],
    }


@app.get("/api/station")
def get_station() -> Dict[str, Any]:
    return {"station": state["station"], "station_label": state["station_label"], "state": get_full_payload()}


@app.post("/api/station/switch")
@app.post("/api/station")
async def switch_station(req: StationRequest) -> Dict[str, Any]:
    selected = req.station_id or req.station
    try:
        _activate_station(selected or "")
    except ValueError as exc:
        return {"status": "ERROR", "message": str(exc), "available": list(STATION_PROFILES)}
    await manager.broadcast(get_full_payload())
    return {"status": "ACK", "station": state["station"], "state": get_full_payload()}


@app.post("/api/scenario")
async def trigger_scenario(req: ScenarioRequest) -> Dict[str, Any]:
    try:
        _apply_scenario(req.scenario)
    except ValueError as exc:
        return {"status": "ERROR", "message": str(exc), "available": list(SCENARIO_PRESETS)}
    await manager.broadcast(get_full_payload())
    return {"status": "ACK", "active": state["active_scenario"], "risk": state["risk"], "state": get_full_payload()}


@app.get("/api/scenarios")
@app.get("/api/what-if")
def list_scenarios() -> Dict[str, Any]:
    return {"presets": [{"id": key, **value} for key, value in SCENARIO_PRESETS.items()], "count": len(SCENARIO_PRESETS)}


@app.post("/api/what-if")
async def run_what_if(req: ScenarioRequest) -> Dict[str, Any]:
    before = get_full_payload()
    try:
        _apply_scenario(req.scenario)
    except ValueError as exc:
        return {"status": "ERROR", "message": str(exc), "available": list(SCENARIO_PRESETS)}
    result = get_full_payload()
    # A what-if is explicitly non-destructive.
    state.clear()
    before.pop("timestamp", None)
    state.update(before)
    _save_active_state()
    return {"status": "OK", "scenario": req.scenario.upper(), "baseline_risk": before["risk"], "projected": result}


@app.get("/api/analytics")
def analytics(domain: Optional[str] = None) -> Dict[str, Any]:
    domains = state["domains"]
    if domain:
        key = domain.strip().lower()
        return {"station": state["station"], "domain": key, "data": domains.get(key, {}), "exists": key in domains}
    return {
        "station": state["station"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "domain_count": len(domains),
        "domains": copy.deepcopy(domains),
        "energy_trend_24h": [{"hour": hour, "load_kw": state["energy"]["power_consumption_kw"] + ((hour % 5) - 2) * 3} for hour in range(24)],
        "risk": copy.deepcopy(state["risk"]),
    }


@app.get("/api/risk")
def risk() -> Dict[str, Any]:
    return {"station": state["station"], "risk": copy.deepcopy(state["risk"]), "explainability": copy.deepcopy(state["explainability"])}


@app.get("/api/explainability")
def explainability() -> Dict[str, Any]:
    return copy.deepcopy(state["explainability"])


@app.get("/api/anomalies")
def anomalies() -> Dict[str, Any]:
    return {"station": state["station"], **copy.deepcopy(state["anomalies"]), "hard_limits": HARD_LIMITS}


@app.get("/api/mesh")
def mesh() -> Dict[str, Any]:
    return {"station": state["station"], **copy.deepcopy(state["offline_mesh"])}


@app.get("/api/architecture")
def architecture_status() -> Dict[str, Any]:
    """Expose the four-layer digital-twin reference stack for operators."""
    return {
        "station": state["station"],
        "layers": [
            {"id": "acquisition", "name": "Data Acquisition", "protocols": ["MQTT", "BLE", "edge sensors"], "status": "LIVE", "signal_count": 42},
            {"id": "integration", "name": "Integration / Communication", "protocols": ["WebSocket", "Delta Sync", "IndexedDB"], "status": "SYNC", "bandwidth_kbps": 256},
            {"id": "twin", "name": "Virtual Representation", "protocols": ["Three.js", "Room Twin", "Causal Graph"], "status": "IN_SYNC", "asset_count": len(state.get("machines", {})) + 14},
            {"id": "applications", "name": "Control / Applications", "protocols": ["Data Core", "Alerts", "Directives"], "status": "READY", "role_views": 3},
        ],
        "feedback_loop": ["telemetry", "normalized_state", "twin_update", "recommendation", "operator_directive"],
        "simulation": {"active_scenario": state.get("active_scenario", "NOMINAL"), "offline_first": True},
    }


def _room_payload(station_id: str, room_id: Optional[str] = None, cause: Optional[str] = None) -> Dict[str, Any]:
    rooms = []
    for index, (identifier, name, room_type, occupants, baseline) in enumerate(ROOM_BLUEPRINTS[station_id]):
        active = identifier == room_id
        temperature = baseline - 6.5 if active and cause else baseline
        rooms.append({
            "id": identifier, "name": name, "type": room_type, "occupants": occupants,
            "temperature_c": round(temperature, 1), "humidity_pct": 38 + index * 3,
            "heater": not (active and cause == "POWER_LOSS"),
            "fan": True, "lights": not (active and cause == "POWER_LOSS"),
            "power_kw": 0.35 if active and cause == "POWER_LOSS" else round(1.4 + (index % 3) * 0.35, 2),
            "alert": cause if active else None,
        })
    return {"station": station_id, "prototype": True, "rooms": rooms}


@app.get("/api/rooms")
def rooms(station: Optional[str] = None) -> Dict[str, Any]:
    station_id = STATION_ALIASES.get((station or state["station"]).upper(), state["station"])
    return _room_payload(station_id)


@app.get("/api/rooms/{room_id}")
def room(room_id: str) -> Dict[str, Any]:
    station_id = state["station"]
    if not any(item[0] == room_id for item in ROOM_BLUEPRINTS[station_id]):
        return {"station": station_id, "room_id": room_id, "error": "Room not found"}
    payload = _room_payload(station_id, room_id)
    return {"station": station_id, "room": next(item for item in payload["rooms"] if item["id"] == room_id)}


@app.post("/api/rooms/{room_id}/demo")
def room_demo(room_id: str, request: RoomDemoRequest) -> Dict[str, Any]:
    cause = request.cause.upper()
    if cause not in {"HEATER_FAULT", "POWER_LOSS", "DOOR_OPEN"}:
        return {"error": "Unsupported demo cause", "supported": ["HEATER_FAULT", "POWER_LOSS", "DOOR_OPEN"]}
    payload = _room_payload(state["station"], room_id, cause)
    selected = next((item for item in payload["rooms"] if item["id"] == room_id), None)
    if selected is None:
        return {"station": state["station"], "room_id": room_id, "error": "Room not found"}
    return {"station": state["station"], "simulated": True, "cause": cause, "room": selected}


@app.get("/api/ingestion/status")
def ingestion_status() -> Dict[str, Any]:
    return {
        "station": state["station"],
        "transport": "MQTT / WebSocket bridge (prototype)",
        "edge_node": state.get("offline_mesh", {}).get("mesh_id", "polar-mesh"),
        "connected_sensors": 42,
        "last_packet": datetime.now(timezone.utc).isoformat(),
        "queue_depth": state.get("offline_mesh", {}).get("queued_deltas", 0),
        "mode": "OFFLINE_FIRST",
    }


@app.get("/api/dataops/status")
def dataops_status() -> Dict[str, Any]:
    return {
        "schema": "PolarCore Telemetry Schema v2",
        "normalization": "ACTIVE",
        "domains": len(state.get("domains", {})),
        "last_validation": datetime.now(timezone.utc).isoformat(),
        "quality": "GOOD",
        "retention": "EDGE CACHE + STATION DATABASE",
    }


def _weather_payload(live: bool = False) -> Dict[str, Any]:
    fallback = {
        "station": state["station"],
        "source": "deterministic-offline-fallback",
        "fallback": True,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        **copy.deepcopy(state["environment"]),
    }
    if not live:
        return fallback
    profile = STATION_PROFILES[state["station"]]
    query = urlencode({"latitude": profile["location"]["latitude"], "longitude": profile["location"]["longitude"], "current": "temperature_2m,wind_speed_10m,visibility,relative_humidity_2m,surface_pressure", "wind_speed_unit": "kn"})
    try:
        request = Request(f"https://api.open-meteo.com/v1/forecast?{query}", headers={"User-Agent": "PolarCore/2.0"})
        with urlopen(request, timeout=2) as response:
            current = json.loads(response.read().decode("utf-8")).get("current", {})
        return {"station": state["station"], "source": "open-meteo", "fallback": False, "observed_at": datetime.now(timezone.utc).isoformat(), **current}
    except Exception:
        return fallback


@app.get("/api/weather")
def weather(live: bool = False) -> Dict[str, Any]:
    return _weather_payload(live=live)


@app.get("/api/weather/live")
def live_weather() -> Dict[str, Any]:
    return _weather_payload(live=True)


@app.post("/api/directive/dispatch")
async def dispatch_directive(payload: Dict[str, Any]) -> Dict[str, Any]:
    machine_id = payload.get("machine_id", "gen1")
    if machine_id in state["machines"]:
        state["machines"][machine_id]["status"] = "NORMAL"
        _derive(state)
        _save_active_state()
    await manager.broadcast(get_full_payload())
    return {"status": "SUCCESS", "message": f"Directive executed for {machine_id}"}


def _copilot_answer(question: str) -> Dict[str, Any]:
    text = question.lower()
    if "fail" in text or "generator" in text:
        answer = "The primary current risk is the generator chain. Inspect the cooling loop and prepare backup power."
    elif "risk" in text or "biggest" in text:
        answer = f"The current risk is {state['risk']['level']} ({state['risk']['score']}/100). " + state["explainability"]["recommendation"]
    elif "weather" in text or "outside" in text:
        env = state["environment"]
        answer = f"External conditions are {env['outside_temp_c']}°C with {env['wind_knots']} kt winds and {env['visibility_km']} km visibility."
    elif "runway" in text or "fuel" in text:
        answer = f"Fuel is at {state['energy']['fuel_level_pct']}% with an estimated {state['domains']['fuel']['runway_days']} day runway."
    else:
        answer = f"{state['station_label']} is {state['station_health'].lower()} with {len(state['domains'])} monitored domains. Ask about risk, generators, weather, or runway."
    return {"answer": answer, "source": "PolarCore local decision rules", "confidence": 0.91, "station": state["station"], "risk": state["risk"]}


@app.post("/api/copilot")
async def copilot(req: CopilotRequest) -> Dict[str, Any]:
    return _copilot_answer(req.question)


@app.get("/api/copilot")
async def copilot_get(question: str = "") -> Dict[str, Any]:
    return _copilot_answer(question)


@app.post("/api/assistant")
async def station_assistant(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _copilot_answer(str(payload.get("question", "")))


@app.websocket("/ws/telemetry")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await ws.send_json(get_full_payload())
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        manager.disconnect(ws)