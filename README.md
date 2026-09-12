# 🇦🇶 PolarCore: Antarctic Digital Twin & Mission Control

An edge-native 3D digital twin and remote telemetry operations dashboard for
India's Antarctic research stations, **Bharati** and **Maitri**. Built for
**Smart India Hackathon 2026 (Problem Statement ID: SIH26060)** under the
**Ministry of Earth Sciences (MoES) / NCPOR**.

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

Open the dashboard at <http://localhost:5173>.

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

## License

This project is a Smart India Hackathon prototype for demonstration and
evaluation purposes.
