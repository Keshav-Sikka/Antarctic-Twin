import asyncio
import random
from datetime import datetime, timezone
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MoES Bharati Digital Twin Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScenarioRequest(BaseModel):
    scenario: str  # NOMINAL, BLIZZARD, GEN_FAILURE, FUEL_FREEZE

# Current digital twin state
state = {
    "station": "BHARATI_STATION",
    "active_scenario": "NOMINAL",
    "satellite_online": True,
    "environment": {
        "outside_temp_c": -38.5,
        "wind_knots": 28.0
    },
    "machines": {
        "gen1": {
            "id": "gen1",
            "name": "Diesel Generator #1",
            "mesh_id": "mesh_gen1",
            "metric_1_name": "Core Temp",
            "metric_1_val": 81.4,
            "metric_1_unit": "°C",
            "metric_2_name": "Vibration",
            "metric_2_val": 49.8,
            "metric_2_unit": "Hz",
            "status": "NORMAL"
        },
        "fuel": {
            "id": "fuel",
            "name": "Main Fuel Tanks",
            "mesh_id": "mesh_fuel",
            "metric_1_name": "Reserve",
            "metric_1_val": 124500,
            "metric_1_unit": "L",
            "metric_2_name": "Line Temp",
            "metric_2_val": -4.2,
            "metric_2_unit": "°C",
            "status": "NORMAL"
        },
        "water": {
            "id": "water",
            "name": "Snow Melter & Recycling",
            "mesh_id": "mesh_water",
            "metric_1_name": "Storage",
            "metric_1_val": 88.5,
            "metric_1_unit": "%",
            "metric_2_name": "Flow Rate",
            "metric_2_val": 14.2,
            "metric_2_unit": "L/m",
            "status": "NORMAL"
        },
        "hvac": {
            "id": "hvac",
            "name": "Life Support HVAC",
            "mesh_id": "mesh_hvac",
            "metric_1_name": "Hab Temp",
            "metric_1_val": 21.2,
            "metric_1_unit": "°C",
            "metric_2_name": "Airflow",
            "metric_2_val": 1200,
            "metric_2_unit": "CFM",
            "status": "NORMAL"
        }
    }
}

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict):
        for conn in self.active:
            try:
                await conn.send_json(payload)
            except Exception:
                pass

manager = ConnectionManager()
@app.get("/")
def read_root():
    return {"status": "ONLINE", "station": "BHARATI_ANTARCTICA"}

@app.post("/api/scenario")
async def trigger_scenario(req: ScenarioRequest):
    state["active_scenario"] = req.scenario
    sc = req.scenario

    if sc == "NOMINAL":
        state["environment"]["outside_temp_c"] = -38.5
        state["environment"]["wind_knots"] = 28.0
        for m in state["machines"].values():
            m["status"] = "NORMAL"
        state["machines"]["gen1"]["metric_1_val"] = 81.4
        state["machines"]["gen1"]["metric_2_val"] = 49.8
        state["machines"]["fuel"]["metric_2_val"] = -4.2

    elif sc == "BLIZZARD":
        state["environment"]["outside_temp_c"] = -54.0
        state["environment"]["wind_knots"] = 72.0
        state["machines"]["hvac"]["status"] = "WARNING"
        state["machines"]["hvac"]["metric_1_val"] = 16.4

    elif sc == "GEN_FAILURE":
        state["machines"]["gen1"]["status"] = "CRITICAL"
        state["machines"]["gen1"]["metric_1_val"] = 96.8
        state["machines"]["gen1"]["metric_2_val"] = 76.5

    elif sc == "FUEL_FREEZE":
        state["machines"]["fuel"]["status"] = "CRITICAL"
        state["machines"]["fuel"]["metric_2_val"] = -28.4

    await manager.broadcast(get_full_payload())
    return {"status": "ACK", "active": req.scenario}

@app.post("/api/directive/dispatch")
async def dispatch_directive(payload: dict):
    machine_id = payload.get("machine_id", "gen1")
    if machine_id in state["machines"]:
        state["machines"][machine_id]["status"] = "NORMAL"
    await manager.broadcast(get_full_payload())
    return {"status": "SUCCESS", "message": f"Directive executed for {machine_id}"}

def get_full_payload():
    payload = dict(state)
    payload["timestamp"] = datetime.now(timezone.utc).isoformat()
    # Micro-fluctuations for realistic live gauges
    if state["active_scenario"] == "NOMINAL":
        state["machines"]["gen1"]["metric_1_val"] = round(81.0 + random.uniform(-0.4, 0.4), 1)
        state["machines"]["gen1"]["metric_2_val"] = round(49.8 + random.uniform(-0.3, 0.3), 1)
    return payload

@app.websocket("/ws/telemetry")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.send_json(get_full_payload())
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        manager.disconnect(ws)