import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Activity, 
  Battery, 
  DollarSign, 
  Users, 
  Search, 
  GitMerge, 
  Zap,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/network', label: 'Network Analytics', icon: Activity },
    ]
  },
  {
    title: 'Operations',
    items: [
      { path: '/station-risk', label: 'Station Risk', icon: AlertTriangle },
      { path: '/battery', label: 'Battery Intelligence', icon: Battery },
    ]
  },
  {
    title: 'Commercial',
    items: [
      { path: '/pricing', label: 'Pricing & Partner Economics', icon: DollarSign },
      { path: '/retention', label: 'Rider Retention', icon: Users },
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/root-cause', label: 'Root Cause Explorer', icon: Search },
      { path: '/decision-simulator', label: 'Decision Simulator', icon: GitMerge },
    ]
  }
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 z-20 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-[#0f172a] text-slate-300 flex flex-col h-full flex-shrink-0 shadow-xl transition-transform duration-300 ease-in-out md:translate-x-0 md:static",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 fill-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">VoltVision</h1>
              <p className="text-[10px] text-emerald-400/80 uppercase tracking-[0.2em] mt-1 font-semibold">EV Network Intelligence</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => { if (window.innerWidth < 768 && onClose) onClose(); }}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group relative",
                        isActive 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )
                    }
                  >
                    <item.icon className={cn(
                      "w-4 h-4 transition-colors",
                      "group-hover:text-emerald-400"
                    )} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto bg-slate-900/50">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <div className="text-xs text-slate-400">
              VoltRelay Analytics Prototype<br />
              <span className="text-slate-500">v1.0.0-beta</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
