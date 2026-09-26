import { AlertTriangle } from 'lucide-react';

interface FlagData {
  station_id: string;
  city: string;
  flag_high_failure_rate: boolean;
  flag_high_abandonment_rate: boolean;
  flag_high_queue_wait: boolean;
  flag_high_ticket_rate: boolean;
}

interface OperationalFlagsProps {
  data: FlagData[];
  loading?: boolean;
}

export function OperationalFlags({ data, loading }: OperationalFlagsProps) {
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

  const flaggedStations = data.filter(d => 
    d.flag_high_failure_rate || 
    d.flag_high_abandonment_rate || 
    d.flag_high_queue_wait || 
    d.flag_high_ticket_rate
  );

  return (
    <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Operational Warning Flags</h3>
        <p className="text-sm text-muted-foreground">Stations exceeding network 90th percentile thresholds.</p>
      </div>
      
      {flaggedStations.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No stations currently flagged.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {flaggedStations.slice(0, 50).map((station) => {
            const flags = [];
            if (station.flag_high_failure_rate) flags.push('High Failure Rate');
            if (station.flag_high_abandonment_rate) flags.push('High Abandonment');
            if (station.flag_high_queue_wait) flags.push('High Queue Wait');
            if (station.flag_high_ticket_rate) flags.push('High Ticket Rate');
            
            return (
              <div key={station.station_id} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{station.station_id}</span>
                    <span className="text-xs text-muted-foreground">{station.city}</span>
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
