import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface ConcentrationData {
  station_id: string;
  failed_swaps: number;
  percentage_of_network_failures: number;
  cumulative_percentage: number;
  station_rank: number;
}

interface ConcentrationPanelProps {
  data: ConcentrationData[];
  loading?: boolean;
}

export function ConcentrationPanel({ data, loading }: ConcentrationPanelProps) {
  if (loading) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full h-[350px]">
        <div className="w-48 h-5 bg-secondary rounded mb-2"></div>
        <div className="w-64 h-3 bg-secondary rounded mb-6"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground">
        Unable to load failure concentration data.
      </div>
    );
  }

  const topStations = data.slice(0, 20); // Show top 20 for chart clarity
  const halfFailuresIndex = data.findIndex(d => d.cumulative_percentage >= 0.5) + 1;
  const ninetyFailuresIndex = data.findIndex(d => d.cumulative_percentage >= 0.9) + 1;

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">Failure Concentration</h3>
        <p className="text-sm text-muted-foreground">Distribution of failures across production stations.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-secondary/30 rounded-lg border border-border text-center">
          <div className="text-2xl font-bold text-foreground">{halfFailuresIndex > 0 ? halfFailuresIndex : '--'}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Stations cause 50% of failures</div>
        </div>
        <div className="p-4 bg-secondary/30 rounded-lg border border-border text-center">
          <div className="text-2xl font-bold text-foreground">{ninetyFailuresIndex > 0 ? ninetyFailuresIndex : '--'}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Stations cause 90% of failures</div>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topStations} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="station_id" tick={false} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="failed_swaps" name="Failed Swaps" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-muted-foreground text-center mt-2">Top 20 failing stations shown</div>
    </div>
  );
}
