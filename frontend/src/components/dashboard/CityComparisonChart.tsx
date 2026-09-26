import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface CityData {
  city: string;
  total_attempts: number;
  completed_swaps: number;
  failure_rate: number;
  abandonment_rate: number;
  stations?: number;
}

interface CityComparisonChartProps {
  data: CityData[];
  loading?: boolean;
}

export function CityComparisonChart({ data, loading }: CityComparisonChartProps) {
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
        Unable to load city comparison data.
      </div>
    );
  }

  const chartData = data.map(d => ({
    city: d.city,
    'Failure Rate (%)': Number((d.failure_rate * 100).toFixed(2)),
    'Abandonment Rate (%)': Number((d.abandonment_rate * 100).toFixed(2))
  }));

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">Failure Rate by City</h3>
        <p className="text-sm text-muted-foreground">Comparison of aggregate failure and abandonment rates.</p>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="city" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontSize: '13px' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
            />
            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
            <Bar dataKey="Failure Rate (%)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="Abandonment Rate (%)" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
