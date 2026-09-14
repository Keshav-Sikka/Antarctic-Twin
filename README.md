# 🇦🇶 PolarCore: Antarctic Digital Twin & Mission Control

An edge-native 3D digital twin and remote telemetry operations dashboard for
India's Antarctic research stations, **Bharati** and **Maitri**. Built for
**Smart India Hackathon 2026 (Problem Statement ID: SIH26060)** under the
**Ministry of Earth Sciences (MoES) / NCPOR**.

## Showcase Link

- **Local showcase:** <http://localhost:5175/>

Start the frontend with `npm run dev -- --port 5175` from the `frontend/`
directory before opening the link. This address is available only on the
computer running the local development server; it is not a public URL.

## Quick Start

### Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- npm

### 1. Start the backend

From the project root:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

**macOS/Linux**

```bash
source venv/bin/activate
```

**Windows**

```powershell
venv\Scripts\activate
```

Install dependencies and start the FastAPI telemetry server:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend is available at <http://localhost:8000>.

Interactive API documentation is available at <http://localhost:8000/docs>.

### 2. Start the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the dashboard at <http://localhost:5175/>.

## System Architecture & Features

### 1. AR spatial twin

Interactive Three.js 3D models represent both station environments:

- **Bharati:** An aerodynamic, cantilevered design on the Larsemann Hills snow
  plateau.
- **Maitri:** A modular U-shaped layout on the Schirmacher Oasis rocky
  permafrost.

### 2. Subsystem telemetry HUD

The dashboard displays live simulated telemetry and animated line graphs for:

- Diesel generators
- Fuel tanks
- Snow melter and recycling systems
- Life-support HVAC

### 3. Deterministic causal engine

The data engine models cascading operational effects across station domains,
including thermal load, weather stress, energy demand, and fuel depletion. It
also supports statistical Z-score outlier detection without requiring cloud
latency.

### 4. What-if contingency engine

The prototype includes simulations for polar contingencies such as:

- Blizzard conditions at 72 knots
- Thermal runaway
- Fuel-line freeze
- Supply delay

### 5. Emergency directive dispatch

Operators can inspect 2D technical schematic cutaways and dispatch an override
directive for a selected subsystem.

### 6. Data core

PolarCore tracks 16 station domains, logistics depletion runways, risk
explainability, and local rules-based Copilot queries.

### 7. Simulated live timeline

The dashboard includes a demonstration timeline for rehearsing Antarctic
operations across changing conditions:

- Play/pause simulated station time.
- Run the timeline at `1X`, `10X`, `60X`, or `240X`.
- Derive temperature, wind, visibility, snow accumulation, energy demand,
  generator output, fuel reserve, and equipment health from the simulated
  date and active contingency.
- Use the timeline to demonstrate day/night load changes and winter stress
  without requiring a live weather API.

### 8. Event-driven alert center

Alerts are separated from the 3D experience so normal warnings do not
interrupt the operator. The Data Core lists cause, impact, and recommended
action for fuel, food, medical supplies, personnel check-in, generator health,
weather, and contingency events. Only new critical anomalies or active
emergency scenarios trigger the prominent popup alert.

### 9. Decision-support operations suite

The Data Core includes judge-facing operational tools:

- **Weather-aware task scheduler:** restricts exterior maintenance when wind or
  visibility crosses the safety threshold and recommends indoor work.
- **Fuel burn-rate predictor:** estimates remaining runway from fuel reserves
  and current heating load.
- **Madrid Protocol demonstration export:** downloads a CSV report containing
  simulated fuel, energy, environment, and alert metrics.
- **Shift handover log:** stores incoming-shift notes locally with `LOW`,
  `MEDIUM`, or `CRITICAL` priority.
- **Role-view prototype:** switches between Station Leader, NCPOR HQ, and
  Researcher perspectives. This is a presentation feature, not production
  authentication or authorization.

All analytics and reports are explicitly demonstration outputs based on
simulated telemetry.

## Quick Q&A

### Are we running an external LLM for the AI Copilot and risk predictions?

No. Antarctic operations may rely on high-latency, 256 kbps satellite links,
so the prototype runs its intelligence locally using deterministic causal
graphs and statistical Z-score outlier detection (`Z ≥ 3.0`). Fuel runway and
risk scores can be calculated without an internet connection.

### How does the 3D model scale over poor Antarctic satellite bandwidth?

The application does not stream 3D pixels or video. Three.js renders the
geometry in the client browser, while the station link transmits only compact
JSON telemetry packets.

### What happens if the satellite link drops during a blizzard?

The system follows an offline-first store-and-forward approach called
**Project Mesh-Zero**. Local station services can buffer sensor readings, then
backfill missing telemetry when the satellite handshake is restored.

### Why use procedural geometry instead of pre-rendered 3D assets?

Procedural WebGL geometry reduces network overhead, supports programmatic
cutaways such as roof fading during close inspection, and allows mesh colors to
change with subsystem telemetry.

## Project Structure

```text
.
├── backend/
│   ├── main.py
│   └── requirements.txt
├── docs/
│   └── SENSOR_SCHEMA.md
└── frontend/
    ├── public/
    │   └── blueprints/
    └── src/
        ├── components/
        ├── App.jsx
        └── index.css
```

## Station Operations

The 3D station view is the primary operator experience:

- Use the **BHARATI** and **MAITRI** buttons in the top-right station selector
  to switch location and telemetry.
- Click a building subsystem to inspect its status, metrics, and schematic.
- Use the compact **Contingency Vector** controls in the lower corner to
  simulate nominal operations, blizzards, generator failure, or fuel-line
  freeze.
- Open **Data Core** for the complete station data view, including energy,
  environment, alerts, logistics, personnel, Station AI, causal intelligence,
  what-if projections, timeline controls, and the operations suite.

### Room-scale digital twin

The **Room Twin** view provides a prototype room-level operations layer for
both stations. Each station has seven named rooms with simulated temperature,
humidity, occupancy, heater, ventilation fan, lighting, and power-load signals.
Select a room to inspect its telemetry and toggle devices to demonstrate load
changes.

The **Live Fault Demo** can drop a selected room's temperature and explain
three deterministic demonstration causes: heater damage, local power loss, or
an open door/insulation leak. This is simulated decision-support telemetry,
not a safety forecast. The room plan must be verified against official station
CAD/BIM documentation before operational use.

## Demo Flow

For a concise judge demonstration:

1. Start in the **AR Spatial Twin** view and switch between **BHARATI** and
   **MAITRI**.
2. Select `60X` on the simulated timeline to show telemetry changing over
   Antarctic time.
3. Trigger **BLIZZARD** or **GEN FAIL** from the compact Contingency Vector
   and show the event-driven critical alert.
4. Open **Data Core** to explain the weather scheduler, fuel runway forecast,
   causal graph, and recommended action.
5. Change the role to **NCPOR HQ** and export the simulated compliance CSV.
6. Add a critical note in the **Shift Handover Log** to demonstrate continuity
   between station shifts.

## Mobile and Android

The interface is responsive for phone-sized screens:

- The station model remains the main visual surface.
- Station selection and contingency controls remain accessible without
  covering the building.
- Data Core panels stack vertically for touch scrolling.
- Three.js lowers pixel density and snow-particle count on compact screens.

An Android debug APK can be built with Capacitor:

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The generated APK is written to
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

The Capacitor app configuration is stored in
`frontend/capacitor.config.json`. The Android build is a prototype wrapper
around the same responsive web dashboard.

## Backend API

The prototype exposes these core endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/state` | Read the active station state |
| `POST /api/station/switch` | Switch between Bharati and Maitri |
| `POST /api/scenario` | Apply a contingency scenario |
| `POST /api/what-if` | Project a contingency outcome |
| `POST /api/assistant` | Ask the local Station AI |
| `GET /api/heartbeat` | Return lightweight service health |
| `POST /api/sync/delta` | Submit queued telemetry deltas |
| `WS /ws/telemetry` | Receive simulated telemetry updates |

## Offline-First Edge Design

PolarCore is designed for intermittent Antarctic satellite connectivity:

1. Cache the last-known-good telemetry state in IndexedDB.
2. Keep the interface usable when the backend is unavailable.
3. Queue local changes as compact telemetry deltas.
4. Flush queued deltas when connectivity returns.
5. Report link state, sync status, and degraded operation to the operator.

The prototype uses local deterministic rules rather than requiring an external
LLM or live weather API for core decision-support behavior.

## License

This project is a Smart India Hackathon prototype for demonstration and
evaluation purposes.
