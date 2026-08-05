import { useState, useEffect } from 'react';
import { ConnectOBS, GetBridgeStatus, SendRconCommand } from '../wailsjs/go/main/App';
import type { bridge } from '../wailsjs/go/models';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [bridgeStatus, setBridgeStatus] = useState<bridge.Status | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setBridgeStatus(await GetBridgeStatus());
      } catch (err) {
        console.error('Failed to get bridge status', err);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // M-10 — surface whatever the backend actually says. OBS and RCON are still
  // unimplemented, and the log has to show that rather than a cheerful message.
  const handleConnectObs = async () => {
    addLog('Connecting to OBS...');
    try {
      await ConnectOBS('127.0.0.1', 4455, '');
      addLog('OBS connected.');
    } catch (err) {
      addLog(`OBS connect failed: ${err}`);
    }
  };

  const handleConnectGame = async () => {
    addLog('Connecting to Game...');
    try {
      const reply = await SendRconCommand('127.0.0.1', 25575, '', 'status');
      addLog(`RCON replied: ${reply}`);
    } catch (err) {
      addLog(`RCON connect failed: ${err}`);
    }
  };

  const handleEmergencyStop = () => {
    addLog('EMERGENCY STOP TRIGGERED!');
    // Ideally this would invoke a command to stop all simulations
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>TikTok LIVE Desktop</h1>
        <button className="btn-primary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2>Local Bridge</h2>
          {bridgeStatus ? (
            <div>
              <p><span className={`status-dot ${bridgeStatus.is_running ? 'status-green' : 'status-red'}`}></span>
                {bridgeStatus.is_running ? 'Running' : 'Stopped'}</p>
              <p>Port: {bridgeStatus.port}</p>
              <p>Clients: {bridgeStatus.connected_clients}</p>
              <p>Token: <code>{bridgeStatus.session_token}</code></p>
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </div>

        <div className="card">
          <h2>OBS Controller</h2>
          <p><span className="status-dot status-red"></span>Disconnected</p>
          <button className="btn-primary" onClick={handleConnectObs}>Connect OBS</button>
        </div>

        <div className="card">
          <h2>Game RCON</h2>
          <p><span className="status-dot status-red"></span>Disconnected</p>
          <button className="btn-primary" onClick={handleConnectGame}>Connect Game</button>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '3rem 0' }}>
        <button className="btn-danger" onClick={handleEmergencyStop}>
          EMERGENCY STOP
        </button>
        <p style={{ marginTop: '1rem', opacity: 0.7 }}>Instantly cancels all pending key presses and macros</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>System Logs</h2>
        <div className="log-viewer">
          {logs.length === 0 ? <p style={{ color: '#888' }}>No logs yet...</p> : null}
          {logs.map((log, i) => (
            <p key={i} className="log-line">{log}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
