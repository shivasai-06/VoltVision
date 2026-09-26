import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

def create_station_geographic_analytics():
    print("Starting Station & Geographic Intelligence Analytics...")
    
    base_dir = Path(__file__).parent.parent
    processed_dir = base_dir / "data" / "processed"
    output_dir = processed_dir / "analytics" / "station_geographic"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Load Data
    swap_events = pd.read_csv(processed_dir / "swap_events_cleaned.csv", low_memory=False)
    stations = pd.read_csv(processed_dir / "stations_cleaned.csv")
    hourly = pd.read_csv(processed_dir / "station_hourly_status_cleaned.csv")
    tickets = pd.read_csv(processed_dir / "support_tickets_cleaned.csv")
    
    # Pre-process dates
    swap_events['event_ts'] = pd.to_datetime(swap_events['event_ts'])
    stations['commissioned_date'] = pd.to_datetime(stations['commissioned_date'])
    stations['decommissioned_date'] = pd.to_datetime(stations['decommissioned_date'])
    
    # Identify and separate test stations
    test_station_ids = set(stations[stations['is_test_station'] == True]['station_id'])
    production_stations = stations[stations['is_test_station'] == False].copy()
    
    # Document exclusion: Test stations excluded from all geographical and station analysis to prevent skew.
    swap_events = swap_events[~swap_events['flag_potential_duplicate']].copy()
    prod_swap_events = swap_events[~swap_events['station_id'].isin(test_station_ids)].copy()
    prod_hourly = hourly[~hourly['station_id'].isin(test_station_ids)].copy()
    
    # Derived station status
    production_stations['station_status'] = np.where(production_stations['decommissioned_date'].notna(), 'Decommissioned', 'Active')
    
    def p90(x):
        return x.quantile(0.9) if not x.dropna().empty else np.nan
        
    def calculate_base_metrics(df, groupby_cols):
        agg = df.groupby(groupby_cols).agg(
            total_attempts=('event_id', 'count'),
            completed_swaps=('is_swap_completed', 'sum'),
            failed_swaps=('is_swap_failed', 'sum'),
            abandoned_swaps=('is_swap_abandoned', 'sum'),
            cancelled_swaps=('is_swap_cancelled', 'sum'),
            system_error_swaps=('is_swap_system_error', 'sum'),
            total_revenue=('amount_charged_inr', 'sum'),
            average_queue_wait=('queue_wait_sec', 'mean'),
            median_queue_wait=('queue_wait_sec', 'median'),
            p90_queue_wait=('queue_wait_sec', p90),
        ).reset_index()
        
        completed_rev = df[df['is_swap_completed']].groupby(groupby_cols)['amount_charged_inr'].sum().reset_index(name='revenue_from_completed')
        agg = agg.merge(completed_rev, on=groupby_cols, how='left')
        agg['revenue_from_completed'] = agg['revenue_from_completed'].fillna(0)
        
        agg['completion_rate'] = agg['completed_swaps'] / agg['total_attempts']
        agg['failure_rate'] = agg['failed_swaps'] / agg['total_attempts']
        agg['abandonment_rate'] = agg['abandoned_swaps'] / agg['total_attempts']
        
        agg['revenue_per_completed_swap'] = np.where(agg['completed_swaps'] > 0, agg['revenue_from_completed'] / agg['completed_swaps'], np.nan)
        agg = agg.drop(columns=['revenue_from_completed'])
        return agg

    # --- 1. Station Master Profile ---
    station_agg = calculate_base_metrics(prod_swap_events, 'station_id')
    
    # Support tickets
    prod_tickets = tickets[~tickets['station_id'].isin(test_station_ids)]
    station_tickets = prod_tickets.groupby('station_id').agg(
        support_ticket_count=('ticket_id', 'count')
    ).reset_index()
    
    station_profile = production_stations[[
        'station_id', 'city', 'location_type', 'charger_generation', 
        'commissioned_date', 'station_status', 'latitude', 'longitude'
    ]].merge(station_agg, on='station_id', how='left')
    
    station_profile = station_profile.merge(station_tickets, on='station_id', how='left')
    station_profile['support_ticket_count'] = station_profile['support_ticket_count'].fillna(0)
    
    # Fill NAs for stations with zero events
    numeric_cols = ['total_attempts', 'completed_swaps', 'failed_swaps', 'abandoned_swaps', 'cancelled_swaps', 'system_error_swaps', 'total_revenue']
    station_profile[numeric_cols] = station_profile[numeric_cols].fillna(0)
    
    station_profile['tickets_per_1000_attempts'] = np.where(
        station_profile['total_attempts'] > 0, 
        (station_profile['support_ticket_count'] / station_profile['total_attempts']) * 1000, 
        np.nan
    )
    
    station_profile.to_csv(output_dir / "station_profile.csv", index=False)
    
    # --- 2. City Comparison ---
    # Merge station features into swap events for slice analysis
    events_with_station = prod_swap_events.merge(
        production_stations[['station_id', 'city', 'location_type', 'charger_generation', 'commissioned_date']],
        on='station_id', how='inner'
    )
    
    city_df = calculate_base_metrics(events_with_station, 'city')
    # Add station count
    city_station_counts = production_stations.groupby('city')['station_id'].nunique().reset_index(name='stations')
    city_df = city_df.merge(city_station_counts, on='city', how='left')
    
    # Add ticket counts to city
    city_tickets = station_profile.groupby('city')['support_ticket_count'].sum().reset_index()
    city_df = city_df.merge(city_tickets, on='city', how='left')
    city_df['tickets_per_1000_attempts'] = np.where(
        city_df['total_attempts'] > 0, 
        (city_df['support_ticket_count'] / city_df['total_attempts']) * 1000, 
        np.nan
    )
    
    # Calculate station-to-station variation (std of completion rate) within city
    city_variation = station_profile.groupby('city').agg(
        completion_rate_std=('completion_rate', 'std')
    ).reset_index()
    city_df = city_df.merge(city_variation, on='city', how='left')
    city_df.to_csv(output_dir / "station_by_city.csv", index=False)
    
    # --- 3. Location Type Analysis ---
    loc_df = calculate_base_metrics(events_with_station, 'location_type')
    loc_counts = production_stations.groupby('location_type')['station_id'].nunique().reset_index(name='station_count')
    loc_df = loc_df.merge(loc_counts, on='location_type', how='left')
    loc_tickets = station_profile.groupby('location_type')['support_ticket_count'].sum().reset_index()
    loc_df = loc_df.merge(loc_tickets, on='location_type', how='left')
    loc_df['ticket_rate'] = np.where(loc_df['total_attempts'] > 0, (loc_df['support_ticket_count'] / loc_df['total_attempts']) * 1000, np.nan)
    loc_df.to_csv(output_dir / "station_by_location_type.csv", index=False)
    
    # --- 4. Charger Generation Analysis ---
    gen_df = calculate_base_metrics(events_with_station, 'charger_generation')
    gen_counts = production_stations.groupby('charger_generation')['station_id'].nunique().reset_index(name='station_count')
    gen_df = gen_df.merge(gen_counts, on='charger_generation', how='left')
    gen_tickets = station_profile.groupby('charger_generation')['support_ticket_count'].sum().reset_index()
    gen_df = gen_df.merge(gen_tickets, on='charger_generation', how='left')
    gen_df['support_tickets_per_1000_attempts'] = np.where(gen_df['total_attempts'] > 0, (gen_df['support_ticket_count'] / gen_df['total_attempts']) * 1000, np.nan)
    gen_df.to_csv(output_dir / "station_by_charger_generation.csv", index=False)
    
    # --- 5. Commissioning-age Analysis ---
    # Calculate age at the time of each swap
    events_with_station['station_age_days'] = (events_with_station['event_ts'] - events_with_station['commissioned_date']).dt.days
    
    # Define cohort bins based on dataset constraints
    bins = [-np.inf, 180, 365, 547, np.inf]
    labels = ['0-6 months', '6-12 months', '12-18 months', '18+ months']
    events_with_station['commissioning_age_cohort'] = pd.cut(events_with_station['station_age_days'], bins=bins, labels=labels)
    
    age_df = calculate_base_metrics(events_with_station, 'commissioning_age_cohort')
    age_df.to_csv(output_dir / "station_by_commissioning_age.csv", index=False)
    
    # --- 6. Station Telemetry ---
    # Aggregate from hourly
    tel_df = prod_hourly.groupby('station_id').agg(
        total_hours=('hour_start', 'count'),
        avg_chargers_online=('chargers_online', 'mean'),
        avg_charge_minutes=('avg_charge_minutes', 'mean'),
        avg_ambient_temp_c=('ambient_temp_c', 'mean'),
        avg_cabinet_temp_c=('cabinet_temp_c', 'mean'),
        total_outage_minutes=('outage_minutes', 'sum'),
        telemetry_missing_hours=('flag_telemetry_missing', 'sum')
    ).reset_index()
    tel_df['availability_pct'] = 1.0 - (tel_df['telemetry_missing_hours'] / tel_df['total_hours'])
    tel_df.to_csv(output_dir / "station_telemetry_summary.csv", index=False)
    
    # --- 7. Battery Turnaround ---
    # Limitation Documentation: We cannot reliably calculate battery turnaround time purely from swap_events 
    # without robust tracking of individual battery_id lifecycles via window functions, which may miss 
    # manual field swaps or maintenance events. We output the limitation instead of inventing a metric.
    turnaround_df = pd.DataFrame([{
        "limitation": "Reliable battery turnaround time cannot be accurately derived directly from battery_in_id and battery_out_id timestamps without full lifecycle tracking. Instead, refer to avg_charge_minutes in telemetry."
    }])
    turnaround_df.to_csv(output_dir / "station_battery_turnaround.csv", index=False)
    
    # --- 8. Support Complaints ---
    tickets_cat = prod_tickets.groupby(['station_id', 'category']).size().unstack(fill_value=0).reset_index()
    tickets_summary = prod_tickets.groupby('station_id').agg(total_tickets=('ticket_id', 'count')).reset_index()
    station_support = tickets_summary.merge(tickets_cat, on='station_id', how='left')
    station_support = station_profile[['station_id', 'total_attempts']].merge(station_support, on='station_id', how='left').fillna(0)
    station_support['tickets_per_1000_attempts'] = np.where(station_support['total_attempts'] > 0, (station_support['total_tickets'] / station_support['total_attempts']) * 1000, 0)
    station_support.to_csv(output_dir / "station_support_summary.csv", index=False)
    
    # --- 9. Station Performance Variation ---
    valid_stations = station_profile[station_profile['total_attempts'] >= 50] # minimum threshold for reliable rates
    metrics = ['failure_rate', 'abandonment_rate', 'p90_queue_wait', 'tickets_per_1000_attempts']
    
    dist_stats = []
    for m in metrics:
        s = valid_stations[m].dropna()
        if len(s) > 0:
            dist_stats.append({
                'metric': m,
                'mean': s.mean(),
                'median': s.median(),
                'std': s.std(),
                'p25': s.quantile(0.25),
                'p75': s.quantile(0.75),
                'p90': s.quantile(0.90),
                'p95': s.quantile(0.95)
            })
    pd.DataFrame(dist_stats).to_csv(output_dir / "station_metric_distribution.csv", index=False)
    
    # --- 10. Station Cohort Patterns ---
    cohort_df = calculate_base_metrics(events_with_station, ['charger_generation', 'city'])
    cohort_df = cohort_df[cohort_df['total_attempts'] > 1000] # threshold documented
    cohort_df.to_csv(output_dir / "station_cohort_analysis.csv", index=False)
    
    # --- 11. Geographic Anomaly Indicators ---
    flags_df = station_profile[['station_id', 'city']].copy()
    flags_df['flag_high_failure_rate'] = station_profile['failure_rate'] > station_profile['failure_rate'].quantile(0.90)
    flags_df['flag_high_abandonment_rate'] = station_profile['abandonment_rate'] > station_profile['abandonment_rate'].quantile(0.90)
    flags_df['flag_high_queue_wait'] = station_profile['p90_queue_wait'] > station_profile['p90_queue_wait'].quantile(0.90)
    flags_df['flag_high_ticket_rate'] = station_profile['tickets_per_1000_attempts'] > station_profile['tickets_per_1000_attempts'].quantile(0.90)
    flags_df.to_csv(output_dir / "station_geographic_flags.csv", index=False)
    
    # --- 12. Findings ---
    observations = []
    
    # City observation
    if len(city_df) > 1:
        highest_fail_city = city_df.loc[city_df['failure_rate'].idxmax()]
        observations.append(f"Stations in {highest_fail_city['city']} exhibited the highest observed failure rate among cities at {highest_fail_city['failure_rate']:.2%}.")
        
    # Gen observation
    if len(gen_df) > 1:
        highest_fail_gen = gen_df.loc[gen_df['failure_rate'].idxmax()]
        observations.append(f"Stations using charger generation {highest_fail_gen['charger_generation']} had a higher observed failure rate than other generations at {highest_fail_gen['failure_rate']:.2%}.")
        
    # Flag concentration
    high_fail_stations = flags_df['flag_high_failure_rate'].sum()
    observations.append(f"There are {high_fail_stations} stations flagged for having a failure rate above the network 90th percentile.")
    
    with open(output_dir / "station_geographic_observations.json", "w") as f:
        json.dump({"observations": observations}, f, indent=4)
        
    # --- 13. Validation ---
    val_report = {"status": "PASS", "checks": {}}
    
    val_report["checks"]["station_totals_reconcile"] = bool(station_profile['total_attempts'].sum() == len(prod_swap_events))
    val_report["checks"]["city_totals_reconcile"] = bool(city_df['total_attempts'].sum() == len(prod_swap_events))
    val_report["checks"]["location_type_totals_reconcile"] = bool(loc_df['total_attempts'].sum() == len(prod_swap_events))
    val_report["checks"]["charger_generation_totals_reconcile"] = bool(gen_df['total_attempts'].sum() == len(prod_swap_events))
    val_report["checks"]["test_stations_excluded"] = bool(test_station_ids.intersection(set(station_profile['station_id'])) == set())
    val_report["checks"]["no_duplicate_station_rows"] = bool(not station_profile['station_id'].duplicated().any())
    
    rates = ['completion_rate', 'failure_rate', 'abandonment_rate']
    val_report["checks"]["rates_valid"] = bool((station_profile[rates].max().max() <= 1.0) and (station_profile[rates].min().min() >= 0.0))
    val_report["checks"]["no_negative_metrics"] = bool(station_profile[['total_attempts', 'completed_swaps']].min().min() >= 0)
    
    if not all(val_report["checks"].values()):
        val_report["status"] = "FAIL"
        
    with open(output_dir / "station_geographic_validation_report.json", "w") as f:
        json.dump(val_report, f, indent=4)
        
    print("--------------------------------------------------")
    print("STATION & GEOGRAPHIC ANALYTICS COMPLETE")
    print("--------------------------------------------------")
    print(f"Files created in {output_dir}:")
    print(" - station_profile.csv")
    print(" - station_by_city.csv")
    print(" - station_by_location_type.csv")
    print(" - station_by_charger_generation.csv")
    print(" - station_by_commissioning_age.csv")
    print(" - station_telemetry_summary.csv")
    print(" - station_battery_turnaround.csv")
    print(" - station_support_summary.csv")
    print(" - station_metric_distribution.csv")
    print(" - station_cohort_analysis.csv")
    print(" - station_geographic_flags.csv")
    print(" - station_geographic_observations.json")
    print(" - station_geographic_validation_report.json")
    
    print(f"\nProduction Station Count: {len(production_stations)}")
    print(f"City Count: {len(city_df)}")
    
    if len(city_df) > 1:
        print(f"\nImportant Observed Differences:")
        print(f" - {highest_fail_city['city']} exhibited the highest city failure rate ({highest_fail_city['failure_rate']:.2%})")
        print(f" - Gen {highest_fail_gen['charger_generation']} exhibited the highest generation failure rate ({highest_fail_gen['failure_rate']:.2%})")
        
    print(f"\nValidation Status: {val_report['status']}")
    print("\nLimitations:")
    print(" - Battery turnaround time omitted due to absence of robust lifecycle linkage in cross-sectional event data.")
    print(" - Missing telemetry treated correctly as missing (not zeroes), leaving telemetry completeness to be analyzed separately.")
    print("--------------------------------------------------")

if __name__ == "__main__":
    create_station_geographic_analytics()
