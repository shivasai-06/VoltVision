import { AlertTriangle } from 'lucide-react';

interface FlagData {
  battery_id: string;
  supplier: string;
  manufacturing_lot: string;
  flag_unusually_low_soh: boolean;
  flag_unusually_high_cycles: boolean;
  flag_unusually_low_delivered_km: boolean;
}

interface BatteryFlagsProps {
  data: FlagData[];
  loading?: boolean;
}

export function BatteryFlags({ data, loading }: BatteryFlagsProps) {
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
        Unable to load flag data.
      </div>
    );
  }

  const flaggedBatteries = data.filter(d => 
    d.flag_unusually_low_soh || 
    d.flag_unusually_high_cycles || 
    d.flag_unusually_low_delivered_km
  );

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Operational Warning Flags</h3>
        <p className="text-sm text-muted-foreground">Batteries flagged for unusual lifecycle behaviors.</p>
      </div>
      
      {flaggedBatteries.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No batteries currently flagged.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {flaggedBatteries.slice(0, 100).map((battery) => {
            const flags = [];
            if (battery.flag_unusually_low_soh) flags.push('Low SOH');
            if (battery.flag_unusually_high_cycles) flags.push('High Cycles');
            if (battery.flag_unusually_low_delivered_km) flags.push('Low Delivered Range');
            
            return (
              <div key={battery.battery_id} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{battery.battery_id}</span>
                    <span className="text-xs text-muted-foreground">Lot: {battery.manufacturing_lot}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
