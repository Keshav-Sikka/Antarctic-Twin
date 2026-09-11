# 🇦🇶 MoES Bharati Antarctic Station — 3D Digital Twin Platform

High-fidelity AR command center and low-bandwidth remote telemetry digital twin for Indian Antarctic research stations (Bharati & Maitri). Built for **Smart India Hackathon 2026 (Problem Statement ID: SIH26060)**.

---

## ⚡ Quick Start Installation Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

---

### 1. Backend Setup (FastAPI & Telemetry WebSocket Engine)

Open a terminal in the root directory:

```bash
cd backend
python -m venv venv

# Windows Activation:
venv\Scripts\activate

# Mac/Linux Activation:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000

Backend API will be running live at: http://localhost:8000

Interactive Swagger docs: http://localhost:8000/docs

2. Frontend Setup (React 18, Three.js & Tailwind AR HUD)
Open a second terminal:

cd frontend
npm install
npm run dev

Open your browser and navigate to: http://localhost:5173/

