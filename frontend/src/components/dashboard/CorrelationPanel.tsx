
interface Correlation {
  metric: string;
  [key: string]: string | number;
}

interface CorrelationPanelProps {
  correlations: Correlation[];
  loading?: boolean;
}

export function CorrelationPanel({ correlations, loading }: CorrelationPanelProps) {
  if (loading) {
    return (
      <div className="p-6 border border-slate-200 bg-white rounded-2xl shadow-sm animate-pulse w-full">
        <div className="w-48 h-5 bg-slate-100 rounded mb-2"></div>
        <div className="w-64 h-3 bg-slate-100 rounded mb-6"></div>
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg w-full"></div>)}
        </div>
      </div>
    );
  }

  // Filter to show relationships to completed_swaps as an example
  const targetMetric = correlations.find(c => c.metric === 'completed_swaps');
  
  if (!targetMetric) return null;

  const validKeys = Object.keys(targetMetric).filter(k => k !== 'metric' && k !== 'completed_swaps');

  return (
    <div className="p-6 border border-slate-200/60 bg-white rounded-2xl shadow-sm w-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Metric Relationships</h3>
        <p className="text-sm text-slate-500 mt-1">Correlations with completed swaps. Note: Correlation indicates association, not causation.</p>
      </div>
      
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
            <tr>
              <th className="px-5 py-3">Metric</th>
              <th className="px-5 py-3 text-right">Correlation Coefficient</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {validKeys.map((key) => {
              const val = Number(targetMetric[key]);
              const formatKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              
              // Map strong positive to emerald, strong negative to amber/red
              let valColor = "text-slate-500";
              let bgIndicator = "";
              
              if (val > 0.6) { valColor = "text-emerald-600 font-bold"; bgIndicator = "bg-emerald-50"; }
              else if (val > 0.3) { valColor = "text-emerald-500 font-medium"; }
              else if (val < -0.6) { valColor = "text-rose-600 font-bold"; bgIndicator = "bg-rose-50"; }
              else if (val < -0.3) { valColor = "text-rose-500 font-medium"; }

              return (
                <tr key={key} className={`transition-colors hover:bg-slate-50 ${bgIndicator}`}>
                  <td className="px-5 py-4 font-medium text-slate-700">{formatKey}</td>
                  <td className={`px-5 py-4 text-right ${valColor}`}>
                    {val > 0 ? '+' : ''}{val.toFixed(3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
