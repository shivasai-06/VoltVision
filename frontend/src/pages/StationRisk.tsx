import { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { KpiCard } from '../components/dashboard/KpiCard';
import { StationRiskTable } from '../components/dashboard/StationRiskTable';
import { ConcentrationPanel } from '../components/dashboard/ConcentrationPanel';
import { CityComparisonChart } from '../components/dashboard/CityComparisonChart';
import { HourlyFailureChart } from '../components/dashboard/HourlyFailureChart';
import { QueueWaitChart } from '../components/dashboard/QueueWaitChart';
import { OperationalFlags } from '../components/dashboard/OperationalFlags';
import { CategoryComparison } from '../components/dashboard/CategoryComparison';
import { InsightPanel } from '../components/dashboard/InsightPanel';

export function StationRisk() {
  const [summary, setSummary] = useState<any[] | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [concentration, setConcentration] = useState<any[]>([]);
  const [cityData, setCityData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [queueWaitData, setQueueWaitData] = useState<any[]>([]);
  const [chargerData, setChargerData] = useState<any[]>([]);
  const [locationData, setLocationData] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [validation, setValidation] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchApi<any[]>('/api/service-failure/summary'),
          fetchApi<any[]>('/api/service-failure/station'),
          fetchApi<any[]>('/api/stations/flags'),
          fetchApi<any[]>('/api/service-failure/concentration'),
          fetchApi<any[]>('/api/service-failure/city'),
          fetchApi<any[]>('/api/service-failure/hourly'),
          fetchApi<any[]>('/api/service-failure/queue-wait'),
          fetchApi<any[]>('/api/stations/charger-generation'),
          fetchApi<any[]>('/api/stations/location-type'),
          fetchApi<any>('/api/service-failure/observations'),
          fetchApi<any>('/api/service-failure/validation'),
        ]);

        const [
          sumRes, stnRes, flagsRes, concRes, cityRes, hrRes, qRes, cgRes, locRes, obsRes, valRes
        ] = results;

        if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
        if (stnRes.status === 'fulfilled') setStations(stnRes.value);
        if (flagsRes.status === 'fulfilled') setFlags(flagsRes.value);
        if (concRes.status === 'fulfilled') setConcentration(concRes.value);
        if (cityRes.status === 'fulfilled') setCityData(cityRes.value);
        if (hrRes.status === 'fulfilled') setHourlyData(hrRes.value);
        if (qRes.status === 'fulfilled') setQueueWaitData(qRes.value);
        if (cgRes.status === 'fulfilled') setChargerData(cgRes.value);
        if (locRes.status === 'fulfilled') setLocationData(locRes.value);
        if (obsRes.status === 'fulfilled') setObservations(obsRes.value?.observations?.map((o: string) => ({ observation_type: 'Station Insight', period: 'All Time', description: o })) || []);
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

  const overallFailure = summary?.find(s => s.event_type === 'failed_swaps')?.percentage_of_attempts || 0;
  const overallAbandon = summary?.find(s => s.event_type === 'abandoned_swaps')?.percentage_of_attempts || 0;
  const flaggedCount = flags.filter(f => f.flag_high_failure_rate || f.flag_high_abandonment_rate || f.flag_high_queue_wait || f.flag_high_ticket_rate).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Station Risk Radar</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Identify station-level service risks, failure hotspots, and operational patterns.
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {validation?.status === 'PASS' ? (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Analytics Validation: PASS
            </div>
          ) : validation ? (
            <div className="flex items-center gap-2 text-sm font-medium text-destructive bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20">
              <AlertCircle className="w-4 h-4" />
              Analytics Validation: {validation.status}
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
          title="Overall Failure Rate" 
          value={summary ? (overallFailure * 100).toFixed(2) + '%' : ''} 
          icon={AlertCircle} 
          loading={loading}
        />
        <KpiCard 
          title="Overall Abandon Rate" 
          value={summary ? (overallAbandon * 100).toFixed(2) + '%' : ''} 
          icon={AlertCircle} 
          loading={loading}
        />
        <KpiCard 
          title="Production Stations" 
          value={stations.length > 0 ? stations.length : ''} 
          icon={CheckCircle2} 
          loading={loading}
        />
        <KpiCard 
          title="Flagged Stations" 
          value={flags.length > 0 ? flaggedCount : ''} 
          icon={AlertCircle} 
          loading={loading}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StationRiskTable stations={stations} loading={loading} />
        </div>
        <div>
          <OperationalFlags data={flags} loading={loading} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConcentrationPanel data={concentration} loading={loading} />
        <CityComparisonChart data={cityData} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HourlyFailureChart data={hourlyData} loading={loading} />
        <QueueWaitChart data={queueWaitData} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryComparison 
          title="Failure by Charger Generation" 
          data={chargerData.map(d => ({ name: d.charger_generation, ...d }))} 
          loading={loading} 
        />
        <CategoryComparison 
          title="Failure by Location Type" 
          data={locationData.map(d => ({ name: d.location_type, ...d }))} 
          loading={loading} 
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <InsightPanel observations={observations} loading={loading} />
      </div>

    </div>
  );
}
