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
import { InsightPanel } from '../components/dashboard/InsightPanel';
import { ResponsiveContainer, LineChart, BarChart, AreaChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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

export function NetworkAnalytics() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);
  const formatPercent = (num: number) => (num * 100).toFixed(2) + '%';
  const formatCurrency = (num: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);

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

  const trendData = trends.map(t => ({
    ...t,
    'Completion Rate (%)': Number((t.completion_rate * 100).toFixed(2)),
    'Failure Rate (%)': Number((t.failure_rate * 100).toFixed(2)),
    'Abandonment Rate (%)': Number((t.abandonment_rate * 100).toFixed(2))
  }));

  const ChartLoading = () => (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full h-[350px]">
      <div className="w-48 h-5 bg-secondary rounded mb-2"></div>
      <div className="w-64 h-3 bg-secondary rounded mb-6"></div>
      <div className="flex-1 bg-secondary/50 rounded h-[250px]"></div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Network Analytics</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Analyze network performance, trends, and relationships across the full operating period.
          </div>
          {kpis && (
            <div className="text-xs text-muted-foreground mt-2 font-medium">
              Analysis period: {kpis.data_start_date} → {kpis.data_end_date} | Network population: {formatNumber(kpis.total_attempts)} attempts
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {validation?.status === 'PASS' ? (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Data Validation: PASS
            </div>
          ) : validation ? (
            <div className="flex items-center gap-2 text-sm font-medium text-destructive bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20">
              <AlertCircle className="w-4 h-4" />
              Data Validation: {validation.status}
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Total Attempts" 
          value={kpis ? formatNumber(kpis.total_attempts) : ''} 
          icon={ActivitySquare} 
          loading={loading}
        />
        <KpiCard 
          title="Completed Swaps" 
          value={kpis ? formatNumber(kpis.completed_swaps) : ''} 
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
          value={kpis ? formatCurrency(kpis.total_revenue_inr) : ''} 
          icon={IndianRupee} 
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Volume and Revenue Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Completed Swaps Over Time</h3>
              <p className="text-sm text-muted-foreground">Monthly volume of completed swaps.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="completed_swaps" name="Completed Swaps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Revenue Over Time</h3>
              <p className="text-sm text-muted-foreground">Total network revenue in INR.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `₹${(val/1000).toFixed(0)}k` : `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Line type="monotone" dataKey="total_revenue" name="Total Revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Performance & Margin Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Service Performance Rates</h3>
              <p className="text-sm text-muted-foreground">Completion, failure, and abandonment over time.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="Completion Rate (%)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Failure Rate (%)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Abandonment Rate (%)" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Contribution Margin per Swap</h3>
              <p className="text-sm text-muted-foreground">Observed margin increased over the analyzed period.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Area type="monotone" dataKey="contribution_margin_per_completed_swap" name="Margin per Swap" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMargin)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Metric Relationships & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {loading ? (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full">
            <div className="w-48 h-5 bg-secondary rounded mb-4"></div>
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-secondary/50 rounded w-full"></div>)}
            </div>
          </div>
        ) : correlations.length > 0 ? (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Metric Relationships</h3>
              <p className="text-sm text-muted-foreground">Correlation indicates statistical association, not causation.</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-md">Relationship</th>
                    <th className="px-4 py-3">Variable</th>
                    <th className="px-4 py-3 rounded-tr-md">Coefficient</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(correlations.find(c => c.metric === 'completed_swaps') || {})
                    .filter(([k]) => k !== 'metric' && k !== 'completed_swaps')
                    .map(([key, val]: any) => (
                      <tr key={key} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-foreground">Completed Swaps vs.</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={val > 0.5 ? 'text-emerald-500 font-semibold' : val < -0.5 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                            {Number(val).toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Strong Positive</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive inline-block"></span> Strong Negative</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted-foreground inline-block"></span> Weak / Neutral</div>
            </div>
          </div>
        ) : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground">
            Unable to load correlation data.
          </div>
        )}

        <InsightPanel observations={observations} loading={loading} />
      </div>

    </div>
  );
}
