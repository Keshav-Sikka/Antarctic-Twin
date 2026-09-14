import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Fan, Flame, Lightbulb, Radio, RotateCcw, Thermometer, Users, Zap } from 'lucide-react';

const ROOM_BLUEPRINTS = {
  BHARATI_STATION: [
    ['B-01', 'Crew Quarters', 21.4, 3, 'LIVING'],
    ['B-02', 'Laboratory', 22.1, 4, 'RESEARCH'],
    ['B-03', 'Power Room', 24.8, 1, 'UTILITY'],
    ['B-04', 'Medical Bay', 21.8, 1, 'MEDICAL'],
    ['B-05', 'Operations Hub', 22.4, 2, 'CONTROL'],
    ['B-06', 'Storage / Galley', 19.6, 3, 'LOGISTICS'],
    ['B-07', 'Communications Room', 22.0, 1, 'COMMS']
  ],
  MAITRI_STATION: [
    ['M-01', 'Crew Quarters', 21.0, 3, 'LIVING'],
    ['M-02', 'Laboratory', 21.7, 5, 'RESEARCH'],
    ['M-03', 'Generator Control', 25.2, 1, 'UTILITY'],
    ['M-04', 'Medical Bay', 21.5, 1, 'MEDICAL'],
    ['M-05', 'Operations Hub', 22.2, 2, 'CONTROL'],
    ['M-06', 'Workshop / Storage', 19.2, 2, 'LOGISTICS'],
    ['M-07', 'Communications Room', 21.8, 1, 'COMMS']
  ]
};

const makeRooms = (station) => ROOM_BLUEPRINTS[station].map(([id, name, temperature, occupants, type], index) => ({
  id, name, type, occupants, temperature, humidity: 38 + index * 3, heater: true, fan: true, lights: index !== 6, power: 1.4 + (index % 3) * 0.35
}));

const causeText = {
  HEATER_FAULT: ['HEATER FAILURE', 'Heater command is ON but thermal output is below expected range.', 'Dispatch maintenance to inspect the room heater and isolate its circuit.'],
  POWER_LOSS: ['LOCAL POWER LOSS', 'Room lighting and heater telemetry dropped with the local circuit.', 'Trace the feeder from the power room and switch to backup supply.'],
  DOOR_OPEN: ['INSULATION / DOOR OPEN', 'Temperature is falling while the heater is still producing output.', 'Close the external door and inspect the airlock seal.']
};

export default function RoomOperationsView({ station }) {
  const [rooms, setRooms] = useState(() => makeRooms(station));
  const [selectedId, setSelectedId] = useState(() => makeRooms(station)[0].id);
  const [fault, setFault] = useState(null);
  const [cause, setCause] = useState('HEATER_FAULT');

  useEffect(() => {
    setRooms(makeRooms(station));
    setSelectedId(makeRooms(station)[0].id);
    setFault(null);
  }, [station]);

  useEffect(() => {
    if (fault) return undefined;
    const timer = window.setInterval(() => {
      setRooms((current) => current.map((room) => ({
        ...room,
        temperature: Number((room.temperature + (room.heater ? 0.03 : -0.05) + (Math.random() - 0.5) * 0.08).toFixed(1))
      })));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [fault]);

  const selected = rooms.find((room) => room.id === selectedId) || rooms[0];
  const roomPower = rooms.reduce((sum, room) => sum + room.power * (room.lights ? 1 : 0.65) + (room.heater ? 1.1 : 0), 0);
  const triggerFault = (nextCause = cause) => {
    setCause(nextCause);
    setFault({ roomId: selected.id, cause: nextCause, startedAt: new Date().toLocaleTimeString() });
    setRooms((current) => current.map((room) => room.id === selected.id ? {
      ...room,
      temperature: Number((room.temperature - 6.5).toFixed(1)),
      heater: nextCause === 'DOOR_OPEN',
      lights: nextCause === 'POWER_LOSS' ? false : room.lights,
      power: nextCause === 'POWER_LOSS' ? 0.35 : room.power
    } : room));
  };
  const resetDemo = () => { setRooms(makeRooms(station)); setFault(null); };

  return (
    <main className="room-ops-wrap">
      <div className="room-ops-heading">
        <div>
          <p className="text-[10px] tracking-[3px] text-cyan-500">POLARCORE // ROOM-SCALE DIGITAL TWIN</p>
          <h1>{station === 'BHARATI_STATION' ? 'Bharati' : 'Maitri'} <em>Room Operations</em></h1>
          <p className="text-[10px] text-cyan-600 mt-2 tracking-widest">7 ROOMS // 28 HVAC / LIGHT / FAN SIGNALS // SIMULATED LIVE TELEMETRY</p>
        </div>
        <div className="room-summary jarvis-panel"><strong>{rooms.length}</strong><span>ROOMS<br />TRACKED</span><b>{roomPower.toFixed(1)} kW<br /><small>ROOM LOAD</small></b></div>
      </div>

      <div className="room-ops-layout">
        <section className="jarvis-panel room-floorplan">
          <div className="panel-title"><span><Radio size={13} className="mr-2 inline" /> ROOM FLOORPLAN / LIVE STATE</span><b className="text-emerald-400">● LIVE</b></div>
          <div className="room-grid">
            {rooms.map((room) => (
              <button key={room.id} onClick={() => setSelectedId(room.id)} className={`room-node ${selectedId === room.id ? 'selected' : ''} ${fault?.roomId === room.id ? 'fault' : ''}`}>
                <span>{room.id}</span><strong>{room.name}</strong><b>{room.temperature}°C</b><small>{room.occupants} OCCUPIED</small>
              </button>
            ))}
          </div>
          <div className="room-legend"><span><i className="good-dot" /> Nominal</span><span><i className="warn-dot" /> Anomaly</span><span>Prototype room plan — verify against station CAD/BIM before operational use.</span></div>
        </section>

        <aside className="room-detail jarvis-panel">
          <div className="panel-title"><span><Thermometer size={13} className="mr-2 inline" /> {selected.id} // ROOM TELEMETRY</span><b className={fault?.roomId === selected.id ? 'text-red-400' : 'text-emerald-400'}>{fault?.roomId === selected.id ? 'ALERT' : 'NORMAL'}</b></div>
          <div className="room-detail-title"><h2>{selected.name}</h2><small>{selected.type} // {selected.occupants} PERSONNEL</small></div>
          <div className="room-metrics">
            <div><Thermometer size={14} /><span>TEMPERATURE<strong>{selected.temperature} °C</strong></span></div>
            <div><Zap size={14} /><span>ROOM LOAD<strong>{selected.power.toFixed(1)} kW</strong></span></div>
            <div><Users size={14} /><span>OCCUPANCY<strong>{selected.occupants} SAFE</strong></span></div>
            <div><span>HUMIDITY<strong>{selected.humidity}%</strong></span></div>
          </div>
          <div className="room-device-list">
            {[
              ['Heater', Flame, selected.heater, 'heater'],
              ['Ventilation fan', Fan, selected.fan, 'fan'],
              ['Lights', Lightbulb, selected.lights, 'lights']
            ].map(([label, DeviceIcon, enabled, key]) => (
              <button key={key} onClick={() => setRooms((current) => current.map((room) => room.id === selected.id ? { ...room, [key]: !room[key], power: key === 'lights' && room[key] ? Math.max(.3, room.power - .35) : room.power + (key === 'lights' ? .35 : 0) } : room))}>
                <DeviceIcon size={14} /><span>{label}</span><b className={enabled ? 'on' : 'off'}>{enabled ? 'ON' : 'OFF'}</b>
              </button>
            ))}
          </div>
          <div className="room-demo-controls">
            <div className="panel-title"><span><AlertTriangle size={13} className="mr-2 inline" /> LIVE FAULT DEMO</span><b className="text-amber-400">SIMULATION</b></div>
            <select value={cause} onChange={(event) => setCause(event.target.value)}><option value="HEATER_FAULT">Heater damaged</option><option value="POWER_LOSS">Local power loss</option><option value="DOOR_OPEN">Door / insulation leak</option></select>
            <div className="flex gap-2"><button onClick={() => triggerFault()} className="room-demo-button"><AlertTriangle size={12} /> DROP ROOM TEMP</button><button onClick={resetDemo} className="room-reset"><RotateCcw size={12} /> RESET</button></div>
          </div>
          {fault && <div className="room-alert"><strong>⚠ {causeText[fault.cause][0]} // {fault.roomId}</strong><p>{causeText[fault.cause][1]}</p><small>RECOMMENDED → {causeText[fault.cause][2]}</small></div>}
        </aside>
      </div>
    </main>
  );
}
