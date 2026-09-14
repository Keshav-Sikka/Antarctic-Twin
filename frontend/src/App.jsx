import React, { useEffect, useMemo, useRef, useState } from 'react';
import ThreeScene from './components/ThreeScene';
import TelemetryCard from './components/TelemetryCard';
import BlueprintModal from './components/BlueprintModal';
import ArchitectureView from './components/ArchitectureView';
import { cacheTelemetry, flushDeltas, readCachedTelemetry } from './services/offlineStore';
import {
  Activity, AlertTriangle, BatteryCharging, Bot, CalendarClock, ChevronDown, CloudSnow,
  ClipboardList, FileText, Gauge, Globe2, LayoutDashboard, Layers, Map, Network, Pause, Play, Radio,
  ShieldCheck, Snowflake, Thermometer, Truck, UserCog, Users, Zap, ShieldAlert, Workflow
} from 'lucide-react';

const API = 'http://localhost:8000';
const MACHINE_KEYS = ['gen1', 'fuel', 'water', 'hvac'];

const fallback = {
  station_label: 'Bharati Research Station',
  station_health: 'HEALTHY',
  environment: { outside_temp_c: -38.5, wind_knots: 28, visibility_km: 18, pressure_hpa: 982, humidity_pct: 64, snow_accumulation_cm: 3.2, wind_direction: 'SE' },
  energy: { generator_output_kw: 412, power_consumption_kw: 338, fuel_level_pct: 72, efficiency_pct: 82 },
  personnel: { total: 42, safe: 40, unaccounted: 1 },
  alerts: [{ id: 'a1', severity: 'WARNING', title: 'Thermal loop observation', impact: 'Runway risk', action: 'Inspect' }],
  inventory: [{ item: 'Diesel', value: 72, unit: '%', status: 'GOOD', runway: '18d' }, { item: 'Medical', value: 14, unit: 'days', status: 'WARNING', runway: '14d' }],
  machines: {
    gen1: { id: 'gen1', name: 'Diesel Generator #1', mesh_id: 'mesh_gen1', metric_1_name: 'Core Temp', metric_1_val: 81.4, metric_1_unit: '°C', metric_2_name: 'Vibration', metric_2_val: 49.8, metric_2_unit: 'Hz', status: 'NORMAL' },
    fuel: { id: 'fuel', name: 'Main Fuel Tanks', mesh_id: 'mesh_fuel', metric_1_name: 'Reserve', metric_1_val: 124500, metric_1_unit: 'L', metric_2_name: 'Line Temp', metric_2_val: -4.2, metric_2_unit: '°C', status: 'NORMAL' },
    water: { id: 'water', name: 'Snow Melter', mesh_id: 'mesh_water', metric_1_name: 'Storage', metric_1_val: 88.5, metric_1_unit: '%', metric_2_name: 'Flow', metric_2_val: 14.2, metric_2_unit: 'L/m', status: 'NORMAL' },
    hvac: { id: 'hvac', name: 'Life Support HVAC', mesh_id: 'mesh_hvac', metric_1_name: 'Hab Temp', metric_1_val: 21.2, metric_1_unit: '°C', metric_2_name: 'Airflow', metric_2_val: 1200, metric_2_unit: 'CFM', status: 'NORMAL' }
  }
};

const statusClass = (severity) => severity === 'CRITICAL' ? 'critical' : severity === 'WARNING' ? 'warning' : 'good';
const timelineLabel = (date) => date.toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
}).replace(',', ' //');
const buildOperationalAlerts = (state, scenario) => {
  const alerts = [...(state.alerts || [])];
  const has = (id) => alerts.some((alert) => alert.id === id);
  const fuel = state.energy?.fuel_level_pct;
  const generator = state.machines?.gen1;
  const inventory = state.inventory || [];
  const food = inventory.find((item) => /food/i.test(item.item));
  const medical = inventory.find((item) => /medical/i.test(item.item));
  const personnel = state.personnel;
  if (fuel !== undefined && fuel < 30 && !has('resource-fuel')) alerts.push({ id: 'resource-fuel', severity: 'CRITICAL', title: 'Fuel reserve critical', impact: 'Backup runway is below safe threshold', action: 'Prioritize diesel resupply' });
  else if (fuel !== undefined && fuel < 50 && !has('resource-fuel')) alerts.push({ id: 'resource-fuel', severity: 'WARNING', title: 'Fuel reserve declining', impact: 'Resupply window is approaching', action: 'Review next manifest' });
  if (food && Number(food.value) < 40 && !has('resource-food')) alerts.push({ id: 'resource-food', severity: 'WARNING', title: 'Food supplies running low', impact: `${food.runway || food.value} remaining`, action: 'Confirm food resupply' });
  if (medical && Number(medical.value) < 20 && !has('resource-medical')) alerts.push({ id: 'resource-medical', severity: 'WARNING', title: 'Medical inventory low', impact: `${medical.runway || medical.value} remaining`, action: 'Add to next flight manifest' });
  if (generator?.status === 'CRITICAL' && !has('equipment-generator')) alerts.push({ id: 'equipment-generator', severity: 'CRITICAL', title: 'Generator G-01 critical', impact: 'Power continuity is at risk', action: 'Inspect generator and prepare backup' });
  if (state.environment?.visibility_km < 2 && !has('weather-visibility')) alerts.push({ id: 'weather-visibility', severity: 'CRITICAL', title: 'Visibility critically reduced', impact: 'Outdoor operations are unsafe', action: 'Restrict exterior movement' });
  if (personnel?.unaccounted > 0 && !has('personnel-checkin')) alerts.push({ id: 'personnel-checkin', severity: 'CRITICAL', title: 'Personnel check-in required', impact: `${personnel.unaccounted} person unaccounted`, action: 'Start emergency check-in' });
  if (scenario !== 'NOMINAL' && !has('scenario-active')) alerts.push({ id: 'scenario-active', severity: 'WARNING', title: `${scenario.replace('_', ' ')} simulation active`, impact: 'Causal risk model is recalculating', action: 'Monitor Data Core' });
  return alerts;
};
const POPUP_ALERT_IDS = new Set(['resource-fuel', 'equipment-generator', 'weather-visibility', 'scenario-active', 'timeline-storm', 'timeline-generator']);
const applyTimeline = (base, simulatedAt, scenario) => {
  const hour = simulatedAt.getUTCHours();
  const month = simulatedAt.getUTCMonth();
  const activity = hour >= 7 && hour < 19 ? 1.12 : hour >= 19 && hour < 23 ? 0.96 : 0.82;
  const winterFactor = month >= 3 && month <= 8 ? 1.1 : 0.96;
  const stormFactor = scenario === 'BLIZZARD' ? 1.22 : 1;
  const failureFactor = scenario === 'GEN_FAILURE' ? 0.78 : 1;
  const coldShift = Math.sin((hour / 24) * Math.PI * 2) * 3;
  const environment = {
    ...base.environment,
    outside_temp_c: Number((base.environment.outside_temp_c - (winterFactor - 1) * 8 + coldShift).toFixed(1)),
    wind_knots: Math.round(base.environment.wind_knots * stormFactor),
    visibility_km: Number(Math.max(0.6, base.environment.visibility_km / stormFactor).toFixed(1)),
    snow_accumulation_cm: Number((base.environment.snow_accumulation_cm + (stormFactor - 1) * 0.8).toFixed(1))
  };
  const power = Math.round(base.energy.power_consumption_kw * activity * winterFactor);
  const fuel = Number(Math.max(0, base.energy.fuel_level_pct - (simulatedAt.getTime() / 3600000) % 0.8).toFixed(1));
  const generator = Math.round(base.energy.generator_output_kw * activity * failureFactor);
  const machines = Object.fromEntries(Object.entries(base.machines || {}).map(([id, machine]) => {
    if (id === 'gen1') {
      const temperature = Number((machine.metric_1_val + (activity - 1) * 18 + (stormFactor - 1) * 12).toFixed(1));
      return [id, { ...machine, metric_1_val: temperature, metric_2_val: Number((machine.metric_2_val * activity * stormFactor).toFixed(1)), status: scenario === 'GEN_FAILURE' || temperature > 94 ? 'CRITICAL' : temperature > 86 ? 'WARNING' : 'NORMAL' }];
    }
    return [id, machine];
  }));
  const timelineAlert = scenario === 'BLIZZARD'
    ? { id: 'timeline-storm', severity: 'CRITICAL', title: 'Blizzard operations restricted', impact: 'Visibility and wind exceed safe limits', action: 'Suspend outdoor operations' }
    : scenario === 'GEN_FAILURE'
      ? { id: 'timeline-generator', severity: 'CRITICAL', title: 'Generator failure simulation active', impact: 'Backup power reserve declining', action: 'Prepare load shedding' }
      : null;
  return {
    ...base,
    station_health: timelineAlert ? 'CRITICAL' : base.station_health,
    environment,
    energy: { ...base.energy, power_consumption_kw: power, generator_output_kw: generator, fuel_level_pct: fuel },
    machines,
    alerts: timelineAlert ? [timelineAlert, ...(base.alerts || []).filter((alert) => !alert.id.startsWith('timeline-'))] : (base.alerts || []).filter((alert) => !alert.id.startsWith('timeline-'))
  };
};
const Sparkline = ({ tone = 'cyan' }) => (
  <svg className={`sparkline ${tone}`} viewBox="0 0 120 32" preserveAspectRatio="none"><polyline points="0,24 14,20 28,23 43,12 57,18 73,10 88,14 104,6 120,9" /></svg>
);
function Metric({ icon: Icon, label, value, suffix, tone = 'cyan', trend }) {
  return (
    <div className="metric-card">
      <div className="metric-head"><span><Icon size={14} className="inline mr-1 text-cyan-400" /> {label}</span><span className={`text-[8px] font-bold tracking-widest ${tone === 'cyan' ? 'text-cyan-400' : tone === 'green' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-purple-400'}`}>{trend || 'LIVE'}</span></div>
      <div className="metric-value">{value}<small>{suffix}</small></div>
      <Sparkline tone={tone} />
    </div>
  );
}

export default function App() {
  const [telemetry, setTelemetry] = useState(fallback);
  const [view, setView] = useState('twin'); 
  const [station, setStation] = useState('BHARATI_STATION');
  const [selectedMachineId, setSelectedMachineId] = useState('gen1');
  const [isStationOverview, setIsStationOverview] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState('NOMINAL');
  const [systemLog, setSystemLog] = useState('SYS.ONLINE // UPLINK: 256KBPS');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [timelinePlaying, setTimelinePlaying] = useState(true);
  const [timelineSpeed, setTimelineSpeed] = useState(60);
  const [simulatedAt, setSimulatedAt] = useState(() => new Date());
  
  const [whatIf, setWhatIf] = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Ask me about station risk, generator health, weather or resource runway.');
  const [role, setRole] = useState('STATION LEADER');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverPriority, setHandoverPriority] = useState('MEDIUM');
  const [handoverLog, setHandoverLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('polarcore-handover') || '[]'); } catch { return []; }
  });
  const wsRef = useRef(null);
  const timelineBaseRef = useRef(fallback);

  useEffect(() => {
    if (!timelinePlaying) return undefined;
    const timer = window.setInterval(() => {
      setSimulatedAt((current) => new Date(current.getTime() + timelineSpeed * 60 * 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timelinePlaying, timelineSpeed]);

  useEffect(() => {
    if (!timelinePlaying) return;
    setTelemetry(applyTimeline(timelineBaseRef.current, simulatedAt, activeScenario));
  }, [simulatedAt, activeScenario, timelinePlaying]);

  useEffect(() => {
    readCachedTelemetry().then((cached) => {
      if (cached) {
        const merged = { ...fallback, ...cached };
        timelineBaseRef.current = merged;
        setTelemetry(merged);
      }
    }).catch(() => setSystemLog('LOCAL CACHE UNAVAILABLE // FALLBACK ACTIVE'));
    const onOnline = () => {
      setIsOffline(false);
      flushDeltas(API).catch(() => setSystemLog('SYNC DEFERRED // SATELLITE WINDOW CLOSED'));
    };
    const onOffline = () => {
      setIsOffline(true);
      setSystemLog('MESH-ZERO ACTIVE // LOCAL STORE-AND-FORWARD');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const ws = new WebSocket(`${API.replace('http', 'ws')}/ws/telemetry`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data);
        const merged = { ...timelineBaseRef.current, ...next };
        timelineBaseRef.current = merged;
        if (!timelinePlaying) setTelemetry(merged);
        cacheTelemetry(next).catch(() => setSystemLog('CACHE WRITE RETRY // EDGE STORAGE BUSY'));
      } catch { setSystemLog('TELEMETRY PACKET INVALID // LAST GOOD STATE RETAINED'); }
    };
    ws.onclose = () => setSystemLog('SAT-LINK LOST // LAST GOOD STATE RETAINED');
    return () => {
      ws.close();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const triggerScenario = async (sc) => {
    setActiveScenario(sc);
    try {
      await fetch(`${API}/api/scenario`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: sc }) });
      setSystemLog(`VECTOR INJECTED: [${sc}]`);
    } catch { setSystemLog(`OFFLINE OVERRIDE: [${sc}]`); }
  };

  const switchStation = async (requestedStation = null) => {
    const next = requestedStation || (station === 'BHARATI_STATION' ? 'MAITRI_STATION' : 'BHARATI_STATION');
    setStation(next);
    setIsStationOverview(true);
    setIsModalOpen(false);
    try {
      const res = await fetch(`${API}/api/station/switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ station: next }) });
      const data = await res.json();
      if (data.state) setTelemetry(data.state);
      if (data.state) timelineBaseRef.current = data.state;
      setSystemLog(`STATION ACTIVE: ${next}`);
    } catch { setSystemLog(`STATION SWITCHED: ${next} (Offline Mode)`); }
  };

  const runWhatIf = async (preset) => {
    setWhatIfLoading(true);
    try {
      const res = await fetch(`${API}/api/what-if`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: preset }) });
      setWhatIf(await res.json());
    } catch { setWhatIf({ scenario: preset, baseline_risk: telemetry.risk || { score: 18 }, projected: { risk: { score: 45, level: 'HIGH' } } }); }
    setWhatIfLoading(false);
  };

  const askAssistant = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      const res = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await res.json();
      setAnswer(data.answer);
    } catch { setAnswer('Local rules active: Priority inspection required on thermal bypass loop.'); }
    setQuestion('');
  };

  const addHandoverNote = (event) => {
    event.preventDefault();
    if (!handoverNote.trim()) return;
    const next = [{ id: Date.now(), text: handoverNote.trim(), priority: handoverPriority, role, time: new Date().toLocaleTimeString() }, ...handoverLog].slice(0, 6);
    setHandoverLog(next);
    localStorage.setItem('polarcore-handover', JSON.stringify(next));
    setHandoverNote('');
  };

  const downloadComplianceReport = () => {
    const rows = [
      ['PolarCore Madrid Protocol Demonstration Report', ''],
      ['Station', telemetry.station_label || station.replace('_', ' ')],
      ['Generated', simulatedAt.toISOString()],
      ['Fuel reserve (%)', energy.fuel_level_pct],
      ['Generator output (kW)', energy.generator_output_kw],
      ['Power consumption (kW)', energy.power_consumption_kw],
      ['Outdoor temperature (C)', env.outside_temp_c],
      ['Active alerts', activeAlerts.length],
      ['Data classification', 'Simulated telemetry for demonstration']
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${station.toLowerCase()}-compliance-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentMachine = telemetry.machines?.[selectedMachineId] || fallback.machines.gen1;
  const env = telemetry.environment || fallback.environment;
  const energy = telemetry.energy || fallback.energy;
  const health = telemetry.station_health || 'HEALTHY';
  const season = simulatedAt.getUTCMonth() >= 3 && simulatedAt.getUTCMonth() <= 8 ? 'ANTARCTIC WINTER' : 'ANTARCTIC SUMMER';
  const fuelDays = Math.max(1, Math.round((energy.fuel_level_pct / Math.max(1, energy.power_consumption_kw / 100)) * 10));
  const weatherTaskBlocked = env.wind_knots >= 40 || env.visibility_km < 2;
  const roleDescription = role === 'STATION LEADER'
    ? 'Full operational control and emergency overrides'
    : role === 'NCPOR HQ'
      ? 'Fleet analytics, compliance and resupply oversight'
      : 'Laboratory telemetry and task scheduling';
  const activeAlerts = useMemo(() => buildOperationalAlerts(telemetry, activeScenario), [telemetry, activeScenario]);
  const [urgentAlert, setUrgentAlert] = useState(null);
  const lastAlertSignatureRef = useRef('');
  const alertReadyRef = useRef(false);
  const criticalAlert = activeAlerts.find((alert) => alert.severity === 'CRITICAL' && POPUP_ALERT_IDS.has(alert.id));
  const urgentAlertSignature = criticalAlert ? `${criticalAlert.id}:${criticalAlert.severity}` : '';

  useEffect(() => {
    if (!criticalAlert || !urgentAlertSignature) {
      setUrgentAlert(null);
      lastAlertSignatureRef.current = '';
      alertReadyRef.current = true;
      return;
    }
    const signature = `${station}:${urgentAlertSignature}`;
    if (!alertReadyRef.current) {
      alertReadyRef.current = true;
      lastAlertSignatureRef.current = signature;
      return;
    }
    if (signature === lastAlertSignatureRef.current) return;
    lastAlertSignatureRef.current = signature;
    setUrgentAlert(criticalAlert);
    const timeout = window.setTimeout(() => setUrgentAlert(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [criticalAlert, urgentAlertSignature, station]);

  return (
    <div className="polar-app relative w-screen h-screen bg-[#02050a] text-cyan-50 font-mono overflow-hidden">
      
      {/* ─────────────────────────────────────────────────────────
          HUD: LOGO & CENTRAL SWITCHER
      ───────────────────────────────────────────────────────── */}
      <div className="absolute top-6 left-8 z-50 flex items-center space-x-3 pointer-events-none">
        <div className="w-8 h-8 flex items-center justify-center border border-cyan-500 bg-cyan-950 text-cyan-400 shadow-[0_0_10px_rgba(0,210,255,0.4)]">
          <Snowflake size={18} />
        </div>
        <div>
          <b className="block text-sm tracking-widest text-white">POLAR<span className="text-cyan-400">CORE</span></b>
          <small className="text-[8px] tracking-[2px] text-cyan-500">SIH26060 // MOES</small>
        </div>
      </div>

      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[60] flex space-x-6">
        <button onClick={() => setView('twin')} className={`flex items-center space-x-2 px-5 py-2 text-[11px] tracking-widest uppercase transition-all duration-300 border ${view === 'twin' ? 'border-cyan-400 text-cyan-300 text-glow bg-cyan-900/40 shadow-[0_0_15px_rgba(0,210,255,0.3)]' : 'border-cyan-900/60 text-cyan-600 hover:text-cyan-400 bg-black/40'}`}>
          <Globe2 className="w-3.5 h-3.5" /> <span>AR Spatial Twin</span>
        </button>
        <button onClick={() => setView('dashboard')} className={`flex items-center space-x-2 px-5 py-2 text-[11px] tracking-widest uppercase transition-all duration-300 border ${view === 'dashboard' ? 'border-cyan-400 text-cyan-300 text-glow bg-cyan-900/40 shadow-[0_0_15px_rgba(0,210,255,0.3)]' : 'border-cyan-900/60 text-cyan-600 hover:text-cyan-400 bg-black/40'}`}>
          <LayoutDashboard className="w-3.5 h-3.5" /> <span>Data Core</span>
        </button>
        <button onClick={() => setView('architecture')} className={`architecture-nav flex items-center space-x-2 px-5 py-2 text-[11px] tracking-widest uppercase transition-all duration-300 border ${view === 'architecture' ? 'border-purple-400 text-purple-200 text-glow bg-purple-900/40' : 'border-cyan-900/60 text-cyan-600 hover:text-purple-300 bg-black/40'}`}>
          <Workflow className="w-3.5 h-3.5" /> <span>Architecture</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────
          TOP RIGHT: STATION TOGGLE & QUICK OVERVIEW
      ───────────────────────────────────────────────────────── */}
      <div className="absolute top-6 right-8 z-50 flex flex-col items-end space-y-3 pointer-events-none">
        <div className="flex items-center space-x-4 pointer-events-auto">
          <div className="station-link-status flex items-center space-x-2 font-mono text-[10px] text-cyan-300/80 tracking-widest mr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{isOffline ? 'MESH-ZERO: OFFLINE' : 'SAT-LINK: 256 KBPS'}</span>
          </div>
          <div className="station-selector jarvis-panel flex items-center gap-1 p-1" aria-label="Select station location">
            <Map className="station-selector-icon w-3.5 h-3.5 ml-1 text-cyan-400" />
            {[
              { id: 'BHARATI_STATION', label: 'BHARATI' },
              { id: 'MAITRI_STATION', label: 'MAITRI' },
            ].map((location) => (
              <button
                key={location.id}
                onClick={() => switchStation(location.id)}
                aria-pressed={station === location.id}
                className={`station-choice px-3 py-1.5 text-[10px] tracking-widest transition-all ${
                  station === location.id
                    ? 'bg-cyan-400/20 text-cyan-100 border border-cyan-300 text-glow'
                    : 'text-cyan-500 border border-transparent hover:border-cyan-700 hover:text-cyan-200'
                }`}
              >
                {location.label}
              </button>
            ))}
          </div>
        </div>
        {view === 'dashboard' && <div className="timeline-widget jarvis-panel px-2.5 py-2 text-[8px] tracking-widest text-cyan-300">
          <div className="timeline-header flex items-center justify-between gap-3 mb-1">
            <span className="text-cyan-500">SIMULATED LIVE TIMELINE</span>
            <span className="text-emerald-400">{season}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimelinePlaying((playing) => !playing)}
              className="timeline-play border border-cyan-500/60 px-2 py-1 text-cyan-100 hover:bg-cyan-400/20"
              aria-label={timelinePlaying ? 'Pause timeline' : 'Play timeline'}
            >
              {timelinePlaying ? <Pause size={10} /> : <Play size={10} />}
            </button>
            <span className="text-cyan-100 whitespace-nowrap">{timelineLabel(simulatedAt)}</span>
            <select
              value={timelineSpeed}
              onChange={(event) => setTimelineSpeed(Number(event.target.value))}
              className="timeline-speed bg-black/60 border border-cyan-800 text-cyan-200 px-1 py-1 outline-none"
              aria-label="Timeline speed"
            >
              <option value="1">1X</option>
              <option value="10">10X</option>
              <option value="60">60X</option>
              <option value="240">240X</option>
            </select>
          </div>
          <div className="timeline-role mt-2 flex items-center gap-2 border-t border-cyan-900/50 pt-2">
            <UserCog size={10} className="text-purple-400" />
            <span className="text-cyan-600">ROLE</span>
            <select value={role} onChange={(event) => setRole(event.target.value)} className="timeline-speed flex-1 bg-black/60 border border-cyan-800 text-purple-200 px-1 py-1 outline-none">
              <option>STATION LEADER</option>
              <option>NCPOR HQ</option>
              <option>RESEARCHER</option>
            </select>
          </div>
          <div className="timeline-role-description mt-1 text-[7px] text-purple-300/70">{roleDescription}</div>
        </div>}
        
        {view === 'twin' && (
          <button 
            onClick={() => { setIsStationOverview(true); setIsModalOpen(true); setSelectedMachineId('overview'); }} 
            className="pointer-events-auto jarvis-panel px-4 py-1.5 flex items-center space-x-2 text-[9px] tracking-widest text-cyan-300 hover:text-cyan-100 transition-colors shadow-[inset_0_0_10px_rgba(0,210,255,0.2)]"
          >
            <Globe2 className="w-3 h-3" />
            <span>STATION OVERVIEW</span>
          </button>
        )}
      </div>

      <div className="absolute inset-0 z-0 jarvis-scanlines pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────
          MODE 1: AR SPATIAL TWIN
      ───────────────────────────────────────────────────────── */}
      {view === 'architecture' ? (
        <ArchitectureView station={station} telemetry={telemetry} activeScenario={activeScenario} />
      ) : view === 'twin' ? (
        <>
          {urgentAlert && (
            <div className={`emergency-alert-popup ${urgentAlert.severity === 'CRITICAL' ? 'critical' : 'warning'}`} role="alert">
              <div className="flex items-start gap-3">
                <div className="emergency-alert-icon"><AlertTriangle size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] tracking-[2px] font-bold">{urgentAlert.severity} // LIVE ALERT</div>
                  <strong className="block text-sm text-white text-glow-red mt-1">{urgentAlert.title}</strong>
                  <p className="text-[10px] text-cyan-100/80 mt-1">{urgentAlert.impact}</p>
                  <small className="block text-[9px] text-amber-200 mt-2">RECOMMENDED → {urgentAlert.action}</small>
                </div>
                <button onClick={() => setUrgentAlert(null)} className="text-cyan-400 hover:text-white" aria-label="Dismiss alert">×</button>
              </div>
            </div>
          )}
          <div className="absolute inset-0 z-0">
            <ThreeScene 
              machines={telemetry.machines} 
              selectedMachineId={isStationOverview ? 'overview' : selectedMachineId} 
              activeScenario={activeScenario} 
              station={station}
              onMachineClick={(id) => { 
                setIsStationOverview(false);
                setSelectedMachineId(id); 
                setIsModalOpen(true); 
              }} 
            />
          </div>

          <div className="absolute top-24 left-8 z-10 flex flex-col pointer-events-none w-[17rem]">
            <div className="pointer-events-auto">
              <TelemetryCard 
                machine={currentMachine} 
                allKeys={MACHINE_KEYS} 
                activeKey={selectedMachineId} 
                onSelectKey={(id) => {
                  setIsStationOverview(false);
                  setSelectedMachineId(id);
                }} 
                onOpenBlueprint={() => setIsModalOpen(true)} 
              />
            </div>
          </div>

          <div className="contingency-widget absolute bottom-6 left-8 z-10 pointer-events-auto">
            <div className="jarvis-panel p-2">
              <div className="flex items-center space-x-2 mb-2">
                <ShieldAlert className="w-3 h-3 text-cyan-400" />
                <span className="text-[8px] font-bold tracking-widest text-cyan-300 text-glow">CONTINGENCY VECTOR</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[8px]">
                {[{ id: 'NOMINAL', label: 'NOMINAL' }, { id: 'BLIZZARD', label: 'BLIZZARD' }, { id: 'GEN_FAILURE', label: 'GEN FAIL' }, { id: 'FUEL_FREEZE', label: 'LINE FREEZE' }].map((s) => (
                  <button key={s.id} onClick={() => triggerScenario(s.id)} className={`px-2 py-1 border transition-all ${activeScenario === s.id ? 'border-cyan-400 text-cyan-100 text-glow bg-cyan-400/20 shadow-[inset_0_0_10px_rgba(0,210,255,0.2)]' : 'border-cyan-900/60 text-cyan-500 hover:border-cyan-400/80 hover:text-cyan-300 bg-black/40'}`}>
                    {activeScenario === s.id ? '► ' : ''}{s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="machine-dock pointer-events-auto" aria-label="Station equipment selector">
            {MACHINE_KEYS.map((id) => (
              <button
                key={id}
                onClick={() => { setIsStationOverview(false); setSelectedMachineId(id); setIsModalOpen(true); }}
                className={selectedMachineId === id ? 'active' : ''}
              >
                {id === 'gen1' ? 'GENERATOR' : id === 'water' ? 'SNOW MELTER' : id === 'hvac' ? 'HVAC' : 'FUEL'}
              </button>
            ))}
          </div>

          {isModalOpen && (
            <BlueprintModal 
              machine={currentMachine} 
              isStationOverview={isStationOverview}
              station={station}
              onClose={() => setIsModalOpen(false)} 
              onDispatchDirective={() => { setSystemLog(`DIRECTIVE TRANSMITTED: Override accepted.`); setIsModalOpen(false); }} 
            />
          )}

          <div className="absolute bottom-6 right-8 z-10 text-[10px] font-bold tracking-widest text-cyan-400/80 text-glow pointer-events-none bg-black/40 px-3 py-1.5 border border-cyan-900/50">
            {systemLog} // BHARATI_LAT_69.4S
          </div>
        </>
      ) : (
        /* ─────────────────────────────────────────────────────────
            MODE 2: DATA CORE (FULLY RESTORED DASHBOARD)
        ───────────────────────────────────────────────────────── */
        <div className="absolute inset-0 z-10 dashboard-scroll-wrap pointer-events-auto">
          <div className="hero-row">
            <div>
              <p className="text-[10px] tracking-widest text-cyan-500 uppercase mb-2">STATION TELEMETRY ARCHIVE // SIH26060</p>
              <h1>{station === 'BHARATI_STATION' ? 'Bharati' : 'Maitri'} <em>Station</em></h1>
              <p className="text-[11px] text-cyan-600 mt-2 tracking-widest uppercase">Remote Autonomous Management & Causal Graph</p>
            </div>
            <div className="jarvis-panel flex items-center space-x-4 px-5 py-3">
              <div className={`health-orb ${statusClass(health)}`}><ShieldCheck size={20} /></div>
              <div>
                <small className="block text-[8px] tracking-[1px] text-cyan-500 uppercase">OVERALL STATION HEALTH</small>
                <strong className={`block text-[14px] text-glow tracking-widest ${statusClass(health) === 'good' ? 'text-emerald-400' : statusClass(health) === 'warning' ? 'text-amber-400' : 'text-red-500'}`}>{health}</strong>
                <span className="text-[9px] text-cyan-600">AI CONFIDENCE 94.2%</span>
              </div>
            </div>
          </div>

          <div className="metric-grid">
            <Metric icon={Zap} label="NET POWER" value={energy.power_consumption_kw} suffix=" kW" trend="+2.4%" />
            <Metric icon={BatteryCharging} label="FUEL RESERVE" value={energy.fuel_level_pct} suffix="%" trend="18 DAYS" tone="green" />
            <Metric icon={Thermometer} label="OUTSIDE TEMP" value={env.outside_temp_c} suffix="°C" trend="STABLE" tone="purple" />
            <Metric icon={Users} label="PERSONNEL SAFE" value={`${telemetry.personnel.safe}/${telemetry.personnel.total}`} trend="1 UNACCOUNTED" tone="amber" />
          </div>

          <div className="content-grid">
            <div className="flex flex-col space-y-4">
              <div className="jarvis-panel">
                <div className="panel-title"><span><Zap size={13} className="mr-2 inline"/> ENERGY FLOW / 24H</span> <span className="text-emerald-400 font-bold">● LIVE</span></div>
                <div className="flex justify-between items-center p-5 border-b border-cyan-500/20">
                  <div><small className="block text-[9px] text-cyan-600 tracking-widest mb-1">CONSUMPTION</small><b className="text-2xl text-cyan-200 text-glow">{energy.power_consumption_kw} <i className="text-xs text-cyan-500 not-italic">kW</i></b></div>
                  <div className="text-right"><small className="block text-[9px] text-cyan-600 tracking-widest mb-1">EFFICIENCY</small><b className="text-xl text-emerald-400 text-glow">{energy.efficiency_pct}%</b></div>
                </div>
                <div className="p-4 flex items-end space-x-1 h-20 opacity-70">
                  {[38, 45, 42, 58, 52, 66, 61, 73, 68, 79, 71, 82, 76, 69].map((h, i) => <div key={i} className={`flex-1 rounded-t-sm ${i > 10 ? 'bg-purple-500' : 'bg-cyan-500'}`} style={{ height: `${h}%` }} />)}
                </div>
              </div>

              <div className="jarvis-panel">
                <div className="panel-title"><span><CloudSnow size={13} className="mr-2 inline"/> POLAR ENVIRONMENT</span> <b className="text-cyan-400">LIVE</b></div>
                <div className="flex items-center space-x-4 p-5 border-b border-cyan-500/20">
                  <CloudSnow size={32} className="text-cyan-400" />
                  <div><b className="text-2xl text-white text-glow">{env.outside_temp_c}°C</b><span className="block text-[9px] text-cyan-600 tracking-widest">FEELS LIKE {env.outside_temp_c - 4}°C</span></div>
                  <div className="ml-auto text-right border-l border-cyan-900/50 pl-4"><strong className="text-lg text-white text-glow">{env.wind_knots} <small className="text-[10px] text-cyan-500">KTS</small></strong><span className="block text-[9px] text-cyan-600 tracking-widest">WIND {env.wind_direction}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-5 text-[9px] tracking-widest text-cyan-600">
                  <div>PRESSURE <b className="block mt-1 text-xs text-cyan-200">{env.pressure_hpa} hPa</b></div>
                  <div>HUMIDITY <b className="block mt-1 text-xs text-cyan-200">{env.humidity_pct}%</b></div>
                  <div>VISIBILITY <b className="block mt-1 text-xs text-cyan-200">{env.visibility_km} km</b></div>
                  <div>SNOW ACCUM. <b className="block mt-1 text-xs text-cyan-200">{env.snow_accumulation_cm} cm</b></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-4">
              <div className="jarvis-panel">
                <div className="panel-title"><span><AlertTriangle size={13} className="mr-2 inline"/> ALERT CENTER</span> <b className="text-red-400">{activeAlerts.filter((a) => a.severity !== 'GOOD').length} ACTIVE</b></div>
                {activeAlerts.map((alert) => (
                  <div className="alert-item" key={alert.id}>
                    <div className="alert-icon"><AlertTriangle size={10} /></div>
                    <div><strong className="block text-[10px] text-cyan-100 tracking-widest mb-1">{alert.title}</strong><span className="block text-[9px] text-cyan-500">{alert.impact}</span><small className="block text-[8px] text-cyan-400 mt-1">→ {alert.action}</small></div>
                  </div>
                ))}
              </div>

              <div className="jarvis-panel">
                <div className="panel-title"><span><Truck size={13} className="mr-2 inline"/> LOGISTICS RUNWAY</span> <b className="text-amber-400">RESUPPLY HIGH</b></div>
                {telemetry.inventory.slice(0, 3).map((item) => (
                  <div className="inventory-row" key={item.item}>
                    <span>{item.item} <small className="text-cyan-600 ml-2">{item.runway}</small></span>
                    <b className="text-cyan-100">{item.value}{item.unit}</b>
                  </div>
                ))}
                <div className="flex items-center space-x-2 bg-black/40 text-amber-200/80 p-3 m-3 text-[9px] tracking-widest border border-amber-500/30 rounded"><Gauge size={14}/><span>Diesel projected below safety threshold in <strong>11 days</strong>.</span></div>
              </div>

              <div className="jarvis-panel">
                <div className="panel-title"><span><Bot size={13} className="mr-2 inline"/> STATION AI</span> <b className="text-purple-400">LOCAL MODEL</b></div>
                <p className="text-[10px] text-cyan-300 leading-relaxed p-4 border-b border-cyan-500/20 bg-cyan-900/10 min-h-[4rem]">"{answer}"</p>
                <form onSubmit={askAssistant} className="flex m-4 border border-cyan-500/40 rounded">
                  <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Station AI..." className="flex-1 bg-transparent text-[10px] text-cyan-100 px-3 outline-none" />
                  <button className="bg-cyan-900/50 p-2 text-cyan-400 hover:text-cyan-200 transition-colors"><Radio size={12} /></button>
                </form>
              </div>
            </div>
          </div>

          <div className="advanced-grid">
            <div className="jarvis-panel">
              <div className="panel-title"><span><Activity size={13} className="mr-2 inline"/> CAUSAL INTELLIGENCE GRAPH</span></div>
              <div className="flex items-center gap-2 p-4 overflow-hidden">
                {['Environment', 'Energy', 'Generator', 'Fuel', 'Risk'].map((node, index) => (
                  <React.Fragment key={node}>
                    <div className={`causal-node ${index === 4 && telemetry.risk?.level !== 'LOW' ? 'risk-node' : ''}`}>
                      <strong className="block text-[9px] text-cyan-100 tracking-widest mb-1">{node}</strong>
                      <small className="text-[8px] text-cyan-600">{index === 0 ? 'Temp/Wind' : index === 1 ? 'kW Load' : index === 2 ? 'kW Out' : index === 3 ? '% Resv' : telemetry.risk?.level}</small>
                    </div>
                    {index < 4 && <span className="causal-arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="jarvis-panel">
              <div className="panel-title"><span><Layers size={13} className="mr-2 inline"/> WHAT-IF SIMULATION ENGINE</span></div>
              <div className="flex flex-wrap gap-2 p-4 border-b border-cyan-500/20">
                {['BLIZZARD', 'GEN_FAILURE', 'SUPPLY_DELAY'].map((preset) => (
                  <button key={preset} onClick={() => runWhatIf(preset)} disabled={whatIfLoading} className="text-[8px] tracking-widest text-purple-300 bg-purple-900/30 border border-purple-500/40 px-2 py-1 rounded hover:bg-purple-900/60">
                    {preset.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="p-4 flex items-center space-x-2 text-[10px] text-cyan-500 tracking-widest">
                {whatIf ? <span>PROJECTION: RISK SHIFT <b className="text-white text-glow">{whatIf.baseline_risk?.score || 18} → {whatIf.projected?.risk?.score || 45}</b></span> : <><Play size={12}/><span>Select a contingency preset to project risk.</span></>}
              </div>
            </div>

            <div className="jarvis-panel">
              <div className="panel-title"><span><Network size={13} className="mr-2 inline"/> PROJECT MESH-ZERO</span></div>
              <div className="grid grid-cols-3 gap-2 p-4 border-b border-cyan-500/20">
                <div><small className="block text-[8px] text-cyan-600 tracking-widest mb-1">PROTOCOL</small><strong className="text-[10px] text-cyan-200">PolarMesh/1.0</strong></div>
                <div><small className="block text-[8px] text-cyan-600 tracking-widest mb-1">QUEUED</small><strong className="text-[10px] text-cyan-200">0 PKTS</strong></div>
                <div><small className="block text-[8px] text-cyan-600 tracking-widest mb-1">PEER NODES</small><strong className="text-[10px] text-cyan-200">2 ACTIVE</strong></div>
              </div>
              <div className="p-4 text-[9px] text-cyan-500 tracking-widest">SATELLITE UPLINK NOMINAL — CRDT MERGE WINDOW READY</div>
            </div>
          </div>

          <div className="advanced-grid operations-grid">
            {role !== 'NCPOR HQ' && <div className="jarvis-panel">
              <div className="panel-title"><span><CalendarClock size={13} className="mr-2 inline"/> WEATHER-AWARE TASKS</span><b className={weatherTaskBlocked ? 'text-red-400' : 'text-emerald-400'}>{weatherTaskBlocked ? 'RESTRICTED' : 'CLEAR WINDOW'}</b></div>
              <div className="p-3 text-[9px] tracking-widest">
                <div className="flex justify-between border-b border-cyan-900/50 pb-2"><span>EXTERIOR MAINTENANCE</span><strong className={weatherTaskBlocked ? 'text-red-400' : 'text-emerald-400'}>{weatherTaskBlocked ? 'RESCHEDULE' : 'SCHEDULED'}</strong></div>
                <p className="text-cyan-500 mt-2">{weatherTaskBlocked ? 'Wind/visibility threshold exceeded. Indoor generator inspection recommended.' : 'Weather window open. Fuel-line inspection can proceed.'}</p>
              </div>
            </div>}

            {role !== 'RESEARCHER' && <div className="jarvis-panel">
              <div className="panel-title"><span><Gauge size={13} className="mr-2 inline"/> FUEL BURN-RATE PREDICTOR</span><b className="text-amber-400">FORECAST</b></div>
              <div className="p-3"><strong className="text-2xl text-cyan-200 text-glow">{fuelDays} <small className="text-xs text-cyan-500">DAYS</small></strong><p className="text-[9px] text-cyan-500 tracking-widest mt-2">PROJECTED RUNWAY AT CURRENT HEATING LOAD</p><div className="h-2 bg-cyan-950 mt-3"><div className="h-full bg-amber-400" style={{ width: `${Math.min(100, energy.fuel_level_pct)}%` }} /></div></div>
            </div>}

            {role !== 'RESEARCHER' && <div className="jarvis-panel">
              <div className="panel-title"><span><FileText size={13} className="mr-2 inline"/> TREATY COMPLIANCE</span><b className="text-cyan-400">MADRID PROTOCOL</b></div>
              <div className="p-3 text-[9px] text-cyan-500 tracking-widest"><p>Fuel, energy, environmental, and alert metrics are ready for export.</p><button onClick={downloadComplianceReport} className="mt-3 border border-cyan-500/60 px-3 py-2 text-cyan-100 hover:bg-cyan-400/20">DOWNLOAD CSV REPORT</button></div>
            </div>}

            <div className="jarvis-panel">
              <div className="panel-title"><span><ClipboardList size={13} className="mr-2 inline"/> SHIFT HANDOVER LOG</span><b className="text-purple-400">{handoverLog.length} NOTES</b></div>
              <form onSubmit={addHandoverNote} className="flex flex-wrap gap-2 p-3 border-b border-cyan-900/50"><input value={handoverNote} onChange={(event) => setHandoverNote(event.target.value)} placeholder="Add incoming-shift note..." className="min-w-0 flex-1 bg-black/40 border border-cyan-800 px-2 py-2 text-[9px] text-cyan-100 outline-none" /><select value={handoverPriority} onChange={(event) => setHandoverPriority(event.target.value)} className="bg-black/60 border border-cyan-800 px-1 text-[9px] text-cyan-200"><option>LOW</option><option>MEDIUM</option><option>CRITICAL</option></select><button className="border border-purple-500/60 px-2 text-purple-300">ADD</button></form>
              <div className="max-h-32 overflow-y-auto">{handoverLog.map((note) => <div key={note.id} className="px-3 py-2 border-b border-cyan-900/40 text-[9px]"><strong className={note.priority === 'CRITICAL' ? 'text-red-400' : note.priority === 'HIGH' ? 'text-amber-400' : 'text-cyan-200'}>{note.priority || 'MEDIUM'}</strong><span className="text-cyan-600 ml-2">{note.role} // {note.time}</span><p className="text-cyan-500 mt-1">{note.text}</p></div>)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}