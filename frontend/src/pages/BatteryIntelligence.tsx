import { useEffect, useState } from 'react';
import { 
  Battery, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Zap
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { KpiCard } from '../components/dashboard/KpiCard';
import { InsightPanel } from '../components/dashboard/InsightPanel';
import { BatterySohChart } from '../components/dashboard/BatterySohChart';
import { SupplierComparison } from '../components/dashboard/SupplierComparison';
import { ManufacturingLotAnalysis } from '../components/dashboard/ManufacturingLotAnalysis';
import { BatteryFlags } from '../components/dashboard/BatteryFlags';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface ValidationData {
  status: string;
  checks: Record<string, boolean | object>;
}

export function BatteryIntelligence() {
  const [profile, setProfile] = useState<any[]>([]);
  const [soh, setSoh] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any[]>([]);
  const [lot, setLot] = useState<any[]>([]);
  const [swapActivity, setSwapActivity] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchApi<any[]>('/api/batteries/profile'),
          fetchApi<any[]>('/api/batteries/soh'),
          fetchApi<any[]>('/api/batteries/cycles'),
          fetchApi<any[]>('/api/batteries/supplier'),
          fetchApi<any[]>('/api/batteries/manufacturing-lot'),
          fetchApi<any[]>('/api/batteries/swap-activity'),
          fetchApi<any[]>('/api/batteries/equipment-relationship'),
          fetchApi<any[]>('/api/batteries/cohort'),
          fetchApi<any[]>('/api/batteries/flags'),
          fetchApi<any>('/api/batteries/observations'),
          fetchApi<ValidationData>('/api/batteries/validation'),
        ]);

        if (results[0].status === 'fulfilled') setProfile(results[0].value);
        if (results[1].status === 'fulfilled') setSoh(results[1].value);
        if (results[2].status === 'fulfilled') setCycles(results[2].value);
        if (results[3].status === 'fulfilled') setSupplier(results[3].value);
        if (results[4].status === 'fulfilled') setLot(results[4].value);
        if (results[5].status === 'fulfilled') setSwapActivity(results[5].value);
        if (results[6].status === 'fulfilled') setEquipment(results[6].value);
        if (results[8].status === 'fulfilled') setFlags(results[8].value);
        
        const obsRes = results[9];
        if (obsRes.status === 'fulfilled') {
          setObservations(obsRes.value?.observations?.map((o: string) => ({ 
            observation_type: 'Battery Insight', 
            period: 'All Time', 
            description: o 
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

  const totalBatteries = profile.length;
  const avgSoh = profile.length ? profile.reduce((acc, p) => acc + p.current_soh_pct, 0) / profile.length : 0;
  const avgDelivered = profile.length ? profile.reduce((acc, p) => acc + p.avg_delivered_km, 0) / profile.length : 0;
  const lowSohCount = soh.find(s => s.soh_cohort === '<70%')?.battery_count || 0;

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Battery Intelligence</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Understand battery health, lifecycle behavior, supplier patterns, and equipment performance.
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
          title="Total Batteries" 
          value={profile.length > 0 ? formatNumber(totalBatteries) : ''} 
          icon={Battery} 
          loading={loading}
        />
        <KpiCard 
          title="Average SOH" 
          value={profile.length > 0 ? avgSoh.toFixed(1) + '%' : ''} 
          icon={Activity} 
          loading={loading}
        />
        <KpiCard 
          title="Avg Delivered Range" 
          value={profile.length > 0 ? avgDelivered.toFixed(1) + ' km' : ''} 
          icon={Zap} 
          loading={loading}
        />
        <KpiCard 
          title="Batteries <70% SOH" 
          value={soh.length > 0 ? formatNumber(lowSohCount) : ''} 
          icon={AlertCircle} 
          loading={loading}
        />
      </div>

      {/* Primary Relationships */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BatterySohChart data={soh} loading={loading} />
        <SupplierComparison data={supplier} loading={loading} />
      </div>

      {/* Cycle Cohorts and Equipment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <ChartLoading /> : cycles.length > 0 ? (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Charge Cycle Intelligence</h3>
              <p className="text-sm text-muted-foreground">Average battery SOH across charge cycle cohorts.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cycles} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="cycle_cohort" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[60, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => Number(val).toFixed(1) + '%'}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="avg_soh" name="Average SOH" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground flex flex-col justify-center h-full min-h-[300px]">
            Unable to load cycle data.
          </div>
        )}

        {loading ? <ChartLoading /> : equipment.length > 0 ? (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">Battery & Equipment Relationship</h3>
              <p className="text-sm text-muted-foreground">Avg delivered range by Charger Generation.</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={equipment} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="charger_generation" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(val: any) => Number(val).toFixed(1) + ' km'}
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                  />
                  <Bar dataKey="avg_delivered_km" name="Avg Delivered km" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground flex flex-col justify-center h-full min-h-[300px]">
            Unable to load equipment relationship data.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BatteryFlags data={flags} loading={loading} />
        
        {loading ? (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full">
            <div className="w-48 h-5 bg-secondary rounded mb-4"></div>
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-secondary/50 rounded w-full"></div>)}
            </div>
          </div>
        ) : swapActivity.length > 0 ? (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Battery Swap Activity</h3>
              <p className="text-sm text-muted-foreground">Activity cohorts across the network.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-md">Utilization</th>
                    <th className="px-4 py-3 text-right">Batteries</th>
                    <th className="px-4 py-3 text-right">Avg Swaps</th>
                    <th className="px-4 py-3 text-right rounded-tr-md">Avg SOH</th>
                  </tr>
                </thead>
                <tbody>
                  {swapActivity.map((act, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium text-foreground">{act.utilization_cohort}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(act.battery_count)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{act.avg_swaps.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={act.avg_soh < 80 ? 'text-destructive' : 'text-foreground'}>
                          {act.avg_soh.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground flex flex-col justify-center h-full min-h-[300px]">
            Unable to load swap activity data.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ManufacturingLotAnalysis data={lot} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <InsightPanel observations={observations} loading={loading} />
      </div>

    </div>
  );
}
