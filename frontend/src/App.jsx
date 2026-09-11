import React, { useEffect, useRef, useState } from 'react';
import ThreeScene from './components/ThreeScene';
import BlueprintModal from './components/BlueprintModal';
import {
  Activity, AlertTriangle, BatteryCharging, Bot, ChevronDown, CloudSnow,
  Gauge, Globe2, LayoutDashboard, Layers, Map, Menu, Network, Play, Radio, ShieldCheck, Snowflake,
  Thermometer, Truck, Users, Zap
} from 'lucide-react';

const API = 'http://localhost:8000';
const fallback = {
  station: 'BHARATI_STATION', station_label: 'Bharati Research Station',
  station_health: 'HEALTHY', active_scenario: 'NOMINAL', satellite_online: true,
  environment: { outside_temp_c: -38.5, indoor_temp_c: 21.4, wind_knots: 28, wind_direction: 'SE', pressure_hpa: 982, humidity_pct: 64, visibility_km: 18, snow_accumulation_cm: 3.2 },
  energy: { generator_output_kw: 412, power_consumption_kw: 338, peak_load_kw: 465, fuel_level_pct: 72, battery_level_pct: 86, renewable_kw: 38, efficiency_pct: 82, anomaly: 'Generator G-02 is consuming 14% more fuel than its baseline.' },
  inventory: [{ item: 'Diesel', value: 72, unit: '%', status: 'GOOD', runway: '18 days' }, { item: 'Food supplies', value: 38, unit: 'days', status: 'GOOD', runway: '38 days' }, { item: 'Medical supplies', value: 14, unit: 'days', status: 'WARNING', runway: '14 days' }, { item: 'Spare generator parts', value: 2, unit: 'kits', status: 'GOOD', runway: '—' }, { item: 'Oxygen', value: 61, unit: '%', status: 'GOOD', runway: '24 days' }],
  personnel: { total: 42, safe: 40, medical: 1, unaccounted: 1, last_check_in: '02:14 ago' },
  alerts: [{ id: 'a1', severity: 'CRITICAL', title: 'Generator G-03 overheating', impact: 'Backup capacity reduced', action: 'Inspect cooling loop' }, { id: 'a2', severity: 'WARNING', title: 'Diesel below projected threshold', impact: '11-day runway risk', action: 'Prioritize resupply' }, { id: 'a3', severity: 'WARNING', title: 'Medical inventory low', impact: '14 days remaining', action: 'Add to next flight manifest' }, { id: 'a4', severity: 'GOOD', title: 'Weather conditions improving', impact: 'Visibility recovering', action: 'Resume external operations' }],
  machines: { gen1: { id: 'gen1', name: 'Generator G-02', mesh_id: 'mesh_gen1', metric_1_name: 'Core Temp', metric_1_val: 81.4, metric_1_unit: '°C', metric_2_name: 'Vibration', metric_2_val: 49.8, metric_2_unit: 'Hz', status: 'NORMAL' }, fuel: { id: 'fuel', name: 'Main Fuel Tanks', mesh_id: 'mesh_fuel', metric_1_name: 'Reserve', metric_1_val: 124500, metric_1_unit: 'L', metric_2_name: 'Line Temp', metric_2_val: -4.2, metric_2_unit: '°C', status: 'NORMAL' }, water: { id: 'water', name: 'Snow Melter & Recycling', mesh_id: 'mesh_water', metric_1_name: 'Storage', metric_1_val: 88.5, metric_1_unit: '%', metric_2_name: 'Flow Rate', metric_2_val: 14.2, metric_2_unit: 'L/m', status: 'NORMAL' }, hvac: { id: 'hvac', name: 'Life Support HVAC', mesh_id: 'mesh_hvac', metric_1_name: 'Hab Temp', metric_1_val: 21.2, metric_1_unit: '°C', metric_2_name: 'Airflow', metric_2_val: 1200, metric_2_unit: 'CFM', status: 'NORMAL' } }
};

const statusClass = (severity) => severity === 'CRITICAL' ? 'critical' : severity === 'WARNING' ? 'warning' : 'good';
const Sparkline = ({ tone = 'cyan', flip = false }) => <svg className={`sparkline ${tone}`} viewBox="0 0 120 32" preserveAspectRatio="none"><polyline points={flip ? "0,8 18,12 30,9 45,18 62,14 78,22 94,16 120,25" : "0,24 14,20 28,23 43,12 57,18 73,10 88,14 104,6 120,9"} /></svg>;

function Metric({ icon: Icon, label, value, suffix, tone = 'cyan', trend }) {
  return <div className="metric-card">
    <div className="metric-head"><span><Icon size={15} /> {label}</span><span className={`trend ${tone}`}>{trend || 'LIVE'}</span></div>
    <div className="metric-value">{value}<small>{suffix}</small></div>
    <Sparkline tone={tone} />
  </div>;
}

export default function App() {
  const [telemetry, setTelemetry] = useState(fallback);
  const [view, setView] = useState('overview');
  const [station, setStation] = useState('BHARATI_STATION');
  const [selectedMachineId, setSelectedMachineId] = useState('gen1');
  const [modal, setModal] = useState(false);
  const [scenario, setScenario] = useState('NOMINAL');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Ask me about station risk, generator health, weather or resource runway.');
  const [whatIf, setWhatIf] = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`${API.replace('http', 'ws')}/ws/telemetry`);
    wsRef.current = ws;
    ws.onmessage = (event) => setTelemetry((current) => ({ ...current, ...JSON.parse(event.data) }));
    ws.onerror = () => ws.close();
    return () => ws.close();
  }, []);

  const triggerScenario = async (next) => {
    setScenario(next);
    try {
      const response = await fetch(`${API}/api/scenario`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: next }) });
      if (response.ok) setTelemetry((current) => ({ ...current, active_scenario: next }));
    } catch { /* The demo remains usable offline with the local state. */ }
  };

  const switchStation = async () => {
    const next = station === 'BHARATI_STATION' ? 'MAITRI_STATION' : 'BHARATI_STATION';
    setStation(next);
    try {
      const response = await fetch(`${API}/api/station/switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ station: next }) });
      const data = await response.json();
      if (data.state) setTelemetry(data.state);
    } catch { /* WebSocket state remains the offline-safe source of truth. */ }
  };

  const runWhatIf = async (preset) => {
    setWhatIfLoading(true);
    try {
      const response = await fetch(`${API}/api/what-if`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: preset }) });
      setWhatIf(await response.json());
    } catch { setWhatIf({ status: 'OFFLINE', scenario: preset, baseline_risk: telemetry.risk, projected: { risk: { score: Math.min(100, (telemetry.risk?.score || 18) + 25), level: 'HIGH' } } }); }
    setWhatIfLoading(false);
  };

  const askAssistant = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    try {
      const response = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await response.json();
      setAnswer(data.answer);
    } catch { setAnswer('Local station rules are unavailable. Review the critical generator alert and diesel runway manually.'); }
    setQuestion('');
  };

  const env = telemetry.environment;
  const energy = telemetry.energy;
  const health = telemetry.station_health || 'HEALTHY';
  const currentMachine = telemetry.machines?.[selectedMachineId];

  return <div className="command-center">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Snowflake size={22} /></div><div><b>POLAR<span>CORE</span></b><small>REMOTE STATION OPERATIONS</small></div></div>
      <nav className="main-nav">{[['overview', LayoutDashboard, 'Command Center'], ['twin', Globe2, 'Digital Twin'], ['analytics', Activity, 'Historical Analytics']].map(([id, Icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={15} />{label}</button>)}</nav>
      <div className="top-actions"><span className="uplink"><i /> {telemetry.offline_mesh?.sync_state === 'MESH_ONLY' ? 'MESH-ZERO / OFFLINE' : 'SAT-LINK 256 KBPS'}</span><button className="station-select" onClick={switchStation}>{station === 'BHARATI_STATION' ? 'BHARATI' : 'MAITRI'} <ChevronDown size={14} /></button><Menu size={19} className="menu-icon" /></div>
    </header>

    <main className="dashboard">
      <section className="hero-row">
        <div><p className="eyebrow"><span className="live-dot" /> MISSION CONTROL / NCPOR / SIH-26060</p><h1>{station === 'BHARATI_STATION' ? 'Bharati' : 'Maitri'} <em>Station</em></h1><p className="subtitle">Antarctic digital twin & decision support system <span>•</span> Updated just now</p></div>
        <div className="health-badge"><div className={`health-orb ${statusClass(health)}`}><ShieldCheck size={23} /></div><div><small>OVERALL STATION HEALTH</small><strong>{health === 'HEALTHY' ? 'Healthy' : health === 'WARNING' ? 'Warning' : 'Critical'}</strong><span>AI confidence 94.2%</span></div></div>
      </section>

      {view === 'twin' ? <section className="twin-screen"><div className="section-title"><div><span className="kicker">SPATIAL OPERATIONS</span><h2>Digital Twin Explorer</h2></div><span className="view-pill"><i /> LIVE 3D TELEMETRY</span></div><div className="twin-canvas"><ThreeScene machines={telemetry.machines} selectedMachineId={selectedMachineId} activeScenario={scenario} onMachineClick={(id) => { setSelectedMachineId(id); setModal(true); }} /><div className="map-overlay"><Map size={15} /> MAPBOX // LARSEMANN HILLS <span>69°24'S 76°11'E</span></div></div>{currentMachine && <div className="twin-strip"><b>{currentMachine.name}</b><span>Health score <strong>91%</strong></span><span>Temperature <strong>{currentMachine.metric_1_val}{currentMachine.metric_1_unit}</strong></span><span>Telemetry <strong className="text-green">OPERATIONAL</strong></span><button onClick={() => setModal(true)}>OPEN ASSET DETAIL →</button></div>}</section> : view === 'analytics' ? <section className="analytics-screen"><div className="section-title"><div><span className="kicker">DECISION HISTORY</span><h2>Station Performance / 30 days</h2></div><div className="periods"><button>7D</button><button className="selected">30D</button><button>90D</button></div></div><div className="analytics-grid"><div className="panel chart-panel large"><div className="panel-title"><span>ENERGY CONSUMPTION / kWh</span><b>−4.8% <small>vs previous period</small></b></div><div className="big-chart"><div className="chart-fill" /><Sparkline /></div><div className="chart-axis"><span>01 SEP</span><span>08 SEP</span><span>15 SEP</span><span>22 SEP</span><span>TODAY</span></div></div><div className="panel history-list"><div className="panel-title"><span>EVENT STREAM</span><b className="text-cyan">LIVE</b></div>{['Generator G-02 inspection complete', 'Resupply manifest approved', 'Blizzard protocol simulated', 'Medical inventory replenished'].map((x, i) => <div className="history-item" key={x}><i className={i === 2 ? 'warning' : ''} /><span>{x}<small>{i + 2} days ago</small></span><strong>{i === 0 ? 'PASS' : 'LOGGED'}</strong></div>)}</div></div></section> : <section>
        <div className="metric-grid"><Metric icon={Zap} label="NET POWER" value={energy.power_consumption_kw} suffix=" kW" trend="+2.4%" /><Metric icon={BatteryCharging} label="FUEL RESERVE" value={energy.fuel_level_pct} suffix="%" trend="18 DAYS" tone="green" /><Metric icon={Thermometer} label="OUTSIDE TEMP" value={env.outside_temp_c} suffix="°C" trend="STABLE" tone="purple" /><Metric icon={Users} label="PERSONNEL SAFE" value={`${telemetry.personnel.safe}/${telemetry.personnel.total}`} trend="1 UNACCOUNTED" tone="amber" /></div>
        <div className="content-grid">
          <div className="left-stack">
            <div className="section-title"><div><span className="kicker">SPATIAL OPERATIONS</span><h2>Station Digital Twin</h2></div><button className="outline-btn" onClick={() => setView('twin')}><Globe2 size={14} /> EXPLORE FULL MODEL</button></div>
            <div className="twin-preview"><ThreeScene machines={telemetry.machines} selectedMachineId={selectedMachineId} activeScenario={scenario} onMachineClick={(id) => { setSelectedMachineId(id); setModal(true); }} /><div className="preview-label"><span className="live-dot" /> DIGITAL TWIN / {telemetry.station_label.toUpperCase()}<small>Click a module to inspect live telemetry</small></div><div className="map-chip"><Map size={13} /> MAPBOX POSITION <b>69°24'S</b></div></div>
            <div className="lower-grid"><div className="panel energy-panel"><div className="panel-title"><span><Zap size={15} /> ENERGY FLOW / 24H</span><span className="green-label">● LIVE</span></div><div className="energy-hero"><div><small>CONSUMPTION</small><b>{energy.power_consumption_kw} <i>kW</i></b></div><div className="donut"><strong>{energy.efficiency_pct}%</strong><small>EFFICIENCY</small></div></div><div className="bars">{[38, 45, 42, 58, 52, 66, 61, 73, 68, 79, 71, 82, 76, 69].map((h, i) => <i key={i} style={{ height: `${h}%` }} className={i > 10 ? 'hot' : ''} />)}</div><div className="chart-legend"><span><i className="dot cyan" /> Consumption</span><span><i className="dot purple" /> Predicted load</span></div></div><div className="panel environment-panel"><div className="panel-title"><span><CloudSnow size={15} /> POLAR ENVIRONMENT</span><b className="text-cyan">LIVE</b></div><div className="weather-main"><CloudSnow size={40} /><div><b>{env.outside_temp_c}°C</b><span>FEELS LIKE {env.outside_temp_c - 4}°C</span></div><div className="wind"><strong>{env.wind_knots} <small>KTS</small></strong><span>WIND {env.wind_direction}</span></div></div><div className="weather-grid"><span>PRESSURE <b>{env.pressure_hpa} hPa</b></span><span>HUMIDITY <b>{env.humidity_pct}%</b></span><span>VISIBILITY <b>{env.visibility_km} km</b></span><span>SNOW ACCUM. <b>{env.snow_accumulation_cm} cm</b></span></div></div></div>
          </div>
          <aside className="right-stack"><div className="panel alerts-panel"><div className="panel-title"><span><AlertTriangle size={15} /> ALERT CENTER</span><b className="alert-count">{telemetry.alerts.filter((a) => a.severity !== 'GOOD').length} ACTIVE</b></div>{telemetry.alerts.map((alert) => <div className={`alert-item ${statusClass(alert.severity)}`} key={alert.id}><div className="alert-icon">{alert.severity === 'CRITICAL' ? '!' : alert.severity === 'WARNING' ? '△' : '✓'}</div><div><strong>{alert.title}</strong><span>{alert.impact}</span><small>→ {alert.action}</small></div></div>)}</div><div className="panel inventory-panel"><div className="panel-title"><span><Truck size={15} /> LOGISTICS & RUNWAY</span><b className="text-amber">RESUPPLY HIGH</b></div>{telemetry.inventory.slice(0, 4).map((item) => <div className="inventory-row" key={item.item}><span>{item.item}<small>{item.runway}</small></span><b>{item.value}{item.unit}</b><i className={statusClass(item.status)} style={{ width: `${Math.min(100, item.value * 1.2)}%` }} /></div>)}<div className="forecast"><Gauge size={15} /><span><b>Supply forecast</b> Diesel projected below safety threshold in <strong>11 days</strong>.</span></div></div><div className="panel assistant-panel"><div className="panel-title"><span><Bot size={15} /> STATION AI</span><b className="text-purple">LOCAL MODEL</b></div><p className="assistant-answer">“{answer}”</p><form onSubmit={askAssistant}><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Station AI..." /><button><Radio size={14} /></button></form><div className="suggestions"><button onClick={() => setQuestion('What is the biggest risk?')}>Biggest risk?</button><button onClick={() => setQuestion('How long if generator fails?')}>Generator runway?</button></div></div></aside>
        </div>
        <div className="advanced-grid">
          <div className="panel causal-panel">
            <div className="panel-title"><span><Activity size={15} /> CAUSAL INTELLIGENCE GRAPH</span><b className="text-cyan">16 DOMAINS / DETERMINISTIC</b></div>
            <div className="causal-chain">{['Environment', 'Energy', 'Generator', 'Fuel', 'Logistics', 'Risk'].map((node, index) => <React.Fragment key={node}><div className={`causal-node ${index === 5 && telemetry.risk?.level !== 'LOW' ? 'risk-node' : ''}`}><strong>{node}</strong><small>{index === 0 ? `${env.outside_temp_c}°C / ${env.wind_knots} kt` : index === 1 ? `${energy.power_consumption_kw} kW load` : index === 2 ? `${energy.generator_output_kw} kW output` : index === 3 ? `${energy.fuel_level_pct}% reserve` : index === 4 ? `${telemetry.domains?.logistics?.food_days || 38} day runway` : `${telemetry.risk?.score || 18}/100 ${telemetry.risk?.level || 'LOW'}`}</small></div>{index < 5 && <span className="causal-arrow">→</span>}</React.Fragment>)}</div>
            <div className="domain-footer"><span>MONITORED SURFACES</span>{Object.entries(telemetry.domains || {}).slice(0, 8).map(([name, data]) => <i key={name} className={statusClass(data.status)} title={name} />)}</div>
          </div>
          <div className="panel whatif-panel">
            <div className="panel-title"><span><Layers size={15} /> WHAT-IF SIMULATION ENGINE</span><b className="text-purple">CLONED STATE</b></div>
            <div className="whatif-actions">{['BLIZZARD', 'GEN_FAILURE', 'SUPPLY_DELAY', 'COMMS_OUTAGE'].map((preset) => <button key={preset} onClick={() => runWhatIf(preset)} disabled={whatIfLoading}>{preset.replace('_', ' ')}</button>)}</div>
            {whatIf ? <div className="whatif-result"><span>{whatIf.scenario} projection</span><b>{whatIf.baseline_risk?.score || 0} <i>→</i> {whatIf.projected?.risk?.score || 0}</b><small>Risk score / baseline → projected</small></div> : <div className="whatif-empty"><Play size={14} /> Select a contingency preset to compare projected risk without changing live state.</div>}
          </div>
          <div className="panel mesh-panel">
            <div className="panel-title"><span><Network size={15} /> PROJECT MESH-ZERO</span><b className="text-green">{telemetry.offline_mesh?.sync_state || 'CONNECTED'}</b></div>
            <div className="mesh-stats"><div><small>SYNC PROTOCOL</small><strong>{telemetry.offline_mesh?.protocol || 'PolarMesh/1.0'}</strong></div><div><small>QUEUED PACKETS</small><strong>{telemetry.offline_mesh?.queued_packets || 0}</strong></div><div><small>PEER NODES</small><strong>{telemetry.offline_mesh?.peers?.length || 2}</strong></div></div>
            <div className="mesh-progress"><i style={{ width: telemetry.offline_mesh?.satellite_online === false ? '38%' : '96%' }} /></div><small className="mesh-caption">{telemetry.offline_mesh?.satellite_online === false ? 'Satellite degraded — store-and-forward queue active' : 'Satellite uplink nominal — CRDT merge window ready'}</small>
          </div>
        </div>
      </section>}
    </main>
    <footer className="bottom-bar"><span><i className="live-dot" /> POLARSYNC ONLINE</span><span>LAST SYNC <b>00:00:04</b></span><span>OFFLINE QUEUE <b>0 PACKETS</b></span><div className="scenario-actions"><button onClick={() => triggerScenario(scenario === 'GEN_FAILURE' ? 'NOMINAL' : 'GEN_FAILURE')} className={scenario === 'GEN_FAILURE' ? 'danger' : ''}><AlertTriangle size={13} /> {scenario === 'GEN_FAILURE' ? 'RESET INCIDENT' : 'SIMULATE EMERGENCY'}</button><button onClick={() => triggerScenario(scenario === 'BLIZZARD' ? 'NOMINAL' : 'BLIZZARD')}><Snowflake size={13} /> EXTREME WEATHER</button></div></footer>
    {modal && currentMachine && <BlueprintModal machine={currentMachine} onClose={() => setModal(false)} onDispatchDirective={() => { setModal(false); triggerScenario('NOMINAL'); }} />}
  </div>;
}
