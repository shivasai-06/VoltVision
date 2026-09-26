import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { formatCompactNumber, formatPercent } from '../../utils/formatters';

interface Station {
  station_id: string;
  city: string;
  total_attempts: number;
  completed_swaps: number;
  failure_rate: number;
  abandonment_rate: number;
  average_queue_wait: number;
}

interface StationRiskTableProps {
  stations: Station[];
  loading?: boolean;
}

export function StationRiskTable({ stations, loading }: StationRiskTableProps) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    if (!stations) return [];
    const lower = search.toLowerCase();
    return stations.filter(s => 
      s.station_id.toLowerCase().includes(lower) || 
      s.city.toLowerCase().includes(lower)
    ).sort((a, b) => b.failure_rate - a.failure_rate);
  }, [stations, search]);

  if (loading) {
    return (
      <div className="p-6 border border-slate-200 bg-white rounded-2xl shadow-sm animate-pulse w-full">
        <div className="w-48 h-5 bg-slate-100 rounded mb-2"></div>
        <div className="h-10 bg-slate-100 rounded-lg mb-4 w-full md:w-1/3"></div>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg w-full"></div>)}
        </div>
      </div>
    );
  }

  if (!stations || stations.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl text-center text-slate-400 font-medium text-sm">
        Unable to load station performance data.
      </div>
    );
  }

  return (
    <div className="border border-slate-200/60 bg-white rounded-2xl shadow-sm w-full overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="p-6 pb-4 border-b border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Station Performance</h3>
            <p className="text-sm text-slate-500 mt-1">Sorted by failure rate severity.</p>
          </div>
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Search station or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-5 py-3 whitespace-nowrap">Station</th>
              <th className="px-5 py-3 whitespace-nowrap">City</th>
              <th className="px-5 py-3 text-right whitespace-nowrap">Attempts</th>
              <th className="px-5 py-3 text-right whitespace-nowrap">Completed</th>
              <th className="px-5 py-3 text-right whitespace-nowrap">Failure Rate</th>
              <th className="px-5 py-3 text-right whitespace-nowrap">Abandon Rate</th>
              <th className="px-5 py-3 text-right whitespace-nowrap">Avg Queue Wait</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.slice(0, 50).map((station) => (
              <tr key={station.station_id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">{station.station_id}</td>
                <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{station.city}</td>
                <td className="px-5 py-4 text-right text-slate-700 font-medium whitespace-nowrap">{formatCompactNumber(station.total_attempts)}</td>
                <td className="px-5 py-4 text-right text-slate-700 font-medium whitespace-nowrap">{formatCompactNumber(station.completed_swaps)}</td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${station.failure_rate > 0.05 ? 'bg-rose-100 text-rose-700' : 'text-slate-600'}`}>
                    {formatPercent(station.failure_rate)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${station.abandonment_rate > 0.03 ? 'bg-amber-100 text-amber-700' : 'text-slate-600'}`}>
                    {formatPercent(station.abandonment_rate)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-slate-500 whitespace-nowrap font-medium">{station.average_queue_wait.toFixed(0)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 50 && (
          <div className="px-5 py-4 text-xs font-medium text-slate-400 text-center border-t border-slate-100 bg-slate-50 sticky bottom-0">
            Showing top 50 of {formatCompactNumber(filtered.length)} stations matching search.
          </div>
        )}
      </div>
    </div>
  );
}
