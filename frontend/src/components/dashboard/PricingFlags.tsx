import { AlertTriangle } from 'lucide-react';

interface FlagData {
  partner_name_display: string;
  completed_swaps: number;
  margin_per_completed_swap: number;
  avg_discount: number;
  flag_unusually_low_margin: boolean;
  flag_unusually_high_discount: boolean;
}

interface PricingFlagsProps {
  data: FlagData[];
  loading?: boolean;
}

export function PricingFlags({ data, loading }: PricingFlagsProps) {
  if (loading) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm animate-pulse w-full">
        <div className="w-48 h-5 bg-secondary rounded mb-2"></div>
        <div className="w-64 h-3 bg-secondary rounded mb-6"></div>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary/50 rounded w-full"></div>)}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm text-center text-muted-foreground">
        Unable to load pricing flags.
      </div>
    );
  }

  const flaggedPartners = data.filter(d => 
    d.flag_unusually_low_margin || 
    d.flag_unusually_high_discount
  );

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Pricing & Partner Flags</h3>
        <p className="text-sm text-muted-foreground">Partners flagged for margin or discount outliers.</p>
      </div>
      
      {flaggedPartners.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No pricing flags currently active.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {flaggedPartners.map((partner, idx) => {
            const flags = [];
            if (partner.flag_unusually_low_margin) flags.push('Low Margin');
            if (partner.flag_unusually_high_discount) flags.push('High Discount');
            
            return (
              <div key={idx} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{partner.partner_name_display}</span>
                    <span className="text-xs text-muted-foreground">Swaps: {partner.completed_swaps.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {flags.map((f, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 bg-destructive/10 text-destructive rounded-full font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
