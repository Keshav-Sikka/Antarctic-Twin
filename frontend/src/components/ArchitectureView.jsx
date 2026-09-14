import React from 'react';
import { Activity, Boxes, Cable, CloudCog, Database, Radio, ShieldCheck, Workflow } from 'lucide-react';

const layers = [
  {
    title: 'DATA ACQUISITION',
    subtitle: 'IoT / EDGE',
    icon: Radio,
    color: 'cyan',
    items: ['Generator sensors', 'Weather station', 'Inventory scanners', 'Personnel check-ins'],
    status: 'LIVE // 42 SIGNALS'
  },
  {
    title: 'INTEGRATION',
    subtitle: 'DATAOPS / MESH',
    icon: Cable,
    color: 'purple',
    items: ['MQTT / WebSocket bridge', 'Delta-sync queue', 'Schema normalization', 'Offline store-and-forward'],
    status: 'SYNC // 256 KBPS'
  },
  {
    title: 'VIRTUAL REPRESENTATION',
    subtitle: 'DIGITAL TWIN',
    icon: Boxes,
    color: 'emerald',
    items: ['Three.js station model', '7-room asset graph', 'Simulation timeline', 'Anomaly detection'],
    status: 'TWIN // IN SYNC'
  },
  {
    title: 'APPLICATIONS',
    subtitle: 'CONTROL / DECISION',
    icon: CloudCog,
    color: 'amber',
    items: ['Data Core dashboard', 'Predictive maintenance', 'Emergency directives', 'Compliance reports'],
    status: 'READY // 3 ROLES'
  }
];

export default function ArchitectureView({ station, telemetry, activeScenario }) {
  const Icon = Activity;
  return (
    <main className="architecture-scroll-wrap">
      <div className="architecture-heading">
        <div>
          <p className="text-[10px] tracking-[3px] text-cyan-500">POLARCORE // SYSTEM ARCHITECTURE</p>
          <h1>Station <em>Intelligence Fabric</em></h1>
          <p className="text-[10px] text-cyan-600 mt-2 tracking-widest">
            {station === 'BHARATI_STATION' ? 'BHARATI' : 'MAITRI'} // MODULAR DIGITAL TWIN REFERENCE STACK
          </p>
        </div>
        <div className="jarvis-panel architecture-health">
          <ShieldCheck size={17} className="text-emerald-400" />
          <div><small>FABRIC STATUS</small><strong>OPERATIONAL</strong></div>
        </div>
      </div>

      <section className="architecture-flow" aria-label="Digital twin architecture layers">
        {layers.map((layer, index) => {
          const LayerIcon = layer.icon;
          return (
            <React.Fragment key={layer.title}>
              <article className={`jarvis-panel architecture-layer ${layer.color}`}>
                <div className="architecture-layer-head">
                  <LayerIcon size={20} />
                  <div><strong>{layer.title}</strong><small>{layer.subtitle}</small></div>
                </div>
                <div className="architecture-status">{layer.status}</div>
                <ul>{layer.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
              {index < layers.length - 1 && <Workflow className="architecture-arrow" size={20} />}
            </React.Fragment>
          );
        })}
      </section>

      <section className="architecture-grid">
        <div className="jarvis-panel">
          <div className="panel-title"><span><Database size={13} className="mr-2 inline" /> COMMON DATA ENVIRONMENT</span><b className="text-emerald-400">NORMALIZED</b></div>
          <div className="architecture-metrics">
            <div><small>DOMAINS</small><strong>16</strong></div>
            <div><small>ACTIVE ASSETS</small><strong>{Object.keys(telemetry?.machines || {}).length}</strong></div>
            <div><small>SCENARIO</small><strong>{activeScenario.replace('_', ' ')}</strong></div>
          </div>
        </div>
        <div className="jarvis-panel">
          <div className="panel-title"><span><Activity size={13} className="mr-2 inline" /> FEEDBACK LOOP</span><b className="text-cyan-400">EDGE-FIRST</b></div>
          <p className="architecture-note">Sensors → normalized telemetry → twin state → AI recommendation → remote operator directive.</p>
        </div>
      </section>
    </main>
  );
}
