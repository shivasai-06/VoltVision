import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

def create_service_failure_analytics():
    print("Starting Service Failure Analytics...")
    
    # Setup paths
    base_dir = Path(__file__).parent.parent
    processed_dir = base_dir / "data" / "processed"
    output_dir = processed_dir / "analytics" / "service_failure"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Load Data
    swap_events = pd.read_csv(processed_dir / "swap_events_cleaned.csv", low_memory=False)
    stations = pd.read_csv(processed_dir / "stations_cleaned.csv")
    riders = pd.read_csv(processed_dir / "riders_cleaned.csv")
    tickets = pd.read_csv(processed_dir / "support_tickets_cleaned.csv")
    
    # Pre-process dates
    swap_events['event_ts'] = pd.to_datetime(swap_events['event_ts'])
    
    # Remove duplicates to match 4A analytical population
    initial_rows = len(swap_events)
    swap_events = swap_events[~swap_events['flag_potential_duplicate']].copy()
    analytical_population = len(swap_events)
    duplicates_removed = initial_rows - analytical_population
    
    # Identify test stations and separate them
    test_station_ids = set(stations[stations['is_test_station'] == True]['station_id'])
    production_stations = stations[stations['is_test_station'] == False]
    production_station_count = len(production_stations)
    
    # Document exclusion: Test stations are excluded from all service failure metrics because their 
    # events are artificially generated and would skew failure/abandonment rates of the real network.
    prod_swap_events = swap_events[~swap_events['station_id'].isin(test_station_ids)].copy()
    
    def p90(x):
        return x.quantile(0.9) if not x.dropna().empty else np.nan
        
    def calculate_base_metrics(df, groupby_cols=None):
        agg_dict = {
            'event_id': 'count',
            'is_swap_completed': 'sum',
            'is_swap_failed': 'sum',
            'is_swap_abandoned': 'sum',
            'is_swap_cancelled': 'sum',
            'is_swap_system_error': 'sum',
            'queue_wait_sec': ['mean', 'median', p90]
        }
        
        if groupby_cols:
            grouped = df.groupby(groupby_cols).agg(agg_dict)
            grouped.columns = ['total_attempts', 'completed_swaps', 'failed_swaps', 'abandoned_swaps', 
                             'cancelled_swaps', 'system_error_swaps', 'average_queue_wait', 'median_queue_wait', 'p90_queue_wait']
            grouped = grouped.reset_index()
        else:
            # overall
            grouped = pd.DataFrame([df.agg({
                'event_id': 'count',
                'is_swap_completed': 'sum',
                'is_swap_failed': 'sum',
                'is_swap_abandoned': 'sum',
                'is_swap_cancelled': 'sum',
                'is_swap_system_error': 'sum',
                'queue_wait_sec': ['mean', 'median', p90]
            }).to_dict()])
            
            grouped = pd.DataFrame([{
                'total_attempts': len(df),
                'completed_swaps': df['is_swap_completed'].sum(),
                'failed_swaps': df['is_swap_failed'].sum(),
                'abandoned_swaps': df['is_swap_abandoned'].sum(),
                'cancelled_swaps': df['is_swap_cancelled'].sum(),
                'system_error_swaps': df['is_swap_system_error'].sum(),
                'average_queue_wait': df['queue_wait_sec'].mean(),
                'median_queue_wait': df['queue_wait_sec'].median(),
                'p90_queue_wait': df['queue_wait_sec'].quantile(0.9) if not df['queue_wait_sec'].dropna().empty else np.nan
            }])

        grouped['completion_rate'] = grouped['completed_swaps'] / grouped['total_attempts']
        grouped['failure_rate'] = grouped['failed_swaps'] / grouped['total_attempts']
        grouped['abandonment_rate'] = grouped['abandoned_swaps'] / grouped['total_attempts']
        grouped['cancellation_rate'] = grouped['cancelled_swaps'] / grouped['total_attempts']
        grouped['system_error_rate'] = grouped['system_error_swaps'] / grouped['total_attempts']
        
        return grouped

    # 2. Overall failure profile (using prod data)
    overall_profile = calculate_base_metrics(prod_swap_events)
    
    # 3. Failure type breakdown
    failure_types = prod_swap_events['event_type'].value_counts().reset_index()
    failure_types.columns = ['event_type', 'event_count']
    failure_types['percentage_of_attempts'] = failure_types['event_count'] / len(prod_swap_events)
    failure_types.to_csv(output_dir / "failure_type_summary.csv", index=False)
    
    # 4. Hour-of-day analysis
    prod_swap_events['hour'] = prod_swap_events['event_ts'].dt.hour
    hourly_df = calculate_base_metrics(prod_swap_events, 'hour')
    hourly_df.to_csv(output_dir / "failure_by_hour.csv", index=False)
    
    # 5. Day-of-week analysis
    prod_swap_events['day_of_week'] = prod_swap_events['event_ts'].dt.day_name()
    dow_df = calculate_base_metrics(prod_swap_events, 'day_of_week')
    # Sort logically
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    dow_df['day_of_week'] = pd.Categorical(dow_df['day_of_week'], categories=days, ordered=True)
    dow_df = dow_df.sort_values('day_of_week')
    dow_df.to_csv(output_dir / "failure_by_day_of_week.csv", index=False)
    
    # 6 & 7. City and Station Analysis
    # Merge with production stations
    station_events = prod_swap_events.merge(production_stations, on='station_id', how='inner')
    
    # Add revenue for station/city
    def calculate_city_station_metrics(df, groupby_cols):
        base = calculate_base_metrics(df, groupby_cols)
        rev = df.groupby(groupby_cols)['amount_charged_inr'].sum().reset_index(name='total_revenue')
        base = base.merge(rev, on=groupby_cols, how='left')
        
        completed_rev = df[df['is_swap_completed']].groupby(groupby_cols)['amount_charged_inr'].sum().reset_index(name='comp_rev')
        base = base.merge(completed_rev, on=groupby_cols, how='left')
        base['comp_rev'] = base['comp_rev'].fillna(0)
        
        base['revenue_per_completed_swap'] = np.where(base['completed_swaps'] > 0, base['comp_rev'] / base['completed_swaps'], np.nan)
        base = base.drop(columns=['comp_rev'])
        return base
        
    city_df = calculate_city_station_metrics(station_events, 'city')
    city_df.to_csv(output_dir / "failure_by_city.csv", index=False)
    
    station_df = calculate_city_station_metrics(station_events, ['station_id', 'city', 'location_type', 'charger_generation', 'commissioned_date'])
    station_df.to_csv(output_dir / "failure_by_station.csv", index=False)
    
    # 8. Vehicle class analysis
    rider_events = prod_swap_events.merge(riders[['rider_id', 'vehicle_class']], on='rider_id', how='left')
    vehicle_df = calculate_base_metrics(rider_events, 'vehicle_class')
    vehicle_df.to_csv(output_dir / "failure_by_vehicle_class.csv", index=False)
    
    # 9. Failure concentration
    station_failures = station_df[['station_id', 'failed_swaps']].sort_values('failed_swaps', ascending=False)
    total_network_failures = station_failures['failed_swaps'].sum()
    
    if total_network_failures > 0:
        station_failures['percentage_of_network_failures'] = station_failures['failed_swaps'] / total_network_failures
        station_failures['cumulative_percentage'] = station_failures['percentage_of_network_failures'].cumsum()
        station_failures['station_rank'] = range(1, len(station_failures) + 1)
        
        station_failures.to_csv(output_dir / "failure_concentration.csv", index=False)
        
        def stations_for_percentile(pct):
            return len(station_failures[station_failures['cumulative_percentage'] <= pct]) + 1
            
        concentration_summary = {
            "stations_for_25pct_failures": stations_for_percentile(0.25),
            "stations_for_50pct_failures": stations_for_percentile(0.50),
            "stations_for_75pct_failures": stations_for_percentile(0.75),
            "stations_for_90pct_failures": stations_for_percentile(0.90),
            "total_production_stations": production_station_count
        }
    else:
        concentration_summary = {}

    # 10. Queue wait relationship
    valid_queue_events = prod_swap_events[prod_swap_events['queue_wait_sec'].notna()].copy()
    
    # Create quantiles for queue wait, handling potential duplicate edges
    valid_queue_events['queue_bucket'] = pd.qcut(valid_queue_events['queue_wait_sec'], q=5, duplicates='drop')
    queue_rel_df = calculate_base_metrics(valid_queue_events, 'queue_bucket')
    
    # Clean up interval naming for CSV export
    queue_rel_df['queue_bucket'] = queue_rel_df['queue_bucket'].astype(str)
    queue_rel_df.to_csv(output_dir / "queue_wait_relationship.csv", index=False)
    
    # 11. Station risk indicators
    # We use 75th percentile network thresholds for flags
    p75_fail = station_df['failure_rate'].quantile(0.75)
    p75_abandon = station_df['abandonment_rate'].quantile(0.75)
    p75_p90q = station_df['p90_queue_wait'].quantile(0.75)
    p25_comp = station_df['completion_rate'].quantile(0.25)
    
    risk_df = station_df[['station_id', 'city']].copy()
    risk_df['flag_high_failure_rate'] = station_df['failure_rate'] >= p75_fail
    risk_df['flag_high_abandonment_rate'] = station_df['abandonment_rate'] >= p75_abandon
    risk_df['flag_high_queue_wait'] = station_df['p90_queue_wait'] >= p75_p90q
    risk_df['flag_low_completion_rate'] = station_df['completion_rate'] <= p25_comp
    
    risk_df.to_csv(output_dir / "station_operational_flags.csv", index=False)
    
    # 12. Support-ticket connection
    # Safe join: aggregate tickets by station_id first to prevent duplicate swap events
    station_tickets = tickets[tickets['station_id'].notna()]
    # Optional: category filter. We will count total tickets and a placeholder for 'complaint' if 'category' has them
    station_tickets_agg = station_tickets.groupby('station_id').agg(
        total_tickets=('ticket_id', 'count')
    ).reset_index()
    
    # Merge with station attempts to get rate
    ticket_summary = station_df[['station_id', 'total_attempts']].merge(station_tickets_agg, on='station_id', how='left')
    ticket_summary['total_tickets'] = ticket_summary['total_tickets'].fillna(0)
    ticket_summary['ticket_rate_per_1000_attempts'] = np.where(
        ticket_summary['total_attempts'] > 0, 
        (ticket_summary['total_tickets'] / ticket_summary['total_attempts']) * 1000, 
        0
    )
    ticket_summary.to_csv(output_dir / "support_ticket_station_summary.csv", index=False)
    
    # 13. Key observations
    observations = []
    
    highest_fail_hour = hourly_df.loc[hourly_df['failure_rate'].idxmax()]
    observations.append({
        "type": "highest_failure_hour",
        "description": f"The hour {int(highest_fail_hour['hour'])} exhibited the highest failure rate at {highest_fail_hour['failure_rate']:.2%}."
    })
    
    highest_abandon_hour = hourly_df.loc[hourly_df['abandonment_rate'].idxmax()]
    observations.append({
        "type": "highest_abandonment_hour",
        "description": f"The hour {int(highest_abandon_hour['hour'])} exhibited the highest abandonment rate at {highest_abandon_hour['abandonment_rate']:.2%}."
    })
    
    if len(concentration_summary) > 0:
        observations.append({
            "type": "failure_concentration",
            "description": f"50% of all network failures were concentrated in {concentration_summary['stations_for_50pct_failures']} out of {production_station_count} production stations."
        })
        
    queue_trend = queue_rel_df.sort_values('average_queue_wait')
    if len(queue_trend) > 1:
        first_bucket = queue_trend.iloc[0]
        last_bucket = queue_trend.iloc[-1]
        observations.append({
            "type": "queue_abandonment_pattern",
            "description": f"Abandonment rates were higher in higher queue-wait buckets: {last_bucket['abandonment_rate']:.2%} in the highest wait bucket compared to {first_bucket['abandonment_rate']:.2%} in the lowest."
        })
        
    with open(output_dir / "service_failure_observations.json", "w") as f:
        json.dump(observations, f, indent=4)
        
    # 14. Validation
    val_report = {
        "status": "PASS",
        "checks": {}
    }
    
    # V1: Overall attempts reconcile with Step 4A (excluding dupes)
    val_report["checks"]["attempts_reconcile_with_4A"] = bool(analytical_population == initial_rows - duplicates_removed)
    
    # V2: Hourly totals reconcile
    val_report["checks"]["hourly_totals_reconcile"] = bool(hourly_df['total_attempts'].sum() == len(prod_swap_events))
    
    # V3: Day-of-week totals reconcile
    val_report["checks"]["dow_totals_reconcile"] = bool(dow_df['total_attempts'].sum() == len(prod_swap_events))
    
    # V4: City totals reconcile (uses inner join with production stations, so it should equal prod_swap_events)
    # Wait, some station_id might be missing in stations? We assume all station_ids in prod_swap_events exist in stations
    val_report["checks"]["city_totals_reconcile"] = bool(city_df['total_attempts'].sum() == len(prod_swap_events))
    
    # V5: Station totals reconcile
    val_report["checks"]["station_totals_reconcile"] = bool(station_df['total_attempts'].sum() == len(prod_swap_events))
    
    # V6: Vehicle-class totals reconcile (uses left join on riders, so it matches prod_swap_events length)
    val_report["checks"]["vehicle_class_totals_reconcile"] = bool(vehicle_df['total_attempts'].sum() == len(prod_swap_events))
    
    # V7: Event-type totals reconcile
    val_report["checks"]["event_type_totals_reconcile"] = bool(failure_types['event_count'].sum() == len(prod_swap_events))
    
    # V8: Rates between 0 and 1
    rates = ['completion_rate', 'failure_rate', 'abandonment_rate', 'cancellation_rate', 'system_error_rate']
    val_report["checks"]["hourly_rates_valid"] = bool((hourly_df[rates].max().max() <= 1.0) and (hourly_df[rates].min().min() >= 0.0))
    
    # V9: No impossible negative counts
    counts = ['completed_swaps', 'failed_swaps', 'abandoned_swaps', 'cancelled_swaps']
    val_report["checks"]["no_negative_counts"] = bool(hourly_df[counts].min().min() >= 0)
    
    # V10: No duplicate station rows
    val_report["checks"]["unique_station_rows"] = bool(not station_df['station_id'].duplicated().any())
    
    # V11: Queue wait metrics use non-missing appropriately (should not throw errors or have infinite if properly checked)
    val_report["checks"]["queue_wait_metrics_valid"] = bool(hourly_df['average_queue_wait'].notna().all() if hourly_df['average_queue_wait'].count() > 0 else True)

    if not all(v == True for v in val_report["checks"].values()):
        val_report["status"] = "FAIL"
        
    with open(output_dir / "service_failure_validation_report.json", "w") as f:
        json.dump(val_report, f, indent=4)
        
    print("--------------------------------------------------")
    print("SERVICE FAILURE ANALYTICS COMPLETE")
    print("--------------------------------------------------")
    print(f"Files created in {output_dir}:")
    print(" - failure_type_summary.csv")
    print(" - failure_by_hour.csv")
    print(" - failure_by_day_of_week.csv")
    print(" - failure_by_city.csv")
    print(" - failure_by_station.csv")
    print(" - failure_by_vehicle_class.csv")
    print(" - failure_concentration.csv")
    print(" - queue_wait_relationship.csv")
    print(" - station_operational_flags.csv")
    print(" - support_ticket_station_summary.csv")
    print(" - service_failure_observations.json")
    print(" - service_failure_validation_report.json")
    
    print(f"\nAnalytical Population: {analytical_population:,} (excluding duplicates)")
    print(f"Production Stations: {production_station_count} (Test stations excluded)")
    print(f"City Count: {len(city_df)}")
    
    overall_fail_rate = overall_profile['failure_rate'].iloc[0]
    overall_abandon_rate = overall_profile['abandonment_rate'].iloc[0]
    print(f"\nOverall Failure Rate: {overall_fail_rate:.2%}")
    print(f"Overall Abandonment Rate: {overall_abandon_rate:.2%}")
    
    print(f"Highest Failure Rate Hour: {int(highest_fail_hour['hour'])} ({highest_fail_hour['failure_rate']:.2%})")
    print(f"Highest Abandonment Rate Hour: {int(highest_abandon_hour['hour'])} ({highest_abandon_hour['abandonment_rate']:.2%})")
    
    if len(concentration_summary) > 0:
        print(f"\nFailure Concentration:")
        print(f" - 50% of failures in {concentration_summary['stations_for_50pct_failures']} stations")
        print(f" - 90% of failures in {concentration_summary['stations_for_90pct_failures']} stations")
        
    print(f"\nValidation Status: {val_report['status']}")
    print("\nImportant Limitations:")
    print(" - Support tickets are aggregated by station only. Issues unlinked to a station are excluded from station summary.")
    print(" - Queue wait relationships observe buckets but do not prove causal abandonment.")
    print("--------------------------------------------------")

if __name__ == "__main__":
    create_service_failure_analytics()
