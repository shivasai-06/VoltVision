import type { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  context?: string;
  className?: string;
  loading?: boolean;
}

export function KpiCard({ title, value, icon: Icon, context, className, loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn("p-5 border border-border bg-card rounded-xl animate-pulse", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="w-24 h-4 bg-secondary rounded"></div>
          <div className="w-8 h-8 bg-secondary rounded"></div>
        </div>
        <div className="w-32 h-8 bg-secondary rounded mb-2"></div>
        {context && <div className="w-40 h-3 bg-secondary rounded"></div>}
      </div>
    );
  }

  return (
    <div className={cn("p-6 border border-slate-200/60 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden", className)}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 ring-1 ring-emerald-500/10">
          <Icon className="w-4 h-4" strokeWidth={2.5} />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-800 tracking-tight">{value}</div>
      {context && <p className="text-sm font-medium text-slate-500 mt-2">{context}</p>}
    </div>
  );
}
