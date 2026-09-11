import React from 'react';
import { X, Send, Cpu } from 'lucide-react';

const BLUEPRINT_MAP = {
  gen1: '/blueprints/placeholder-1.jpg',
  fuel: '/blueprints/placeholder-2.jpg',
  water: '/blueprints/placeholder-3.jpg',
  hvac: '/blueprints/placeholder-4.jpg',
};

export default function BlueprintModal({ machine, onClose, onDispatchDirective }) {
  const blueprintSrc = BLUEPRINT_MAP[machine.id] || '/blueprints/placeholder-1.jpg';

  return (
    <div 
      className="holo-card w-[26rem] p-5 shadow-2xl z-50 border-cyan-400/50 animate-in fade-in zoom-in-95 duration-200"
      style={{ position: 'fixed', top: '5rem', right: '2rem' }}
    >
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
        <div className="flex items-center space-x-2 text-cyan-300 text-xs font-mono">
          <Cpu className="w-4 h-4" />
          <span>HOLO-SCHEMATIC // {machine.id.toUpperCase()}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-bold text-white mb-2">{machine.name}</h4>
        <div className="w-full h-48 rounded border border-cyan-500/40 bg-black/60 overflow-hidden relative flex items-center justify-center">
          <img 
            src={blueprintSrc} 
            alt={`${machine.name} Blueprint`} 
            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
          />
          <div className="absolute bottom-1 right-1 text-[9px] font-mono text-cyan-300 bg-black/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
            POLAR SPEC V2.4
          </div>
        </div>

        <div className="mt-2.5 text-xs font-mono text-cyan-300 flex justify-between bg-cyan-950/40 px-3 py-2 rounded border border-cyan-500/20">
          <span>{machine.metric_1_name}: <strong className="text-white">{machine.metric_1_val}{machine.metric_1_unit}</strong></span>
          <span>{machine.metric_2_name}: <strong className="text-white">{machine.metric_2_val}{machine.metric_2_unit}</strong></span>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={onDispatchDirective}
          className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs font-mono flex items-center justify-center space-x-2 transition-all shadow-[0_0_15px_rgba(0,210,255,0.4)]"
        >
          <Send className="w-3.5 h-3.5" />
          <span>TRANSMIT OVERRIDE DIRECTIVE</span>
        </button>
        <p className="text-[10px] text-center font-mono text-cyan-400/60">Dispatched via 256kbps satellite narrowband</p>
      </div>
    </div>
  );
}