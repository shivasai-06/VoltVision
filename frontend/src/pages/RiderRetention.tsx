import { useEffect, useState } from 'react';
import { 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  UserCheck,
  UserMinus,
  Info
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { KpiCard } from '../components/dashboard/KpiCard';
import { InsightPanel } from '../components/dashboard/InsightPanel';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface ValidationData {
  status: string;
  checks: Record<string, boolean | object>;
}

export function RiderRetention() {
  const [summary, setSummary] = useState<any>(null);
  const [firstExperience, setFirstExperience] = useState<any[]>([]);
  const [failureRel, setFailureRel] = useState<any[]>([]);
  const [pricingRel, setPricingRel] = useState<any[]>([]);
  const [supportRel, setSupportRel] = useState<any[]>([]);
  const [cohortData, setCohortData] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);
  const formatPercent = (num: number) => (num * 100).toFixed(2) + '%';

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchApi<any[]>('/api/rider-retention/summary'),
          fetchApi<any[]>('/api/rider-retention/first-experience'),
          fetchApi<any[]>('/api/rider-retention/segments'),
          fetchApi<any[]>('/api/rider-retention/failure-relationship'),
          fetchApi<any[]>('/api/rider-retention/pricing-relationship'),
          fetchApi<any[]>('/api/rider-retention/support-relationship'),
          fetchApi<any[]>('/api/rider-retention/factors'),
          fetchApi<any[]>('/api/rider-retention/cohort'),
          fetchApi<any[]>('/api/rider-retention/flags'),
          fetchApi<any>('/api/rider-retention/observations'),
          fetchApi<ValidationData>('/api/rider-retention/validation'),
        ]);

        if (results[0].status === 'fulfilled' && results[0].value.length > 0) setSummary(results[0].value[0]);
        if (results[1].status === 'fulfilled') setFirstExperience(results[1].value);
        
        if (results[3].status === 'fulfilled') setFailureRel(results[3].value);
        if (results[4].status === 'fulfilled') setPricingRel(results[4].value);
        if (results[5].status === 'fulfilled') setSupportRel(results[5].value);
        
        if (results[7].status === 'fulfilled') setCohortData(results[7].value);
        if (results[8].status === 'fulfilled') setFlags(results[8].value);
        
        const obsRes = results[9];
        if (obsRes.status === 'fulfilled') {
          setObservations(obsRes.value?.observations?.map((o: any) => ({ 
            observation_type: o.topic || 'Retention Insight', 
            period: 'All Time', 
            description: o.observation || o 
          })) || []);
        }

        if (results[10].status === 'fulfilled') setValidation(results[10].value);

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

  const ChartLoading = () => (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full h-[350px]">
      <div className="w-48 h-5 bg-secondary rounded mb-2"></div>
      <div className="w-64 h-3 bg-secondary rounded mb-6"></div>
      <div className="flex-1 bg-secondary/50 rounded h-[250px]"></div>
    </div>
  );

  // Process data for charts
  const earlyFailureData = failureRel.filter(f => f.factor === 'had_early_failure').map(f => ({
    name: f.factor_value === 'True' || f.factor_value === true ? 'Had Early Failure' : 'No Early Failure',
    rate: Number((f.retention_rate * 100).toFixed(2)),
    riders: f.rider_count
  }));

  const supportData = supportRel.filter(f => f.factor === 'had_support_ticket').map(f => ({
    name: f.factor_value === 'True' || f.factor_value === true ? 'Had Ticket' : 'No Ticket',
    rate: Number((f.retention_rate * 100).toFixed(2)),
    riders: f.rider_count
  }));

  const pricingData = pricingRel.filter(f => f.factor === 'first_price_bucket').map(f => ({
    name: String(f.factor_value),
    rate: Number((f.retention_rate * 100).toFixed(2)),
    riders: f.rider_count
  })).sort((a, b) => a.name.localeCompare(b.name));

  const firstExperienceData = firstExperience.filter(f => f.factor === 'first_completed').map(f => ({
    name: f.factor_value === 'True' || f.factor_value === true ? 'Completed' : 'Failed/Abandoned',
    rate: Number((f.retention_rate * 100).toFixed(2)),
    riders: f.rider_count
  }));

  const cohortVisualData = cohortData.map(c => ({
    name: `${c.segment} ${c.first_failed ? '(Failed 1st)' : '(OK 1st)'}`,
    rate: Number((c.retention_rate * 100).toFixed(2)),
    riders: c.rider_count
  }));

  // Aggregate flags
  let highEarlyFailure = 0;
  let poorCsat = 0;
  let churnedWithTickets = 0;
  flags.forEach(f => {
    if (f.flag_high_early_failure) highEarlyFailure++;
    if (f.flag_poor_csat) poorCsat++;
    if (f.flag_churned_with_tickets) churnedWithTickets++;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Rider Retention & Root Cause</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Understand rider retention patterns, first experiences, and factors associated with return behavior.
          </div>
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
          title="Total New Riders" 
          value={summary ? formatNumber(summary.total_new_riders_observed) : ''} 
          icon={Users} 
          loading={loading}
        />
        <KpiCard 
          title="Eligible For 30D Follow-Up" 
          value={summary ? formatNumber(summary.eligible_30d_followup_riders) : ''} 
          icon={Activity} 
          loading={loading}
        />
        <KpiCard 
          title="30-Day Retention" 
          value={summary ? formatPercent(summary.retention_rate_30d) : ''} 
          icon={UserCheck} 
          loading={loading}
        />
        <KpiCard 
          title="Non-Return Rate" 
          value={summary ? formatPercent(summary.non_return_rate_30d) : ''} 
          icon={UserMinus} 
          loading={loading}
        />
      </div>

      <div className="p-4 border border-border bg-secondary/10 rounded-xl flex items-start gap-3 text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <strong className="text-foreground font-medium block mb-1">Root-Cause Interpretation Guide</strong>
          This dashboard presents observed associations, which represent differing retention rates across groups. 
          An observed relationship is a possible contributing factor but does not establish causal proof. 
          Missing CSAT scores are explicitly treated as missing data, not negative sentiment.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Failure Exposure vs Retention</h3>
              <p className="text-sm text-muted-foreground">Observed association only — this analysis does not establish causation.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earlyFailureData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[99, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any, name: any) => name === 'Retention Rate' ? [`${val}%`, name] : [val, name]}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="rate" name="Retention Rate" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {earlyFailureData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              * Note: Counterintuitively, early failure is associated with slightly higher observed retention.
            </div>
          </div>
        )}

        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">First Experience & Retention</h3>
              <p className="text-sm text-muted-foreground">Retention based on whether the very first swap attempt succeeded.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={firstExperienceData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[99, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any, name: any) => name === 'Retention Rate' ? [`${val}%`, name] : [val, name]}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="rate" name="Retention Rate" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Pricing vs Retention</h3>
              <p className="text-sm text-muted-foreground">Observed association across first transaction price bands.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pricingData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[98, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any, name: any) => name === 'Retention Rate' ? [`${val}%`, name] : [val, name]}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="rate" name="Retention Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Support Experience vs Retention</h3>
              <p className="text-sm text-muted-foreground">Observed association between support interactions and retention.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supportData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[98, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any, name: any) => name === 'Retention Rate' ? [`${val}%`, name] : [val, name]}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="rate" name="Retention Rate" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Retention Cohort Analysis</h3>
              <p className="text-sm text-muted-foreground">Retention rates segmented by rider group and first-swap outcome.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortVisualData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[99, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any, name: any) => name === 'Retention Rate' ? [`${val}%`, name] : [val, name]}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="rate" name="Retention Rate" fill="#14b8a6" radius={[0, 4, 4, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Retention Flags</h3>
              <p className="text-sm text-muted-foreground">Analytically flagged subpopulations across {formatNumber(flags.length)} tracked riders.</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 border border-border rounded-lg">
                <span className="text-sm font-medium">High Early Failure Exposure</span>
                <span className="text-sm font-bold bg-secondary px-2 py-1 rounded">{formatNumber(highEarlyFailure)} riders</span>
              </div>
              <div className="flex justify-between items-center p-3 border border-border rounded-lg">
                <span className="text-sm font-medium">Poor CSAT Detected</span>
                <span className="text-sm font-bold bg-secondary px-2 py-1 rounded">{formatNumber(poorCsat)} riders</span>
              </div>
              <div className="flex justify-between items-center p-3 border border-border rounded-lg">
                <span className="text-sm font-medium">Churned With Support Tickets</span>
                <span className="text-sm font-bold bg-secondary px-2 py-1 rounded">{formatNumber(churnedWithTickets)} riders</span>
              </div>
            </div>
          </div>
          
          <InsightPanel observations={observations} loading={loading} />
        </div>
      </div>
      
    </div>
  );
}
