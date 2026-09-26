import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PartnerData {
  partner_name_display: string;
  total_attempts: number;
  completed_swaps: number;
  revenue: number;
  revenue_per_completed_swap: number;
  margin_per_completed_swap: number;
  avg_discount: number;
}

interface FleetPartnerTableProps {
  data: PartnerData[];
  loading?: boolean;
}

export function FleetPartnerTable({ data, loading }: FleetPartnerTableProps) {
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  if (loading) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full">
        <div className="w-48 h-5 bg-secondary rounded mb-4"></div>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-secondary/50 rounded w-full"></div>)}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground">
        Unable to load fleet partner data.
      </div>
    );
  }

  const formatCurrency = (num: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const currentData = data.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Fleet Partner Economics</h3>
        <p className="text-sm text-muted-foreground">Performance and margin analysis across {data.length} partners.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
            <tr>
              <th className="px-4 py-3 rounded-tl-md">Partner</th>
              <th className="px-4 py-3 text-right">Completed Swaps</th>
              <th className="px-4 py-3 text-right">Total Revenue</th>
              <th className="px-4 py-3 text-right">Rev / Swap</th>
              <th className="px-4 py-3 text-right">Margin / Swap</th>
              <th className="px-4 py-3 text-right rounded-tr-md">Avg Discount</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((partner, idx) => (
              <tr key={idx} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="px-4 py-3 font-medium text-foreground">{partner.partner_name_display}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{partner.completed_swaps.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(partner.revenue)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(partner.revenue_per_completed_swap)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-500">{formatCurrency(partner.margin_per_completed_swap)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(partner.avg_discount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, data.length)} of {data.length} partners
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
