# Antarctic Digital Twin Telemetry Specification

## 1. System Overview
This JSON schema connects the simulated station sensors, the backend API, and the 3D visual frontend.

```json
{
  "station": "BHARATI",
  "timestamp": "2026-09-11T12:00:00Z",
  "satellite_online": true,
  "environment": {
    "outside_temp_c": -42.0,
    "wind_knots": 35.0
  },
  "machines": {
    "gen1": {
      "name": "Primary Diesel Generator",
      "mesh_id": "mesh_gen1",
      "temp_c": 81.2,
      "vibration_hz": 49.9,
      "status": "NORMAL"
    },
    "fuel": {
      "name": "Main Fuel Reserves",
      "mesh_id": "mesh_fuel",
      "liters_remaining": 124500,
      "line_temp_c": -4.5,
      "status": "NORMAL"
    },
    "water": {
      "name": "Snow Melt & Filtration Unit",
      "mesh_id": "mesh_water",
      "tank_level_pct": 88.0,
      "status": "NORMAL"
    },
    "hvac": {
      "name": "Central Habitat HVAC",
      "mesh_id": "mesh_hvac",
      "indoor_temp_c": 21.5,
      "status": "NORMAL"
    }
  }
}

2. Status Color Rules
NORMAL -> Mesh color: #10B981 (Green / Default metal material)

WARNING -> Mesh color: #F59E0B (Amber / High alert)

CRITICAL -> Mesh color: #EF4444 (Red / Blinking animation)

3. Machine Click Action (Frontend Interaction)
When a user clicks any 3D machine:

Match the clicked 3D object to its mesh_id.

Smoothly animate the camera toward the selected machine.

Open the right-hand panel displaying:

Real-time parameter gauges (from the telemetry payload above).

2D Blueprint image (/blueprints/<mesh_id>.png).

"Dispatch Directive to Station" action button.

4. Crisis Simulation Endpoints (Backend)
POST /api/simulate/crisis?type=GEN_OVERHEAT -> Forces gen1.temp_c to 96°C and sets status: CRITICAL.

POST /api/simulate/crisis?type=FUEL_FREEZE -> Forces fuel.line_temp_c to -25°C and sets status: WARNING.

POST /api/simulate/reset -> Returns all machines to nominal states.

---

### Simplified 3-Day Action Plan

To avoid unnecessary complexity, focus on these four tasks:
1. **Frontend Visuals (Days 1–2):** Drop a low-poly room model into Three.js/React-Three-Fiber. Add 4 simple 3D primitives or free `.glb` blocks for the machines, tag their names with `mesh_id`, and attach click handlers.
2. **Right-Hand HUD Panel (Day 2):** Build a sidebar that updates with machine metrics and loads an image blueprint when a machine is clicked.
3. **Backend & Crisis Toggle (Day 2):** Use a clean FastAPI backend with a dictionary holding current telemetry and simple crisis endpoints (`/api/simulate/crisis`).
4. **Rehearsal & Video Fallback (Day 3):** Screen-record the full sequence in 1080p MP4. Drill the team so everyone speaks concisely on their designated component.