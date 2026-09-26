import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings("ignore")

def create_analytics():
    # 1. Setup paths
    base_dir = Path(__file__).parent.parent
    processed_dir = base_dir / "data" / "processed"
    output_dir = processed_dir / "analytics"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Load Data
    swap_events = pd.read_csv(processed_dir / "swap_events_cleaned.csv", low_memory=False)
    stations = pd.read_csv(processed_dir / "stations_cleaned.csv")
    
    # Check date coverage
    swap_events['event_ts'] = pd.to_datetime(swap_events['event_ts'])
    date_min = swap_events['event_ts'].min()
    date_max = swap_events['event_ts'].min() # Wait, max
    date_max = swap_events['event_ts'].max()
    
    # 3. Handle Data Quality Flags
    # Documented decision: We exclude 'flag_potential_duplicate' == True from our main aggregates
    # to avoid double-counting attempts and revenue.
    initial_rows = len(swap_events)
    swap_events = swap_events[~swap_events['flag_potential_duplicate']].copy()
    duplicates_removed = initial_rows - len(swap_events)
    
    # For financial mismatches:
    # "Keep completed partner_invoice transactions" -> True, we won't filter them out.
    # "Do not treat partner-invoice pricing mismatches as data errors" -> We retain them.
    # "Exclude failed/abandoned/cancelled/system-error zero-charge events from completed-swap revenue calculations."
    # -> By definition, completed-swap revenue calculations will only include is_swap_completed == True,
    # which naturally excludes failed/abandoned/etc.
    
    # 4. Contribution Margin Calculation
    # Merge stations to get grid_tariff_inr_kwh
    swap_events = swap_events.merge(stations[['station_id', 'grid_tariff_inr_kwh']], on='station_id', how='left')
    
    # CM Formula: amount_charged_inr - (energy_to_recharge_kwh * grid_tariff_inr_kwh)
    # Limitation: energy_to_recharge_kwh may be missing for failed/abandoned swaps. We will calculate it
    # transparently and it will evaluate to NaN for missing energy data.
    swap_events['variable_cost'] = swap_events['energy_to_recharge_kwh'] * swap_events['grid_tariff_inr_kwh']
    swap_events['contribution_margin'] = swap_events['amount_charged_inr'] - swap_events['variable_cost']
    
    # Add date strings for grouping
    swap_events['date'] = swap_events['event_ts'].dt.strftime('%Y-%m-%d')
    swap_events['month'] = swap_events['event_ts'].dt.strftime('%Y-%m')
    
    # Helper to calculate p90
    def p90(x):
        return x.quantile(0.9) if not x.dropna().empty else np.nan
        
    def aggregate_network(df, groupby_col):
        # Base aggregations
        agg = df.groupby(groupby_col).agg(
            total_attempts=('event_id', 'count'),
            completed_swaps=('is_swap_completed', 'sum'),
            failed_swaps=('is_swap_failed', 'sum'),
            abandoned_swaps=('is_swap_abandoned', 'sum'),
            cancelled_swaps=('is_swap_cancelled', 'sum'),
            system_error_swaps=('is_swap_system_error', 'sum'),
            total_revenue=('amount_charged_inr', 'sum'),
            total_contribution_margin=('contribution_margin', lambda x: x.sum(min_count=1)),
            average_queue_wait=('queue_wait_sec', 'mean'),
            median_queue_wait=('queue_wait_sec', 'median'),
            p90_queue_wait=('queue_wait_sec', p90),
        ).reset_index()
        
        # We need completed revenue specifically
        completed_mask = df['is_swap_completed'] == True
        completed_rev = df[completed_mask].groupby(groupby_col)['amount_charged_inr'].sum().reset_index(name='revenue_from_completed_swaps')
        agg = agg.merge(completed_rev, on=groupby_col, how='left')
        agg['revenue_from_completed_swaps'] = agg['revenue_from_completed_swaps'].fillna(0)
        
        # We need contribution margin specifically for completed swaps
        completed_cm = df[completed_mask].groupby(groupby_col)['contribution_margin'].sum(min_count=1).reset_index(name='cm_from_completed_swaps')
        agg = agg.merge(completed_cm, on=groupby_col, how='left')
        
        # Rates and Averages
        agg['completion_rate'] = agg['completed_swaps'] / agg['total_attempts']
        agg['failure_rate'] = agg['failed_swaps'] / agg['total_attempts']
        agg['abandonment_rate'] = agg['abandoned_swaps'] / agg['total_attempts']
        agg['cancellation_rate'] = agg['cancelled_swaps'] / agg['total_attempts']
        agg['system_error_rate'] = agg['system_error_swaps'] / agg['total_attempts']
        
        agg['revenue_per_completed_swap'] = np.where(agg['completed_swaps'] > 0, agg['revenue_from_completed_swaps'] / agg['completed_swaps'], np.nan)
        agg['revenue_per_attempt'] = agg['total_revenue'] / agg['total_attempts']
        
        agg['contribution_margin_per_completed_swap'] = np.where(agg['completed_swaps'] > 0, agg['cm_from_completed_swaps'] / agg['completed_swaps'], np.nan)
        agg['contribution_margin_per_attempt'] = agg['total_contribution_margin'] / agg['total_attempts']
        
        # Clean up intermediate columns
        agg = agg.drop(columns=['revenue_from_completed_swaps', 'cm_from_completed_swaps'])
        return agg

    print("Aggregating daily and monthly network performance...")
    daily_df = aggregate_network(swap_events, 'date')
    monthly_df = aggregate_network(swap_events, 'month')
    
    # Output to CSV
    daily_df.to_csv(output_dir / "network_daily.csv", index=False)
    monthly_df.to_csv(output_dir / "network_monthly.csv", index=False)
    
    # 5. Trend / Relationship Analysis (Monthly)
    corr_cols = [
        'completed_swaps', 'total_revenue', 'failure_rate', 
        'abandonment_rate', 'average_queue_wait', 'contribution_margin_per_completed_swap'
    ]
    correlations = monthly_df[corr_cols].corr(method='pearson')
    correlations.index.name = 'metric'
    correlations.to_csv(output_dir / "network_metric_correlations.csv")
    
    # 6. Trend Observations
    # Factual observations without causal claims
    observations = []
    
    # Check if completed swaps increased while failure rate increased (month over month)
    monthly_df = monthly_df.sort_values('month')
    monthly_df['prev_completed'] = monthly_df['completed_swaps'].shift(1)
    monthly_df['prev_failure_rate'] = monthly_df['failure_rate'].shift(1)
    
    mask_comp_fail = (monthly_df['completed_swaps'] > monthly_df['prev_completed']) & (monthly_df['failure_rate'] > monthly_df['prev_failure_rate'])
    for idx, row in monthly_df[mask_comp_fail].iterrows():
        observations.append({
            "observation_type": "divergence_completion_failure",
            "period": row['month'],
            "description": f"In {row['month']}, completed swaps increased from {row['prev_completed']} to {row['completed_swaps']}, while failure rate simultaneously increased from {row['prev_failure_rate']:.4f} to {row['failure_rate']:.4f}."
        })
        
    monthly_df['prev_revenue'] = monthly_df['total_revenue'].shift(1)
    monthly_df['prev_cm_per_swap'] = monthly_df['contribution_margin_per_completed_swap'].shift(1)
    mask_rev_cm = (monthly_df['total_revenue'] > monthly_df['prev_revenue']) & (monthly_df['contribution_margin_per_completed_swap'] < monthly_df['prev_cm_per_swap'])
    for idx, row in monthly_df[mask_rev_cm].iterrows():
         observations.append({
            "observation_type": "divergence_revenue_margin",
            "period": row['month'],
            "description": f"In {row['month']}, total revenue increased from {row['prev_revenue']} to {row['total_revenue']}, while contribution margin per completed swap decreased from {row['prev_cm_per_swap']:.2f} to {row['contribution_margin_per_completed_swap']:.2f}."
        })
         
    monthly_df['prev_queue'] = monthly_df['average_queue_wait'].shift(1)
    monthly_df['prev_abandon'] = monthly_df['abandonment_rate'].shift(1)
    mask_queue_abandon = (monthly_df['average_queue_wait'] > monthly_df['prev_queue']) & (monthly_df['abandonment_rate'] > monthly_df['prev_abandon'])
    for idx, row in monthly_df[mask_queue_abandon].iterrows():
         observations.append({
            "observation_type": "divergence_queue_abandonment",
            "period": row['month'],
            "description": f"In {row['month']}, average queue wait increased from {row['prev_queue']:.1f}s to {row['average_queue_wait']:.1f}s alongside an increase in abandonment rate from {row['prev_abandon']:.4f} to {row['abandonment_rate']:.4f}."
        })
         
    with open(output_dir / "network_trend_observations.json", "w") as f:
        json.dump(observations, f, indent=4)
        
    # 7. Validation
    val_report = {
        "status": "PASS",
        "checks": {}
    }
    
    # V1: Daily totals reconcile with source (excluding dupes)
    val_report["checks"]["daily_reconciles_with_source"] = bool(daily_df['total_attempts'].sum() == len(swap_events))
    
    # V2: Monthly totals reconcile with daily totals
    val_report["checks"]["monthly_reconciles_with_daily"] = bool(monthly_df['total_attempts'].sum() == daily_df['total_attempts'].sum())
    
    # V3: Sum of event types == total attempts
    daily_sum = daily_df[['completed_swaps', 'failed_swaps', 'abandoned_swaps', 'cancelled_swaps', 'system_error_swaps']].sum(axis=1)
    val_report["checks"]["event_types_sum_to_total"] = bool((daily_sum == daily_df['total_attempts']).all())
    
    # V4: Rates between 0 and 1
    rates = ['completion_rate', 'failure_rate', 'abandonment_rate', 'cancellation_rate', 'system_error_rate']
    val_report["checks"]["rates_between_0_and_1"] = bool((daily_df[rates].max().max() <= 1.0) and (daily_df[rates].min().min() >= 0.0))
    
    # V5: Impossible negative margins (Wait, margin can be negative if grid cost > revenue. Revenue shouldn't be negative unless refunds, but we tracked negative_price earlier. Let's just check revenue.)
    val_report["checks"]["revenue_not_negative"] = bool((daily_df['total_revenue'].min() >= 0.0))
    
    # V6: Date coverage
    val_report["checks"]["date_coverage"] = {
        "source_min": str(date_min),
        "source_max": str(date_max),
        "daily_min": str(daily_df['date'].min()),
        "daily_max": str(daily_df['date'].max())
    }
    
    if not all(v == True for k, v in val_report["checks"].items() if k != "date_coverage"):
        val_report["status"] = "FAIL"
        
    with open(output_dir / "analytics_validation_report.json", "w") as f:
        json.dump(val_report, f, indent=4)
        
    print("--------------------------------------------------")
    print("ANALYTICS GENERATION COMPLETE")
    print("--------------------------------------------------")
    print(f"Files created in {output_dir}:")
    print(" - network_daily.csv")
    print(" - network_monthly.csv")
    print(" - network_metric_correlations.csv")
    print(" - network_trend_observations.json")
    print(" - analytics_validation_report.json")
    print(f"\nDate Range: {date_min.date()} to {date_max.date()}")
    print(f"Total Attempts (excl duplicates): {len(swap_events):,}")
    print(f"Completed Swaps: {int(daily_df['completed_swaps'].sum()):,}")
    print(f"Completion Rate: {daily_df['completed_swaps'].sum() / len(swap_events):.2%}")
    print(f"Total Revenue: INR {daily_df['total_revenue'].sum():,.2f}")
    print("\nContribution Margin:")
    print(" - Formula: amount_charged_inr - (energy_to_recharge_kwh * grid_tariff_inr_kwh)")
    print(" - Limitation: Calculated only where energy_to_recharge_kwh is documented (usually completed swaps).")
    print(f"\nValidation Status: {val_report['status']}")
    print("--------------------------------------------------")

if __name__ == "__main__":
    create_analytics()
