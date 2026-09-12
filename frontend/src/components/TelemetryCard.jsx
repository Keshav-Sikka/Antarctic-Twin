import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Cpu } from 'lucide-react';

function LiveGraph({ value, strokeColor }) {
  const [data, setData] = useState(Array(30).fill(value));
  useEffect(() => { setData(prev => [...prev.slice(1), value]); }, [value]);

  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;
  const points = data.map((val, i) => `${(i / 29) * 100},${20 - ((val - min) / range) * 20}`).join(' ');

  return (
    <svg viewBox="0 0 100 20" className="w-full h-8 mt-1 overflow-visible">
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" className="drop-shadow-md" />
    </svg>
  );
}

export default function TelemetryCard({ machine, allKeys, activeKey, onSelectKey, onOpenBlueprint }) {
  if (!machine) return null;
  const currentIndex = allKeys.indexOf(activeKey);
  const isCritical = machine.status === 'CRITICAL';
  const strokeHex = isCritical ? '#ff0055' : '#00d2ff';

  return (
    <div className="telemetry-card jarvis-panel p-2 w-56 text-[8px]">
      <div className="flex items-center justify-between mb-1.5 border-b border-cyan-500/40 pb-1">
        <div className="flex items-center space-x-1.5">
          <button onClick={() => onSelectKey(allKeys[(currentIndex - 1 + allKeys.length) % allKeys.length])} className="text-cyan-500 hover:text-cyan-300 bg-black/40 border border-cyan-900/50 p-0.5 rounded">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <span className="text-[9px] font-bold tracking-widest text-cyan-400/80">0{currentIndex + 1}/0{allKeys.length}</span>
          <button onClick={() => onSelectKey(allKeys[(currentIndex + 1) % allKeys.length])} className="text-cyan-500 hover:text-cyan-300 bg-black/40 border border-cyan-900/50 p-0.5 rounded">
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <span className={`text-[8px] font-bold tracking-widest ${isCritical ? 'text-red-400 text-glow-red' : 'text-cyan-300 text-glow'}`}>
          {machine.status}
        </span>
      </div>

      <div className="flex items-center space-x-1.5 mb-1.5">
        <Cpu className="w-3 h-3 text-cyan-400" />
        <h3 className="text-[9px] font-bold uppercase tracking-wider text-cyan-100 text-glow truncate">{machine.name}</h3>
      </div>

      <div className="space-y-1.5 tracking-widest font-bold">
        <div>
          <div className="flex justify-between text-cyan-500/90 text-[8px]">
            <span>{machine.metric_1_name}</span>
            <span className="text-cyan-200 text-glow">{machine.metric_1_val} {machine.metric_1_unit}</span>
          </div>
          <LiveGraph value={machine.metric_1_val} strokeColor={strokeHex} />
        </div>
        <div>
          <div className="flex justify-between text-cyan-500/90 text-[8px]">
            <span>{machine.metric_2_name}</span>
            <span className="text-cyan-200 text-glow">{machine.metric_2_val} {machine.metric_2_unit}</span>
          </div>
          <LiveGraph value={machine.metric_2_val} strokeColor={strokeHex} />
        </div>
      </div>

      <button onClick={onOpenBlueprint} className="mt-2 w-full py-1 border border-cyan-500/50 hover:bg-cyan-400/20 text-[8px] tracking-widest font-bold text-cyan-300 flex items-center justify-center space-x-1.5 transition-all bg-black/30">
        <Maximize2 className="w-3 h-3" />
        <span>OVERRIDE</span>
      </button>
    </div>
  );
}