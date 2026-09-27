import { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';
import {
  Search,
  AlertCircle,
  BarChart2,
  AlertTriangle,
  Info
} from 'lucide-react';

interface InvestigationResult {
  segmentValue: number;
  baselineValue: number;
  metricLabel: string;
  format: 'percent' | 'currency' | 'number';
}

interface ProblemConfig {
  id: string;
  label: string;
  dimensions: DimensionConfig[];
}

interface DimensionConfig {
  id: string;
  label: string;
  api: string;
  dataKey: string;
  baselineApi: string;
  mapData: (segmentData: any[], baselineData: any, segmentValue: string) => {
    results: InvestigationResult[];
    evidence: any[];
    factors: any[];
    observations: any[];
  };
}

const formatValue = (val: number, format: string) => {
  if (format === 'percent') return (val * 100).toFixed(2) + '%';
  if (format === 'currency') return '₹' + val.toFixed(2);
  return new Intl.NumberFormat('en-IN').format(val);
};

const PROBLEMS: ProblemConfig[] = [
    {
      id: 'service_failure',
      label: 'Service Failures',
      dimensions: [
        {
          id: 'city',
          label: 'City',
          api: '/api/service-failure/city',
          dataKey: 'city',
          baselineApi: '/api/service-failure/summary',
          mapData: (segmentData, baselineData, segmentValue) => {
            const segment = segmentData.find(d => d.city === segmentValue);
            if (!segment) return { results: [], evidence: [], factors: [], observations: [] };
            
            const results: InvestigationResult[] = [
              {
                metricLabel: 'Failure Rate',
                segmentValue: segment.failure_rate || 0,
                baselineValue: baselineData.failure_rate_overall || 0,
                format: 'percent'
              },
              {
                metricLabel: 'Abandonment Rate',
                segmentValue: segment.abandonment_rate || 0,
                baselineValue: baselineData.abandonment_rate_overall || 0,
                format: 'percent'
              }
            ];
            
            return {
              results,
              evidence: [
                { title: 'Attempts', value: segment.total_attempts },
                { title: 'Failed Swaps', value: segment.failed_swaps }
              ],
              factors: [
                { label: 'Observed difference in local infrastructure' }
              ],
              observations: []
            };
          }
        }
      ]
    },
    {
      id: 'pricing',
      label: 'Pricing & Economics',
      dimensions: [
        {
          id: 'vehicle_class',
          label: 'Vehicle Class',
          api: '/api/pricing/vehicle-class',
          dataKey: 'vehicle_class',
          baselineApi: '/api/pricing/monthly',
          mapData: (segmentData, baselineData, segmentValue) => {
            const segment = segmentData.find(d => d.vehicle_class === segmentValue);
            if (!segment) return { results: [], evidence: [], factors: [], observations: [] };
            
            let totalMargin = 0;
            let validEvents = 0;
            baselineData.forEach((m: any) => {
              totalMargin += m.total_margin || 0;
              validEvents += m.valid_margin_events || 0;
            });
            const baselineMargin = validEvents ? totalMargin / validEvents : 0;
            
            const results: InvestigationResult[] = [
              {
                metricLabel: 'Margin Per Swap',
                segmentValue: segment.margin_per_completed_swap || 0,
                baselineValue: baselineMargin,
                format: 'currency'
              }
            ];
            
            return {
              results,
              evidence: [
                { title: 'Completed Swaps', value: segment.completed_swaps },
                { title: 'Failure Rate', value: (segment.failure_rate * 100).toFixed(2) + '%' }
              ],
              factors: [
                { label: 'Vehicle class battery limits' }
              ],
              observations: []
            };
          }
        }
      ]
    },
    {
      id: 'retention',
      label: 'Rider Retention',
      dimensions: [
        {
          id: 'early_failure',
          label: 'Early Failure Exposure',
          api: '/api/rider-retention/failure-relationship',
          dataKey: 'factor_value',
          baselineApi: '/api/rider-retention/summary',
          mapData: (segmentData, baselineData, segmentValue) => {
            const segment = segmentData.find(d => String(d.factor_value).toLowerCase() === String(segmentValue).toLowerCase() && d.factor === 'had_early_failure');
            if (!segment) return { results: [], evidence: [], factors: [], observations: [] };
            
            const results: InvestigationResult[] = [
              {
                metricLabel: 'Retention Rate',
                segmentValue: segment.retention_rate || 0,
                baselineValue: baselineData[0]?.retention_rate_30d || 0,
                format: 'percent'
              }
            ];
            
            return {
              results,
              evidence: [
                { title: 'Rider Count', value: segment.rider_count },
                { title: 'Returners', value: segment.returners }
              ],
              factors: [
                { label: 'Observed association between failure exposure and high usage/reliance' }
              ],
              observations: []
            };
          }
        }
      ]
    }
  ];

export function RootCauseExplorer() {
  const [selectedProblem, setSelectedProblem] = useState<string>('');
  const [selectedDimension, setSelectedDimension] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [segmentOptions, setSegmentOptions] = useState<string[]>([]);
  
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingInvestigation, setLoadingInvestigation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [investigationData, setInvestigationData] = useState<{
    results: InvestigationResult[];
    evidence: any[];
    factors: any[];
    observations: any[];
  } | null>(null);

  const currentProblem = PROBLEMS.find(p => p.id === selectedProblem);
  const currentDimension = currentProblem?.dimensions.find(d => d.id === selectedDimension);

  useEffect(() => {
    async function loadOptions() {
      if (!currentDimension) return;
      try {
        setLoadingOptions(true);
        setError(null);
        setSelectedSegment('');
        setSegmentOptions([]);
        
        const data = await fetchApi<any[]>(currentDimension.api);
        const options = data
          .filter(d => d.factor === undefined || d.factor === currentDimension.api.includes('failure-relationship') ? 'had_early_failure' : undefined)
          .map(d => String(d[currentDimension.dataKey]))
          .filter((v, i, a) => a.indexOf(v) === i);
          
        setSegmentOptions(options);
      } catch (err) {
        setError('Failed to load investigation segments.');
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, [currentDimension]);

  useEffect(() => {
    async function runInvestigation() {
      if (!currentDimension || !selectedSegment) return;
      try {
        setLoadingInvestigation(true);
        setError(null);
        
        const [segmentData, baselineData] = await Promise.all([
          fetchApi<any[]>(currentDimension.api),
          fetchApi<any>(currentDimension.baselineApi)
        ]);
        
        const result = currentDimension.mapData(segmentData, baselineData, selectedSegment);
        setInvestigationData(result);
      } catch (err) {
        setError('Failed to load supporting evidence.');
      } finally {
        setLoadingInvestigation(false);
      }
    }
    runInvestigation();
  }, [selectedSegment]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Root Cause Explorer</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Investigate operational problems by comparing affected segments with network-level evidence.
          </div>
        </div>
      </div>

      <div className="p-4 border border-border bg-secondary/10 rounded-xl flex items-start gap-3 text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <strong className="text-foreground font-medium block mb-1">Exploratory Analysis</strong>
          This tool identifies observed associations and differences from network baselines. 
          Association does not establish causation. Further investigation may be warranted.
        </div>
      </div>

      {error && (
        <div className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Investigation Controls */}
      <div className="p-6 border border-border bg-card rounded-xl shadow-sm w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">What do you want to investigate?</label>
            <select 
              className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={selectedProblem}
              onChange={(e) => {
                setSelectedProblem(e.target.value);
                setSelectedDimension('');
                setSelectedSegment('');
                setInvestigationData(null);
              }}
            >
              <option value="">Select problem...</option>
              {PROBLEMS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          
          {selectedProblem && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Affected dimension</label>
              <select 
                className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={selectedDimension}
                onChange={(e) => {
                  setSelectedDimension(e.target.value);
                  setSelectedSegment('');
                  setInvestigationData(null);
                }}
              >
                <option value="">Select dimension...</option>
                {currentProblem?.dimensions.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {selectedDimension && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Select segment</label>
              <select 
                className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={selectedSegment}
                disabled={loadingOptions}
                onChange={(e) => setSelectedSegment(e.target.value)}
              >
                <option value="">{loadingOptions ? 'Loading...' : 'Select segment...'}</option>
                {segmentOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Investigation Results */}
      {!selectedProblem || !selectedDimension || !selectedSegment ? (
        <div className="p-12 border border-border bg-card rounded-xl shadow-sm text-center">
          <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Begin Investigation</h3>
          <p className="text-muted-foreground mt-2">Select a problem, dimension, and segment to begin exploratory analysis.</p>
        </div>
      ) : loadingInvestigation ? (
        <div className="p-12 border border-border bg-card rounded-xl shadow-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : investigationData && investigationData.results.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
              <h3 className="text-base font-semibold text-foreground mb-6">Segment vs Network Baseline</h3>
              <div className="space-y-6">
                {investigationData.results.map((res, idx) => {
                  const diff = res.segmentValue - res.baselineValue;
                  const isHigher = diff > 0;
                  const pctDiff = res.baselineValue ? (diff / res.baselineValue) * 100 : 0;
                  
                  return (
                    <div key={idx} className="pb-4 border-b border-border last:border-0 last:pb-0">
                      <div className="text-sm font-medium text-muted-foreground mb-3">{res.metricLabel}</div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Segment</div>
                          <div className="text-xl font-semibold text-foreground">{formatValue(res.segmentValue, res.format)}</div>
                        </div>
                        <div className="px-4 text-muted-foreground/30">vs</div>
                        <div className="space-y-1 text-right">
                          <div className="text-xs text-muted-foreground">Baseline</div>
                          <div className="text-xl font-medium text-foreground">{formatValue(res.baselineValue, res.format)}</div>
                        </div>
                      </div>
                      
                      <div className="mt-3 p-2.5 bg-secondary/30 rounded-lg flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {Math.abs(pctDiff) < 1 ? 'Similar to network baseline' : (
                            <>
                              <span className={isHigher ? 'font-medium' : 'font-medium'}>{isHigher ? 'Higher' : 'Lower'}</span> than network baseline 
                              <span className="text-muted-foreground ml-1">({pctDiff > 0 ? '+' : ''}{pctDiff.toFixed(1)}%)</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
                <h3 className="text-base font-semibold text-foreground mb-4">Supporting Evidence</h3>
                <div className="grid grid-cols-2 gap-4">
                  {investigationData.evidence.map((ev, i) => (
                    <div key={i} className="p-3 bg-secondary/20 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">{ev.title}</div>
                      <div className="text-lg font-medium text-foreground">{typeof ev.value === 'number' ? new Intl.NumberFormat('en-IN').format(ev.value) : ev.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
                <h3 className="text-base font-semibold text-foreground mb-4">Potentially Relevant Factors</h3>
                <div className="space-y-2">
                  {investigationData.factors.length > 0 ? (
                    investigationData.factors.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg text-sm">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{f.label}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground p-3 border border-border rounded-lg text-center">
                      No strong supporting signal available in the current analytics.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
            <h3 className="text-base font-semibold text-foreground mb-4">Investigation Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Selected Problem</div>
                  <div className="font-medium text-foreground">{currentProblem?.label}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Affected Segment</div>
                  <div className="font-medium text-foreground">{currentDimension?.label}: {selectedSegment}</div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Interpretation</div>
                  <div className="text-foreground">Observed association between <span className="font-medium">{selectedSegment}</span> and variations in <span className="font-medium">{investigationData.results[0]?.metricLabel}</span>.</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="text-foreground font-medium flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" />
                    Requires further investigation
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 border border-border bg-card rounded-xl shadow-sm text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Data Available</h3>
          <p className="text-muted-foreground mt-2">No supporting data is available for this combination.</p>
        </div>
      )}
    </div>
  );
}
