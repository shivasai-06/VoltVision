import { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';
import {
  Calculator,
  AlertCircle,
  TrendingUp,
  Info,
  RefreshCw
} from 'lucide-react';

interface KpiData {
  total_attempts: number;
  completed_swaps: number;
  completion_rate: number;
  total_revenue_inr: number;
  failure_rate: number;
  abandonment_rate: number;
  contribution_margin_per_swap: number;
  data_start_date: string;
  data_end_date: string;
}

interface ValidationData {
  status: string;
  checks_passed: number;
  total_checks: number;
  timestamp: string;
}

export function DecisionSimulator() {
  const [baseline, setBaseline] = useState<KpiData | null>(null);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [sliderValue, setSliderValue] = useState<number>(0);

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
  const formatCurrency = (num: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
  const formatPercent = (num: number) => (num * 100).toFixed(2) + '%';

  useEffect(() => {
    async function loadBaseline() {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchApi<KpiData>('/api/kpis'),
          fetchApi<ValidationData>('/api/network/validation'),
        ]);

        if (results[0].status === 'fulfilled') setBaseline(results[0].value);
        else throw new Error('Failed to load KPIs');
        
        if (results[1].status === 'fulfilled') setValidation(results[1].value);
      } catch (err) {
        setError('Unable to load baseline metrics. Scenario simulation is unavailable.');
      } finally {
        setLoading(false);
      }
    }
    loadBaseline();
  }, []);

  // Modeled calculations
  const calculateScenario = () => {
    if (!baseline) return null;
    
    let modeledFailureRate = baseline.failure_rate;
    let modeledCompletedSwaps = baseline.completed_swaps;
    let modeledMarginPerSwap = baseline.contribution_margin_per_swap;
    let modeledRevenuePerSwap = baseline.total_revenue_inr / baseline.completed_swaps;
    
    let assumption = '';
    let formula = '';
    
    if (selectedScenario === 'reduce_failures') {
      // sliderValue is percentage reduction in failure rate
      modeledFailureRate = baseline.failure_rate * (1 - sliderValue / 100);
      const reducedFailures = (baseline.failure_rate - modeledFailureRate) * baseline.total_attempts;
      modeledCompletedSwaps = baseline.completed_swaps + reducedFailures;
      
      assumption = 'Assumption: The reduction in failed attempts is converted proportionally into completed swaps, while other rates and total network attempts remain unchanged.';
      formula = `modeled_completed_swaps = baseline_completed_swaps + (baseline_attempts × failure_rate_reduction)`;
    } 
    else if (selectedScenario === 'increase_swaps') {
      // sliderValue is percentage increase in completed swaps
      modeledCompletedSwaps = baseline.completed_swaps * (1 + sliderValue / 100);
      
      assumption = 'Assumption: The increase in completed swaps comes from new network volume; operational efficiency (margin per swap, revenue per swap) is assumed to hold constant at baseline levels.';
      formula = `modeled_completed_swaps = baseline_completed_swaps × (1 + target_increase%)`;
    }
    else if (selectedScenario === 'change_revenue') {
      // sliderValue is percentage change in revenue per swap
      modeledRevenuePerSwap = (baseline.total_revenue_inr / baseline.completed_swaps) * (1 + sliderValue / 100);
      
      assumption = 'Assumption: Operational volumes (attempts, completed swaps) remain completely fixed at baseline. The change solely affects the revenue captured per swap.';
      formula = `modeled_revenue_per_swap = baseline_revenue_per_swap × (1 + target_change%)`;
    }

    const modeledRevenue = modeledCompletedSwaps * modeledRevenuePerSwap;
    const modeledTotalMargin = modeledCompletedSwaps * modeledMarginPerSwap;
    const baselineTotalMargin = baseline.completed_swaps * baseline.contribution_margin_per_swap;
    const baselineRevenuePerSwap = baseline.total_revenue_inr / baseline.completed_swaps;

    return {
      failureRate: { base: baseline.failure_rate, mod: modeledFailureRate, fmt: formatPercent },
      completedSwaps: { base: baseline.completed_swaps, mod: modeledCompletedSwaps, fmt: formatNumber },
      revenuePerSwap: { base: baselineRevenuePerSwap, mod: modeledRevenuePerSwap, fmt: formatCurrency },
      revenue: { base: baseline.total_revenue_inr, mod: modeledRevenue, fmt: formatCurrency },
      marginPerSwap: { base: baseline.contribution_margin_per_swap, mod: modeledMarginPerSwap, fmt: formatCurrency },
      totalMargin: { base: baselineTotalMargin, mod: modeledTotalMargin, fmt: formatCurrency },
      assumption,
      formula
    };
  };

  const results = calculateScenario();

  return (
    <div className="space-y-6 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Decision Simulator</h1>
          <div className="text-muted-foreground mt-1 text-sm">
            Explore what-if scenarios using VoltVision's observed network metrics.
          </div>
        </div>
        {validation && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg text-sm border border-border">
            <span className="text-muted-foreground">Analytics validation:</span>
            <span className="text-emerald-500 font-medium">{validation.status === 'PASS' ? 'PASS' : validation.status}</span>
          </div>
        )}
      </div>

      <div className="p-4 border border-blue-500/20 bg-blue-500/10 rounded-xl flex items-start gap-3 text-sm text-blue-600 dark:text-blue-400">
        <Info className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <strong className="font-medium block mb-1">MODELED SCENARIO</strong>
          Scenario results are illustrative calculations based on observed baseline metrics and user-defined assumptions. 
          They are not forecasts or causal estimates.
        </div>
      </div>

      {error ? (
        <div className="p-12 border border-border bg-card rounded-xl text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Error</h3>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      ) : loading || !baseline ? (
        <div className="p-12 border border-border bg-card rounded-xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
              <h3 className="text-base font-semibold text-foreground mb-4">Choose a Scenario</h3>
              <select 
                className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-6"
                value={selectedScenario}
                onChange={(e) => {
                  setSelectedScenario(e.target.value);
                  setSliderValue(0);
                }}
              >
                <option value="">Select a scenario to model...</option>
                <option value="reduce_failures">Scenario A — Reduce Service Failures</option>
                <option value="increase_swaps">Scenario B — Increase Completed Swaps</option>
                <option value="change_revenue">Scenario C — Change Revenue per Swap</option>
              </select>

              {selectedScenario && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      {selectedScenario === 'reduce_failures' ? 'Target Failure Reduction' : 
                       selectedScenario === 'increase_swaps' ? 'Target Swap Increase' : 
                       'Revenue Change'}
                    </label>
                    <span className="text-sm font-bold text-primary">{sliderValue > 0 ? '+' : ''}{sliderValue}%</span>
                  </div>
                  
                  <input 
                    type="range" 
                    min={selectedScenario === 'change_revenue' ? -50 : 0} 
                    max={50} 
                    step={1}
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{selectedScenario === 'change_revenue' ? '-50%' : '0%'}</span>
                    <span>50%</span>
                  </div>

                  <button 
                    onClick={() => setSliderValue(0)}
                    className="w-full mt-4 py-2 px-4 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Scenario
                  </button>
                </div>
              )}
            </div>

            {results && (
              <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
                <h3 className="text-base font-semibold text-foreground mb-4">Scenario Assumptions</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Baseline Period:</span>
                    <span className="font-medium text-foreground">{baseline.data_start_date} to {baseline.data_end_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Baseline Population:</span>
                    <span className="font-medium text-foreground">{formatNumber(baseline.total_attempts)} swap attempts</span>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <span className="text-muted-foreground block mb-1">Limitations:</span>
                    <p className="text-foreground text-xs leading-relaxed">{results.assumption}</p>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <span className="text-muted-foreground block mb-1">How is this calculated?:</span>
                    <code className="text-[11px] bg-secondary/50 p-2 rounded block break-words text-foreground border border-border">
                      {results.formula}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Main Area */}
          <div className="lg:col-span-8 space-y-6">
            {!results ? (
              <div className="h-full min-h-[400px] border border-border bg-card rounded-xl flex flex-col items-center justify-center text-center p-12">
                <Calculator className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground">Select a Scenario</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">Choose an operational parameter to modify and explore the modeled impact on network metrics.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
                  <h3 className="text-base font-semibold text-foreground mb-6">Baseline vs Modeled Scenario</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground bg-secondary/30">
                        <tr>
                          <th className="px-4 py-3 rounded-l-lg font-medium">Metric</th>
                          <th className="px-4 py-3 text-right font-medium">Baseline</th>
                          <th className="px-4 py-3 text-right font-medium">Scenario</th>
                          <th className="px-4 py-3 rounded-r-lg text-right font-medium">Modeled Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Failure Rate', ...results.failureRate },
                          { label: 'Completed Swaps', ...results.completedSwaps },
                          { label: 'Revenue / Swap', ...results.revenuePerSwap },
                          { label: 'Total Revenue', ...results.revenue },
                        ].map((row, i) => {
                          const diff = row.mod - row.base;
                          const pctDiff = row.base ? (diff / row.base) * 100 : 0;
                          const isChanged = Math.abs(diff) > 0.0001;
                          
                          return (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="px-4 py-4 font-medium text-foreground">{row.label}</td>
                              <td className="px-4 py-4 text-right text-muted-foreground">{row.fmt(row.base)}</td>
                              <td className={`px-4 py-4 text-right font-medium ${isChanged ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {row.fmt(row.mod)}
                              </td>
                              <td className="px-4 py-4 text-right">
                                {isChanged ? (
                                  <div className={`inline-flex items-center gap-1 font-medium ${diff > 0 ? 'text-emerald-500' : 'text-blue-500'}`}>
                                    {diff > 0 ? '+' : ''}{row.fmt(diff)}
                                    <span className="text-xs ml-1 opacity-70">
                                      ({diff > 0 ? '+' : ''}{pctDiff.toFixed(1)}%)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-6 border border-border bg-card rounded-xl shadow-sm">
                  <h3 className="text-base font-semibold text-foreground mb-6">Calculated Operational Impact</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-secondary/20 border border-border rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <TrendingUp className="w-4 h-4" />
                        Modeled Additional Revenue
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {formatCurrency(results.revenue.mod - results.revenue.base)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Relative to the baseline period
                      </div>
                    </div>
                    
                    <div className="p-4 bg-secondary/20 border border-border rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <TrendingUp className="w-4 h-4" />
                        Modeled Total Revenue
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {formatCurrency(results.revenue.mod)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Under this illustrative assumption
                      </div>
                    </div>
                  </div>
                  
                  {/* Sensitivity curve */}
                  <div className="mt-8 pt-6 border-t border-border">
                    <h4 className="text-sm font-medium text-foreground mb-4">Sensitivity Analysis</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2 font-medium">Scenario Input</th>
                            <th className="py-2 text-right font-medium">Modeled Swaps</th>
                            <th className="py-2 text-right font-medium">Modeled Total Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[0, 5, 10, 15, 20].map(val => {
                            let s = baseline.completed_swaps;
                            let rps = baseline.total_revenue_inr / baseline.completed_swaps;
                            
                            if (selectedScenario === 'reduce_failures') {
                              const f = baseline.failure_rate * (1 - val / 100);
                              s = baseline.completed_swaps + ((baseline.failure_rate - f) * baseline.total_attempts);
                            } else if (selectedScenario === 'increase_swaps') {
                              s = baseline.completed_swaps * (1 + val / 100);
                            } else if (selectedScenario === 'change_revenue') {
                              rps = rps * (1 + val / 100);
                            }
                            
                            const totalRev = s * rps;
                            
                            return (
                              <tr key={val} className={`border-b border-border/30 last:border-0 ${val === sliderValue ? 'bg-primary/5 font-medium' : ''}`}>
                                <td className="py-2">{selectedScenario === 'change_revenue' ? '+' : ''}{val}%</td>
                                <td className="py-2 text-right">{formatNumber(s)}</td>
                                <td className="py-2 text-right">{formatCurrency(totalRev)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
