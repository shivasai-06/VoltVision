interface CategoryData {
  name: string;
  total_attempts: number;
  completed_swaps: number;
  failure_rate: number;
}

interface CategoryComparisonProps {
  title: string;
  data: CategoryData[];
  loading?: boolean;
}

export function CategoryComparison({ title, data, loading }: CategoryComparisonProps) {
  if (loading) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full">
        <div className="w-48 h-5 bg-secondary rounded mb-4"></div>
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary/50 rounded w-full"></div>)}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground">
        Unable to load data.
      </div>
    );
  }

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
            <tr>
              <th className="px-4 py-2 rounded-tl-md">Category</th>
              <th className="px-4 py-2 text-right">Attempts</th>
              <th className="px-4 py-2 text-right rounded-tr-md">Failure Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium text-foreground">{item.name.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{item.total_attempts.toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-right font-semibold text-destructive">
                  {(item.failure_rate * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
