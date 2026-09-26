import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface HourlyData {
  hour: number;
  failure_rate: number;
  abandonment_rate: number;
}

interface HourlyFailureChartProps {
  data: HourlyData[];
  loading?: boolean;
}

export function HourlyFailureChart({ data, loading }: HourlyFailureChartProps) {
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
        Unable to load hourly pattern data.
      </div>
    );
  }

  const chartData = data.map(d => ({
    hour: `${String(d.hour).padStart(2, '0')}:00`,
    'Failure Rate (%)': Number((d.failure_rate * 100).toFixed(2)),
    'Abandon Rate (%)': Number((d.abandonment_rate * 100).toFixed(2))
  }));

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">Hourly Service Failure Pattern</h3>
        <p className="text-sm text-muted-foreground">Failure and abandonment rates by time of day.</p>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} interval={3} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
            <Line type="monotone" dataKey="Failure Rate (%)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Abandon Rate (%)" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
