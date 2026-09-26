import { useEffect, useState } from 'react';
import { 
  IndianRupee, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { KpiCard } from '../components/dashboard/KpiCard';
import { InsightPanel } from '../components/dashboard/InsightPanel';
import { FleetPartnerTable } from '../components/dashboard/FleetPartnerTable';
import { PricingFlags } from '../components/dashboard/PricingFlags';
import { ResponsiveContainer, BarChart, AreaChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface ValidationData {
  status: string;
  checks: Record<string, boolean | object>;
}

export function PricingEconomics() {
  const [monthly, setMonthly] = useState<any[]>([]);
  const [peakOffpeak, setPeakOffpeak] = useState<any[]>([]);
  const [fleetRetail, setFleetRetail] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [city, setCity] = useState<any[]>([]);
  const [vehicle, setVehicle] = useState<any[]>([]);
  const [revMargin, setRevMargin] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);
  const formatCurrency = (num: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchApi<any[]>('/api/pricing/monthly'),
          fetchApi<any[]>('/api/pricing/peak-offpeak'),
          fetchApi<any[]>('/api/pricing/fleet-vs-retail'),
          fetchApi<any[]>('/api/pricing/fleet-partners'),
          fetchApi<any[]>('/api/pricing/city'),
          fetchApi<any[]>('/api/pricing/vehicle-class'),
          fetchApi<any[]>('/api/pricing/period'),
          fetchApi<any[]>('/api/pricing/revenue-margin'),
          fetchApi<any[]>('/api/pricing/flags'),
          fetchApi<any>('/api/pricing/observations'),
          fetchApi<ValidationData>('/api/pricing/validation'),
        ]);

        if (results[0].status === 'fulfilled') setMonthly(results[0].value);
        if (results[1].status === 'fulfilled') setPeakOffpeak(results[1].value);
        if (results[2].status === 'fulfilled') setFleetRetail(results[2].value);
        if (results[3].status === 'fulfilled') setPartners(results[3].value);
        if (results[4].status === 'fulfilled') setCity(results[4].value);
        if (results[5].status === 'fulfilled') setVehicle(results[5].value);
        if (results[7].status === 'fulfilled') setRevMargin(results[7].value);
        if (results[8].status === 'fulfilled') setFlags(results[8].value);
        
        const obsRes = results[9];
        if (obsRes.status === 'fulfilled') {
          setObservations(obsRes.value?.observations?.map((o: any) => ({ 
            observation_type: o.topic || 'Pricing Insight', 
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
  
  let kpiTotalAttempts = 0;
  let kpiCompleted = 0;
  let kpiRevenue = 0;
  let kpiTotalMargin = 0;
  let kpiValidMarginEvents = 0;

  monthly.forEach(m => {
    kpiTotalAttempts += m.total_attempts || 0;
    kpiCompleted += m.completed_swaps || 0;
    kpiRevenue += m.revenue || 0;
    kpiTotalMargin += m.total_margin || 0;
    kpiValidMarginEvents += m.valid_margin_events || 0;
  });

  const revPerSwap = kpiCompleted ? kpiRevenue / kpiCompleted : 0;
  const marginPerSwap = kpiValidMarginEvents ? kpiTotalMargin / kpiValidMarginEvents : 0;

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pricing & Partner Economics</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Analyze pricing behavior, revenue, contribution margin, and partner economics.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard 
          title="Analytical Population" 
          value={kpiTotalAttempts > 0 ? formatNumber(kpiTotalAttempts) : ''} 
          icon={Activity} 
          loading={loading}
        />
        <KpiCard 
          title="Completed Swaps" 
          value={kpiCompleted > 0 ? formatNumber(kpiCompleted) : ''} 
          icon={CheckCircle2} 
          loading={loading}
        />
        <KpiCard 
          title="Total Revenue" 
          value={kpiRevenue > 0 ? '₹' + new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(kpiRevenue) : ''} 
          icon={IndianRupee} 
          loading={loading}
        />
        <KpiCard 
          title="Avg Revenue / Swap" 
          value={kpiRevenue > 0 ? formatCurrency(revPerSwap) : ''} 
          icon={TrendingUp} 
          loading={loading}
        />
        <KpiCard 
          title="Margin / Swap" 
          value={kpiTotalMargin > 0 ? formatCurrency(marginPerSwap) : ''} 
          icon={TrendingUp} 
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Monthly Revenue & Economics</h3>
              <p className="text-sm text-muted-foreground">Total network revenue over the observed period.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="event_month_str" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `₹${(val/1000000).toFixed(0)}M` : `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Revenue vs Contribution Margin</h3>
              <p className="text-sm text-muted-foreground">Observed contribution margin per swap increased over time.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revMargin} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="event_month_str" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Area type="monotone" dataKey="margin_per_completed_swap" name="Margin per Swap" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMar)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Peak vs Off-Peak Economics</h3>
              <p className="text-sm text-muted-foreground">Observed performance differences between demand periods.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakOffpeak} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="is_peak" tickFormatter={(val) => val ? 'Peak' : 'Off-Peak'} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelFormatter={(val) => val ? 'Peak' : 'Off-Peak'}
                    formatter={(val: any) => formatCurrency(Number(val))}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue_per_completed_swap" name="Rev / Swap" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="margin_per_completed_swap" name="Margin / Swap" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Fleet vs Retail Economics</h3>
              <p className="text-sm text-muted-foreground">Performance segments let the data speak for itself.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fleetRetail} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="is_fleet" tickFormatter={(val) => val ? 'Fleet' : 'Retail'} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelFormatter={(val) => val ? 'Fleet' : 'Retail'}
                    formatter={(val: any) => formatCurrency(Number(val))}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue_per_completed_swap" name="Rev / Swap" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="margin_per_completed_swap" name="Margin / Swap" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <FleetPartnerTable data={partners} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Economics by City</h3>
              <p className="text-sm text-muted-foreground">Revenue and margin per swap across cities.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={city} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="city" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue_per_completed_swap" name="Rev / Swap" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="margin_per_completed_swap" name="Margin / Swap" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {loading ? <ChartLoading /> : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Economics by Vehicle Class</h3>
              <p className="text-sm text-muted-foreground">Revenue and margin differences by class.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicle} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="vehicle_class" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue_per_completed_swap" name="Rev / Swap" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="margin_per_completed_swap" name="Margin / Swap" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PricingFlags data={flags} loading={loading} />
        <InsightPanel observations={observations} loading={loading} />
      </div>
    </div>
  );
}
