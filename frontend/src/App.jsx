import React, { useState, useEffect, useRef } from 'react';
import ThreeScene from './components/ThreeScene';
import TelemetryCard from './components/TelemetryCard';
import BlueprintModal from './components/BlueprintModal';
import { ShieldAlert, Radio, Activity, Eye } from 'lucide-react';

const MACHINE_KEYS = ['gen1', 'fuel', 'water', 'hvac'];

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [selectedMachineId, setSelectedMachineId] = useState('gen1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState('NOMINAL');
  const [toastMessage, setToastMessage] = useState('SAT-LINK SECURED // BHARATI STATION (256 KBPS)');
  const wsRef = useRef(null);

  useEffect(() => {
    const connectWs = () => {
      wsRef.current = new WebSocket('ws://localhost:8000/ws/telemetry');
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setTelemetry(data);
      };
    };
    connectWs();
    return () => wsRef.current?.close();
  }, []);

  const triggerScenario = async (sc) => {
    setActiveScenario(sc);
    await fetch('http://localhost:8000/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: sc }),
    });
    setToastMessage(`CRISIS INJECTION ACTIVE: [${sc}]`);
  };

  const currentMachine = telemetry?.machines?.[selectedMachineId];

  return (
    <div className="relative w-screen h-screen overflow-hidden jarvis-scanlines select-none bg-[#070d18]">
      {/* Full-Screen 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <ThreeScene
          machines={telemetry?.machines}
          selectedMachineId={selectedMachineId}
          activeScenario={activeScenario}
          onMachineClick={(id) => {
            setSelectedMachineId(id);
            setIsModalOpen(true);
          }}
        />
      </div>

      {/* Top Mission Control Bar */}
      <header className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-[#070d18]/90 to-transparent px-8 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center space-x-3 pointer-events-auto">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <span className="font-mono font-bold tracking-widest text-sm text-cyan-200">MoES // BHARATI AR DIGITAL TWIN</span>
          <span className="text-[10px] bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 px-2.5 py-0.5 rounded font-mono">
            LARSEMANN HILLS 69°24'S
          </span>
        </div>
        <div className="flex items-center space-x-6 text-xs font-mono text-cyan-200/80 pointer-events-auto">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>UPLINK: 256 KBPS</span>
          </div>
          <div>OUTSIDE: <span className="text-white font-bold">{telemetry?.environment?.outside_temp_c ?? -42}°C</span></div>
          <div>WIND: <span className="text-white font-bold">{telemetry?.environment?.wind_knots ?? 35} KTS</span></div>
        </div>
      </header>

      {/* Floating HUD Cards: Left-Anchored */}
      <div className="absolute top-20 left-8 z-10 flex flex-col space-y-4 pointer-events-none">
        {/* Top-Left Card: What-If Engine */}
        <div className="holo-card p-4 w-72 pointer-events-auto shadow-2xl">
          <div className="flex items-center justify-between mb-2.5 border-b border-cyan-500/20 pb-2">
            <h2 className="text-xs font-mono tracking-widest text-cyan-300 uppercase flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              <span>"What-If" Engine</span>
            </h2>
            <span className="text-[9px] font-mono text-cyan-400/60">CRISIS INJECTION</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            {[
              { id: 'NOMINAL', label: '1. Nominal' },
              { id: 'BLIZZARD', label: '2. Blizzard 72kt' },
              { id: 'GEN_FAILURE', label: '3. Gen Overheat' },
              { id: 'FUEL_FREEZE', label: '4. Line Freeze' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => triggerScenario(s.id)}
                className={`py-2 px-2 text-[11px] rounded border transition-all ${
                  activeScenario === s.id
                    ? 'border-cyan-400 bg-cyan-500/30 text-white shadow-[0_0_12px_rgba(0,210,255,0.4)]'
                    : 'border-cyan-500/20 bg-cyan-950/40 text-cyan-200/70 hover:border-cyan-400/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom-Left Card: Subsystem Telemetry Carousel */}
        <div className="pointer-events-auto">
          <TelemetryCard
            machine={currentMachine}
            allKeys={MACHINE_KEYS}
            activeKey={selectedMachineId}
            onSelectKey={setSelectedMachineId}
            onOpenBlueprint={() => setIsModalOpen(true)}
          />
        </div>
      </div>

      {/* Floating Blueprint Card: Top-Right (No Overlap) */}
      {isModalOpen && currentMachine && (
        <BlueprintModal
          machine={currentMachine}
          onClose={() => setIsModalOpen(false)}
          onDispatchDirective={async () => {
            await fetch('http://localhost:8000/api/directive/dispatch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ machine_id: currentMachine.id }),
            });
            setToastMessage(`EMERGENCY OVERRIDE DISPATCHED: Auto load transfer for ${currentMachine.name}`);
          }}
        />
      )}

      {/* Bottom Status Ticker */}
      <footer className="absolute bottom-0 left-0 right-0 h-8 bg-[#070d18]/95 border-t border-cyan-500/20 px-8 flex items-center text-xs font-mono text-cyan-300/80 z-20">
        <Activity className="w-3.5 h-3.5 mr-2 text-cyan-400 animate-pulse" />
        <span>STATUS: {toastMessage}</span>
        <span className="ml-auto text-[10px] text-cyan-400/60 flex items-center gap-1">
          <Eye className="w-3 h-3" /> DRAG TO ORBIT // SCROLL TO ZOOM INSIDE
        </span>
      </footer>
    </div>
  );
}