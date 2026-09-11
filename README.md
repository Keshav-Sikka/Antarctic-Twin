# 🇦🇶 POLARCORE: Antarctic Digital Twin & Mission Control

An edge-native 3D AR Digital Twin and remote telemetry operations dashboard for India's Antarctic research stations (**Bharati** and **Maitri**). Built for **Smart India Hackathon 2026 (Problem Statement ID: SIH26060)** under the **Ministry of Earth Sciences (MoES) / NCPOR**.

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

---

### 1. Backend Engine (FastAPI & Telemetry WebSocket)
Open a terminal in the project root:

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000

Backend API will start at: http://localhost:8000

Interactive API Docs: http://localhost:8000/docs

### 2. Frontend Application (React, Three.js, Tailwind HUD)
Open a second terminal in the project root:

``` bash

cd frontend
npm install
npm run dev

Open your browser and navigate to: http://localhost:5173/

### 🧭 System Architecture & Features

1) AR Spatial Twin: Interactive edge-to-edge Three.js 3D models of Bharati (aerodynamic cantilevered design on Larsemann Hills snow plateau) and Maitri (modular U-shaped layout on Schirmacher Oasis rocky permafrost).

2) Subsystem Telemetry HUD: Real-time micro-fluctuating sensor metrics and animated seismometer line graphs for Diesel Gen, Fuel Tanks, Snow Melter, and Life Support HVAC.

3) Deterministic Causal Engine: Multi-domain causal inference and Z-score outlier detection simulating cascading failures (thermal load, weather stress, fuel depletion) without cloud latency.

4) What-If Contingency Engine: Instant simulation of polar crises (BLIZZARD 72KT, THERMAL RUNAWAY, LINE FREEZE, SUPPLY DELAY).

5) Emergency Directive Dispatch: 2D technical schematic cutaways with override controls executing instant mechanical recovery protocols.

6) Data Core: Enterprise mission control tracking 16 station domains, logistics depletion runways, and local rules-based Copilot queries.

---

### Quick Q&A

Q1: "Are we running an external LLM for the AI Copilot and risk predictions?"
> A: No. Antarctica operates over high-latency, 256 kbps satellite links that cannot stream tokens. Our intelligence runs 100% locally via deterministic causal graphs and statistical Z-score outlier detection ($Z \ge 3.0$), computing fuel runway and risk scores in under 5 milliseconds with zero internet dependency.

Q2: "How does this 3D model scale over poor Antarctic satellite bandwidth?"
> A: We do not stream 3D pixels or video. The Three.js engine and CAD geometry run entirely inside the client browser cache. The satellite link transmits only tiny, delta-compressed JSON telemetry packets (< 1.5 KB/s), consuming less than 5% of a standard 256 kbps polar link.

Q3: "What happens if the satellite link drops entirely during a blizzard?"
> A: The system operates on an offline-first Store-and-Forward architecture (Project Mesh-Zero). Local PLCs buffer all sensor readings on-station; once satellite handshake re-establishes, missing historical data is backfilled using a conflict-free merge window.

Q4: "Why procedural geometry instead of pre-rendered 3D assets?"
> A: Procedural WebGL enables instant loading with zero network overhead, programmatic cutaways (smart roof fading on camera proximity), and real-time mesh color shifts linked to dynamic sensor telemetry.

