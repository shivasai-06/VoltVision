import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCompactNumber, formatCompactCurrency, formatNumber, formatCurrency } from '../../utils/formatters';

interface TrendChartProps {
  data: any[];
  title: string;
  description?: string;
  loading?: boolean;
}

export function TrendChart({ data, title, description, loading }: TrendChartProps) {
  if (loading) {
    return (
      <div className="p-6 border border-slate-200 bg-white rounded-2xl w-full h-[400px] animate-pulse flex flex-col shadow-sm">
        <div className="w-48 h-5 bg-slate-100 rounded mb-2"></div>
        <div className="w-64 h-3 bg-slate-100 rounded mb-6"></div>
        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl w-full h-[400px] flex items-center justify-center text-slate-400 font-medium text-sm">
        No data available for this analysis.
      </div>
    );
  }

  return (
    <div className="p-6 border border-slate-200/60 bg-white rounded-2xl w-full shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-800 tracking-tight">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => formatCompactNumber(val)} dx={-10} />
            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => formatCompactCurrency(val)} dx={10} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', padding: '12px' }}
              itemStyle={{ fontWeight: 500, paddingBottom: '4px' }}
              labelStyle={{ fontWeight: 600, color: '#475569', marginBottom: '8px' }}
              formatter={(value: any, name: any) => [name === 'Total Revenue (INR)' ? formatCurrency(value) : formatNumber(value), name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b', paddingTop: '20px' }} iconType="circle" />
            <Bar yAxisId="left" dataKey="completed_swaps" name="Completed Swaps" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.8} />
            <Line yAxisId="right" type="monotone" dataKey="total_revenue" name="Total Revenue (INR)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
