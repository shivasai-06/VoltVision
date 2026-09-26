import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchApi } from '../../api/client';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Command Center',
  '/station-risk': 'Station Risk',
  '/network': 'Network Analytics',
  '/battery': 'Battery Intelligence',
  '/pricing': 'Pricing & Partners',
  '/retention': 'Rider Retention',
  '/root-cause': 'Root Cause Explorer',
  '/decision-simulator': 'Decision Simulator',
};

export function Header() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';
  
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    let mounted = true;
    
    async function checkHealth() {
      try {
        await fetchApi('/api/health');
        if (mounted) setStatus('online');
      } catch (error) {
        if (mounted) setStatus('offline');
      }
    }

    checkHealth();
    
    // Poll every 30s
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-16 border-b border-border bg-white flex items-center justify-between px-8 shrink-0 shadow-sm z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-800">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
          {status === 'loading' && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>}
          {status === 'online' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
          {status === 'offline' && <div className="w-2 h-2 rounded-full bg-red-500"></div>}
          
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            {status === 'loading' ? 'Checking Engine' : 
             status === 'online' ? 'Analytics Engine Online' : 
             'Engine Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
