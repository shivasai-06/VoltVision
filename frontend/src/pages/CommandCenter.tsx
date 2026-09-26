import { useEffect, useState } from 'react';
import { 
  ActivitySquare, 
  CheckCircle2, 
  XCircle, 
  RefreshCcw,
  IndianRupee,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { KpiCard } from '../components/dashboard/KpiCard';
import { TrendChart } from '../components/dashboard/TrendChart';
import { CorrelationPanel } from '../components/dashboard/CorrelationPanel';
import { InsightPanel } from '../components/dashboard/InsightPanel';
import { formatCompactNumber, formatPercent, formatCompactCurrency, formatCurrency } from '../utils/formatters';

interface KpiData {
  total_attempts: number;
  completed_swaps: number;
  completion_rate: number;
  total_revenue_inr: number;
  failure_rate: number;
  abandonment_rate: number;
  contribution_margin_per_swap: number;
  data_start_date: string;
  data_end_date: string;
}

interface ValidationData {
  status: string;
  checks: Record<string, boolean | object>;
}

export function CommandCenter() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchApi<KpiData>('/api/kpis'),
          fetchApi<any[]>('/api/network/trends'),
          fetchApi<any[]>('/api/network/correlations'),
          fetchApi<any[]>('/api/network/observations'),
          fetchApi<ValidationData>('/api/network/validation'),
        ]);
        
        const [kpiRes, trendRes, corrRes, obsRes, valRes] = results;

        if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value);
        if (trendRes.status === 'fulfilled') setTrends(trendRes.value);
        if (corrRes.status === 'fulfilled') setCorrelations(corrRes.value);
        if (obsRes.status === 'fulfilled') setObservations(obsRes.value);
        if (valRes.status === 'fulfilled') setValidation(valRes.value);

        if (results.some(r => r.status === 'rejected')) {
          setError('Some analytics modules failed to load. Displaying partial data.');
        }
      } catch (err) {
        setError('Failed to connect to the Analytics Engine.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Command Center</h1>
          <div className="text-slate-500 mt-1 flex items-center gap-2 text-sm font-medium">
            {loading ? (
              <span className="animate-pulse bg-slate-200 h-4 w-48 rounded inline-block"></span>
            ) : kpis ? (
              <span>Analysis period: {kpis.data_start_date} to {kpis.data_end_date}</span>
            ) : (
              <span>Analysis period: Unavailable</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {validation?.status === 'PASS' ? (
            <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              ANALYTICS VALIDATED
            </div>
          ) : validation ? (
            <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
              <AlertCircle className="w-4 h-4" />
              PARTIAL DATA
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="p-4 border border-rose-200 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-3 font-medium">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Attempts" 
          value={kpis ? formatCompactNumber(kpis.total_attempts) : ''} 
          icon={ActivitySquare} 
          loading={loading}
        />
        <KpiCard 
          title="Completed Swaps" 
          value={kpis ? formatCompactNumber(kpis.completed_swaps) : ''} 
          icon={CheckCircle2} 
          loading={loading}
        />
        <KpiCard 
          title="Completion Rate" 
          value={kpis ? formatPercent(kpis.completion_rate) : ''} 
          icon={TrendingUp} 
          loading={loading}
        />
        <KpiCard 
          title="Total Revenue" 
          value={kpis ? formatCompactCurrency(kpis.total_revenue_inr) : ''} 
          icon={IndianRupee} 
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <KpiCard 
          title="Failure Rate" 
          value={kpis ? formatPercent(kpis.failure_rate) : ''} 
          icon={XCircle} 
          loading={loading}
        />
        <KpiCard 
          title="Abandonment Rate" 
          value={kpis ? formatPercent(kpis.abandonment_rate) : ''} 
          icon={RefreshCcw} 
          loading={loading}
        />
        <KpiCard 
          title="Margin / Swap" 
          value={kpis ? formatCurrency(kpis.contribution_margin_per_swap) : ''} 
          icon={IndianRupee} 
          loading={loading}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 gap-6">
        <TrendChart 
          data={trends} 
          title="Network Scale Trend" 
          description="Completed swaps vs total revenue generated across the network."
          loading={loading}
        />
      </div>

      {/* Bottom Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CorrelationPanel correlations={correlations} loading={loading} />
        <InsightPanel observations={observations} loading={loading} />
      </div>

    </div>
  );
}
