import React from 'react';
import { X, Send, Cpu, Globe2 } from 'lucide-react';

const BLUEPRINT_MAP = {
  gen1: '/blueprints/placeholder-1.jpg',
  fuel: '/blueprints/placeholder-2.jpg',
  water: '/blueprints/placeholder-3.jpg',
  hvac: '/blueprints/placeholder-4.jpg',
};

export default function BlueprintModal({ machine, isStationOverview, station, onClose, onDispatchDirective }) {
  
  if (isStationOverview) {
    const isBharati = station === 'BHARATI_STATION';
    const overviewSrc = isBharati ? '/blueprints/placeholder-5.jpg' : '/blueprints/placeholder-6.jpg';

    return (
      <div className="jarvis-panel w-[26rem] p-5 z-50 animate-in fade-in zoom-in-95 duration-200" style={{ position: 'fixed', top: '5.5rem', right: '2rem' }}>
        <div className="flex justify-between items-center border-b border-cyan-500/40 pb-3 mb-4">
          <div className="flex space-x-2 text-[11px] font-bold tracking-widest text-cyan-300 text-glow">
            <Globe2 className="w-4 h-4" />
            <span>BASE SPEC // {isBharati ? 'BHARATI' : 'MAITRI'}</span>
          </div>
          <button onClick={onClose} className="text-cyan-500 hover:text-cyan-200 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="w-full h-44 border border-cyan-500/50 overflow-hidden relative opacity-90 hover:opacity-100 transition-opacity mb-4 bg-[#010308]">
          <img src={overviewSrc} alt="Station Blueprint" className="w-full h-full object-cover mix-blend-screen" />
          <div className="absolute bottom-2 right-2 text-[9px] text-cyan-300 bg-cyan-950/80 px-2 py-1 border border-cyan-500/50">
            {isBharati ? 'LARSEMANN HILLS' : 'SCHIRMACHER OASIS'}
          </div>
        </div>

        <div className="flex flex-col space-y-2 text-[10px] font-bold text-cyan-300 border border-cyan-500/40 bg-cyan-950/30 p-3 mb-5 tracking-widest">
          <div className="flex justify-between"><span>COMMISSIONED:</span><span className="text-white">{isBharati ? '2012' : '1989'}</span></div>
          <div className="flex justify-between"><span>ARCHITECTURE:</span><span className="text-white">{isBharati ? '134 ISO Containers' : 'Modular U-Shape'}</span></div>
          <div className="flex justify-between"><span>LATITUDE:</span><span className="text-white">{isBharati ? "69°24'S" : "70°46'S"}</span></div>
        </div>

        <button onClick={onClose} className="w-full py-3 border border-cyan-400 text-cyan-100 text-[11px] font-bold tracking-widest uppercase flex justify-center items-center hover:bg-cyan-400/20 text-glow transition-all shadow-[inset_0_0_10px_rgba(0,210,255,0.2)] bg-black/20">
          ACKNOWLEDGE
        </button>
      </div>
    );
  }

  const blueprintSrc = BLUEPRINT_MAP[machine.id] || '/blueprints/placeholder-1.jpg';

  return (
    <div className="jarvis-panel w-[26rem] p-5 z-50 animate-in fade-in zoom-in-95 duration-200" style={{ position: 'fixed', top: '5.5rem', right: '2rem' }}>
      <div className="flex justify-between items-center border-b border-cyan-500/40 pb-3 mb-4">
        <div className="flex space-x-2 text-[11px] font-bold tracking-widest text-cyan-300 text-glow">
          <Cpu className="w-4 h-4" />
          <span>SCHEMATIC // {machine.id.toUpperCase()}</span>
        </div>
        <button onClick={onClose} className="text-cyan-500 hover:text-cyan-200 transition-colors"><X className="w-5 h-5" /></button>
      </div>

      <div className="w-full h-44 border border-cyan-500/50 overflow-hidden relative opacity-90 hover:opacity-100 transition-opacity mb-4 bg-[#010308]">
        <img src={blueprintSrc} alt="Blueprint" className="w-full h-full object-cover mix-blend-screen" />
        <div className="absolute bottom-2 right-2 text-[9px] text-cyan-300 bg-cyan-950/80 px-2 py-1 border border-cyan-500/50">POLAR SPEC V2.4</div>
      </div>

      <div className="flex justify-between text-[11px] font-bold text-cyan-300 border border-cyan-500/40 bg-cyan-950/30 px-3 py-2.5 mb-5">
        <span>{machine.metric_1_name}: <span className="text-white">{machine.metric_1_val}{machine.metric_1_unit}</span></span>
        <span>{machine.metric_2_name}: <span className="text-white">{machine.metric_2_val}{machine.metric_2_unit}</span></span>
      </div>

      <button onClick={() => { onDispatchDirective(); onClose(); }} className="w-full py-3 border border-cyan-400 text-cyan-100 text-[11px] font-bold tracking-widest uppercase flex justify-center items-center hover:bg-cyan-400/20 text-glow transition-all shadow-[inset_0_0_10px_rgba(0,210,255,0.2)] bg-black/20">
        <Send className="w-4 h-4 mr-2" /> EXECUTE DIRECTIVE
      </button>
    </div>
  );
}