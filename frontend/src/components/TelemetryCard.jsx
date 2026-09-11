import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Cpu } from 'lucide-react';

// Custom lightweight SVG live-scrolling graph (Seismometer effect)
function LiveGraph({ value, strokeColor }) {
  const [data, setData] = useState(Array(30).fill(value));
  
  useEffect(() => {
    setData(prev => [...prev.slice(1), value]);
  }, [value]);

  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / 29) * 100;
    const y = 20 - ((val - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 20" className="w-full h-8 mt-1 overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-200"
      />
    </svg>
  );
}

export default function TelemetryCard({ machine, allKeys, activeKey, onSelectKey, onOpenBlueprint }) {
  if (!machine) return null;
  const currentIndex = allKeys.indexOf(activeKey);
  const isCritical = machine.status === 'CRITICAL';
  const isWarning = machine.status === 'WARNING';
  const strokeHex = isCritical ? '#ff0055' : '#00d2ff';

  return (
    <div className="holo-card p-5 w-80 shadow-2xl flex flex-col justify-between border-cyan-500/30">
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-cyan-500/20 pb-2">
          <div className="flex items-center space-x-2">
            <button onClick={() => onSelectKey(allKeys[(currentIndex - 1 + allKeys.length) % allKeys.length])} className="p-1 rounded hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs text-cyan-200">0{currentIndex + 1} // 0{allKeys.length}</span>
            <button onClick={() => onSelectKey(allKeys[(currentIndex + 1) % allKeys.length])} className="p-1 rounded hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className={isCritical ? 'holo-pulse-red' : 'holo-pulse-cyan'}></span>
            <span className={`text-[10px] font-mono tracking-wider font-bold ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-300'}`}>
              {machine.status}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-1">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold tracking-wide text-white">{machine.name}</h3>
        </div>
        <p className="text-[10px] font-mono text-cyan-400/70 mb-4">TAG: {machine.mesh_id}</p>

        {/* Live Seismometer Graphs */}
        <div className="space-y-3 font-mono text-xs">
          <div className="p-2.5 rounded bg-cyan-950/30 border border-cyan-500/20">
            <div className="flex justify-between text-slate-300 mb-1">
              <span>{machine.metric_1_name}</span>
              <span className="font-bold text-cyan-300">{machine.metric_1_val} {machine.metric_1_unit}</span>
            </div>
            <LiveGraph value={machine.metric_1_val} strokeColor={strokeHex} />
          </div>

          <div className="p-2.5 rounded bg-cyan-950/30 border border-cyan-500/20">
            <div className="flex justify-between text-slate-300 mb-1">
              <span>{machine.metric_2_name}</span>
              <span className="font-bold text-cyan-300">{machine.metric_2_val} {machine.metric_2_unit}</span>
            </div>
            <LiveGraph value={machine.metric_2_val} strokeColor={strokeHex} />
          </div>
        </div>
      </div>

      <button onClick={onOpenBlueprint} className="mt-4 w-full py-2 px-3 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/50 rounded text-xs font-mono text-cyan-300 flex items-center justify-center space-x-2 transition-all">
        <Maximize2 className="w-3.5 h-3.5" />
        <span>OPEN AR SCHEMATIC</span>
      </button>
    </div>
  );
}