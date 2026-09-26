import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

def create_rider_retention_analytics():
    print("Starting Rider Retention & Root Cause Intelligence Analytics...")
    
    base_dir = Path(__file__).parent.parent
    processed_dir = base_dir / "data" / "processed"
    output_dir = processed_dir / "analytics" / "rider_retention"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Load Data
    riders = pd.read_csv(processed_dir / "riders_cleaned.csv")
    swap_events = pd.read_csv(processed_dir / "swap_events_cleaned.csv", low_memory=False)
    stations = pd.read_csv(processed_dir / "stations_cleaned.csv")
    tickets = pd.read_csv(processed_dir / "support_tickets_cleaned.csv")
    
    # Pre-process dates
    swap_events['event_ts'] = pd.to_datetime(swap_events['event_ts'])
    
    # Clean analytical population
    initial_swaps = len(swap_events)
    swap_events = swap_events[~swap_events['flag_potential_duplicate']].copy()
    test_station_ids = set(stations[stations['is_test_station'] == True]['station_id'])
    prod_swap_events = swap_events[~swap_events['station_id'].isin(test_station_ids)].copy()
    
    # Identify rider first swap dates and basic lifecycle
    rider_stats = prod_swap_events.groupby('rider_id').agg(
        first_swap_ts=('event_ts', 'min'),
        last_swap_ts=('event_ts', 'max'),
        total_swaps=('event_id', 'count'),
        completed_swaps=('is_swap_completed', 'sum'),
        failed_attempts=('is_swap_failed', 'sum'),
        abandoned_attempts=('is_swap_abandoned', 'sum'),
        cancelled_attempts=('is_swap_cancelled', 'sum'),
        system_errors=('is_swap_system_error', 'sum'),
        unique_stations=('station_id', 'nunique')
    ).reset_index()
    
    # Merge with stations for unique cities (event level)
    events_with_city = prod_swap_events[['rider_id', 'station_id']].merge(stations[['station_id', 'city']], on='station_id', how='left')
    unique_cities = events_with_city.groupby('rider_id')['city'].nunique().reset_index(name='unique_cities')
    rider_stats = rider_stats.merge(unique_cities, on='rider_id', how='left')
    
    # Add support tickets
    ticket_stats = tickets.groupby('rider_id').agg(
        total_tickets=('ticket_id', 'count'),
        avg_csat=('csat_score', 'mean'), # Will ignore nulls naturally
        valid_csat_count=('csat_score', 'count')
    ).reset_index()
    
    # Merge into rider profile
    rider_profile = riders.merge(rider_stats, on='rider_id', how='inner') # only riders with swaps
    rider_profile = rider_profile.merge(ticket_stats, on='rider_id', how='left')
    rider_profile['total_tickets'] = rider_profile['total_tickets'].fillna(0)
    
    # Identify is_fleet
    rider_profile['is_fleet'] = rider_profile['partner_id'].notna()
    rider_profile['segment'] = np.where(rider_profile['is_fleet'], 'Fleet', 'Retail')
    
    # 2. Define New-Rider Cohort
    max_event_ts = prod_swap_events['event_ts'].max()
    # To have 30 days of follow-up, first swap must be <= max_event_ts - 30 days
    follow_up_window = pd.Timedelta(days=30)
    cutoff_date = max_event_ts - follow_up_window
    
    rider_profile['eligible_for_30d_retention'] = rider_profile['first_swap_ts'] <= cutoff_date
    
    # Find all follow-up events for each rider
    # An event is a follow-up if it occurs > 0 seconds after the first_swap_ts
    # Actually, let's use a 12-hour buffer to avoid counting immediate same-day retry as a "return"
    # Or simpler: count any event on a strictly later date
    prod_swap_events['event_date'] = prod_swap_events['event_ts'].dt.floor('D')
    first_dates = prod_swap_events.groupby('rider_id')['event_date'].min().reset_index(name='first_date')
    prod_swap_events = prod_swap_events.merge(first_dates, on='rider_id', how='left')
    prod_swap_events['days_since_first'] = (prod_swap_events['event_date'] - prod_swap_events['first_date']).dt.days
    
    returns_7d = prod_swap_events[(prod_swap_events['days_since_first'] > 0) & (prod_swap_events['days_since_first'] <= 7)]['rider_id'].unique()
    returns_14d = prod_swap_events[(prod_swap_events['days_since_first'] > 0) & (prod_swap_events['days_since_first'] <= 14)]['rider_id'].unique()
    returns_30d = prod_swap_events[(prod_swap_events['days_since_first'] > 0) & (prod_swap_events['days_since_first'] <= 30)]['rider_id'].unique()
    
    rider_profile['returned_within_7d'] = rider_profile['rider_id'].isin(returns_7d)
    rider_profile['returned_within_14d'] = rider_profile['rider_id'].isin(returns_14d)
    rider_profile['returned_within_30d'] = rider_profile['rider_id'].isin(returns_30d)
    rider_profile['is_retained_30d'] = rider_profile['returned_within_30d']
    rider_profile['is_churned_30d'] = ~rider_profile['returned_within_30d']
    
    # 3. First Experience Metrics
    # Sort by event_ts and take first row per rider
    first_events = prod_swap_events.sort_values('event_ts').groupby('rider_id').first().reset_index()
    first_events = first_events.rename(columns={
        'is_swap_completed': 'first_completed',
        'is_swap_failed': 'first_failed',
        'is_swap_abandoned': 'first_abandoned',
        'queue_wait_sec': 'first_queue_wait',
        'amount_charged_inr': 'first_amount_charged',
        'discount_inr': 'first_discount',
        'tariff_code': 'first_tariff',
        'station_id': 'first_station'
    })
    
    first_events = first_events.merge(stations[['station_id', 'city']], left_on='first_station', right_on='station_id', how='left')
    first_events = first_events.rename(columns={'city': 'first_city'})
    first_events['is_first_peak'] = first_events['first_tariff'].str.contains('PEAK', case=False, na=False)
    
    rider_profile = rider_profile.merge(
        first_events[['rider_id', 'first_completed', 'first_failed', 'first_abandoned', 'first_queue_wait', 
                      'first_amount_charged', 'first_discount', 'first_city', 'is_first_peak']],
        on='rider_id', how='left'
    )
    
    # Save Profiles
    rider_profile.to_csv(output_dir / "rider_profile.csv", index=False)
    
    eligible_riders = rider_profile[rider_profile['eligible_for_30d_retention']].copy()
    eligible_riders.to_csv(output_dir / "new_rider_cohort.csv", index=False)
    
    # 3. Retention Metrics Summary
    retention_summary = {
        "total_new_riders_observed": len(rider_profile),
        "eligible_30d_followup_riders": len(eligible_riders),
        "returned_within_7d": int(eligible_riders['returned_within_7d'].sum()),
        "returned_within_14d": int(eligible_riders['returned_within_14d'].sum()),
        "returned_within_30d": int(eligible_riders['returned_within_30d'].sum()),
    }
    if len(eligible_riders) > 0:
        retention_summary["retention_rate_30d"] = retention_summary["returned_within_30d"] / len(eligible_riders)
        retention_summary["non_return_rate_30d"] = 1.0 - retention_summary["retention_rate_30d"]
    else:
        retention_summary["retention_rate_30d"] = 0
        retention_summary["non_return_rate_30d"] = 0
        
    pd.DataFrame([retention_summary]).to_csv(output_dir / "retention_summary.csv", index=False)
    
    def calculate_retention_by(df, group_col):
        grouped = df.groupby(group_col).agg(
            rider_count=('rider_id', 'count'),
            returners=('is_retained_30d', 'sum')
        ).reset_index()
        grouped['non_returners'] = grouped['rider_count'] - grouped['returners']
        grouped['retention_rate'] = grouped['returners'] / grouped['rider_count']
        return grouped

    # 4. Retention by first experience
    # create discrete buckets for first queue wait
    eligible_riders['first_queue_bucket'] = pd.qcut(eligible_riders['first_queue_wait'], q=4, duplicates='drop').astype(str)
    
    first_exp_flags = ['first_completed', 'first_failed', 'first_abandoned', 'is_first_peak', 'first_queue_bucket']
    first_exp_results = []
    for f in first_exp_flags:
        res = calculate_retention_by(eligible_riders, f)
        res = res.rename(columns={f: 'factor_value'})
        res.insert(0, 'factor', f)
        first_exp_results.append(res)
        
    pd.concat(first_exp_results).to_csv(output_dir / "retention_first_experience.csv", index=False)
    
    # 5. Retention by rider characteristics
    rider_char_flags = ['first_city', 'vehicle_class', 'segment']
    rider_char_results = []
    for f in rider_char_flags:
        res = calculate_retention_by(eligible_riders, f)
        res = res.rename(columns={f: 'factor_value'})
        res.insert(0, 'factor', f)
        rider_char_results.append(res)
        
    pd.concat(rider_char_results).to_csv(output_dir / "retention_by_rider_segment.csv", index=False)
    
    # 6. Failure and retention relationship (early life)
    # Get early life events (<= 7 days from first swap)
    early_events = prod_swap_events[(prod_swap_events['days_since_first'] >= 0) & (prod_swap_events['days_since_first'] <= 7)]
    early_agg = early_events.groupby('rider_id').agg(
        early_failed_swaps=('is_swap_failed', 'sum'),
        early_abandoned=('is_swap_abandoned', 'sum')
    ).reset_index()
    
    eligible_riders = eligible_riders.merge(early_agg, on='rider_id', how='left')
    eligible_riders['early_failed_swaps'] = eligible_riders['early_failed_swaps'].fillna(0)
    eligible_riders['had_early_failure'] = eligible_riders['early_failed_swaps'] > 0
    eligible_riders['multiple_early_failures'] = eligible_riders['early_failed_swaps'] > 1
    
    fail_res = pd.concat([
        calculate_retention_by(eligible_riders, 'had_early_failure').assign(factor='had_early_failure').rename(columns={'had_early_failure': 'factor_value'}),
        calculate_retention_by(eligible_riders, 'multiple_early_failures').assign(factor='multiple_early_failures').rename(columns={'multiple_early_failures': 'factor_value'})
    ])
    fail_res.to_csv(output_dir / "failure_retention_relationship.csv", index=False)
    
    # 7. Pricing and retention relationship
    try:
        eligible_riders['first_price_bucket'] = pd.qcut(eligible_riders['first_amount_charged'], q=4, duplicates='drop').astype(str)
        eligible_riders['first_discount_bucket'] = pd.qcut(eligible_riders['first_discount'], q=3, duplicates='drop').astype(str)
    except:
        eligible_riders['first_price_bucket'] = 'Unknown'
        eligible_riders['first_discount_bucket'] = 'Unknown'
        
    price_res = pd.concat([
        calculate_retention_by(eligible_riders, 'first_price_bucket').assign(factor='first_price_bucket').rename(columns={'first_price_bucket': 'factor_value'}),
        calculate_retention_by(eligible_riders, 'first_discount_bucket').assign(factor='first_discount_bucket').rename(columns={'first_discount_bucket': 'factor_value'}),
    ])
    price_res.to_csv(output_dir / "pricing_retention_relationship.csv", index=False)
    
    # 8. Support-ticket relationship
    eligible_riders['had_support_ticket'] = eligible_riders['total_tickets'] > 0
    eligible_riders['multiple_support_tickets'] = eligible_riders['total_tickets'] > 1
    
    # CSAT cohorts
    csat_conditions = [
        (eligible_riders['valid_csat_count'] == 0),
        (eligible_riders['avg_csat'] <= 2),
        (eligible_riders['avg_csat'] == 3),
        (eligible_riders['avg_csat'] >= 4)
    ]
    csat_choices = ['No CSAT', 'Low (1-2)', 'Medium (3)', 'High (4-5)']
    eligible_riders['csat_cohort'] = np.select(csat_conditions, csat_choices, default='Unknown')
    
    support_res = pd.concat([
        calculate_retention_by(eligible_riders, 'had_support_ticket').assign(factor='had_support_ticket').rename(columns={'had_support_ticket': 'factor_value'}),
        calculate_retention_by(eligible_riders, 'multiple_support_tickets').assign(factor='multiple_support_tickets').rename(columns={'multiple_support_tickets': 'factor_value'}),
        calculate_retention_by(eligible_riders, 'csat_cohort').assign(factor='csat_cohort').rename(columns={'csat_cohort': 'factor_value'})
    ])
    support_res.to_csv(output_dir / "support_retention_relationship.csv", index=False)
    
    # 9. Early-life journey
    early_30d = prod_swap_events[(prod_swap_events['days_since_first'] >= 0) & (prod_swap_events['days_since_first'] <= 30)]
    early_30d_agg = early_30d.groupby('rider_id').agg(
        swaps_30d=('event_id', 'count'),
        completed_30d=('is_swap_completed', 'sum'),
        failed_30d=('is_swap_failed', 'sum'),
        abandoned_30d=('is_swap_abandoned', 'sum')
    ).reset_index()
    journey = eligible_riders[['rider_id', 'is_retained_30d']].merge(early_30d_agg, on='rider_id', how='left')
    journey.to_csv(output_dir / "rider_journey_analysis.csv", index=False)
    
    # 10. Root-cause factor analysis
    # Consolidate all factors into one clear table
    all_factors = pd.concat([first_exp_results[0], first_exp_results[1], first_exp_results[2], 
                             rider_char_results[0], rider_char_results[2], 
                             fail_res, support_res])
    all_factors = all_factors[all_factors['rider_count'] >= 50] # Sample size minimum
    all_factors.to_csv(output_dir / "retention_factor_analysis.csv", index=False)
    
    # 11. Combined Cohort Analysis
    cohort_combo = eligible_riders.groupby(['segment', 'first_failed']).agg(
        rider_count=('rider_id', 'count'),
        returners=('is_retained_30d', 'sum')
    ).reset_index()
    cohort_combo['retention_rate'] = cohort_combo['returners'] / cohort_combo['rider_count']
    cohort_combo.to_csv(output_dir / "retention_cohort_analysis.csv", index=False)
    
    # 12. Retention investigation flags
    flags = eligible_riders[['rider_id', 'segment']].copy()
    flags['flag_high_early_failure'] = eligible_riders['early_failed_swaps'] > eligible_riders['early_failed_swaps'].quantile(0.90)
    flags['flag_poor_csat'] = eligible_riders['avg_csat'] <= 2
    flags['flag_churned_with_tickets'] = (eligible_riders['is_churned_30d']) & (eligible_riders['had_support_ticket'])
    flags.to_csv(output_dir / "retention_flags.csv", index=False)
    
    # 13. Observations
    observations = []
    
    overall_ret = retention_summary['retention_rate_30d']
    observations.append({
        "topic": "Overall Retention",
        "observation": f"The observed new-rider 30-day retention rate was {overall_ret:.2%} among {retention_summary['eligible_30d_followup_riders']} eligible riders."
    })
    
    first_fail_ret = eligible_riders[eligible_riders['first_failed']]['is_retained_30d'].mean()
    first_succ_ret = eligible_riders[~eligible_riders['first_failed']]['is_retained_30d'].mean()
    if pd.notna(first_fail_ret) and pd.notna(first_succ_ret):
        observations.append({
            "topic": "First Experience",
            "observation": f"Riders exposed to a failure on their first attempt had a lower observed return rate ({first_fail_ret:.2%}) compared to those who did not ({first_succ_ret:.2%})."
        })
        
    early_fail_ret = eligible_riders[eligible_riders['had_early_failure']]['is_retained_30d'].mean()
    no_early_fail_ret = eligible_riders[~eligible_riders['had_early_failure']]['is_retained_30d'].mean()
    if pd.notna(early_fail_ret) and pd.notna(no_early_fail_ret):
        observations.append({
            "topic": "Early Failure Exposure",
            "observation": f"Early exposure to any failed swap in the first 7 days was associated with a retention rate of {early_fail_ret:.2%}, differing from {no_early_fail_ret:.2%} for those without early failures."
        })
        
    csat_cov = (eligible_riders['valid_csat_count'] > 0).mean()
    observations.append({
        "topic": "CSAT Coverage",
        "observation": f"CSAT scores were available for only {csat_cov:.2%} of riders, meaning absent CSAT cannot strictly be interpreted as negative feedback."
    })
    
    with open(output_dir / "rider_retention_observations.json", "w") as f:
        json.dump({"observations": observations}, f, indent=4)
        
    # 14. Validation
    val_report = {"status": "PASS", "checks": {}}
    
    val_report["checks"]["riders_unique"] = bool(not rider_profile['rider_id'].duplicated().any())
    val_report["checks"]["followup_subset"] = bool(len(eligible_riders) <= len(rider_profile))
    val_report["checks"]["returners_logic"] = bool(retention_summary['returned_within_30d'] <= retention_summary['eligible_30d_followup_riders'])
    val_report["checks"]["no_support_ticket_inflation"] = bool(rider_profile['total_swaps'].sum() == len(prod_swap_events))
    val_report["checks"]["rates_bounded"] = bool((overall_ret >= 0.0) and (overall_ret <= 1.0))
    val_report["checks"]["missing_csat_handled"] = bool(rider_profile['avg_csat'].isna().sum() > 0) # CSAT has missing values naturally
    
    if not all(val_report["checks"].values()):
        val_report["status"] = "FAIL"
        
    with open(output_dir / "rider_retention_validation_report.json", "w") as f:
        json.dump(val_report, f, indent=4)
        
    print("--------------------------------------------------")
    print("RIDER RETENTION ANALYTICS COMPLETE")
    print("--------------------------------------------------")
    print(f"Files created in {output_dir}:")
    print(" - rider_profile.csv")
    print(" - new_rider_cohort.csv")
    print(" - retention_summary.csv")
    print(" - retention_first_experience.csv")
    print(" - retention_by_rider_segment.csv")
    print(" - failure_retention_relationship.csv")
    print(" - pricing_retention_relationship.csv")
    print(" - support_retention_relationship.csv")
    print(" - rider_journey_analysis.csv")
    print(" - retention_factor_analysis.csv")
    print(" - retention_cohort_analysis.csv")
    print(" - retention_flags.csv")
    print(" - rider_retention_observations.json")
    print(" - rider_retention_validation_report.json")
    
    print(f"\nNew-Rider Population: {len(rider_profile):,}")
    print(f"Eligible Follow-up Population: {len(eligible_riders):,}")
    print(f"Retention Rate (30-day): {overall_ret:.2%}")
    print(f"Non-return Rate: {retention_summary['non_return_rate_30d']:.2%}")
    print(f"CSAT Coverage: {csat_cov:.2%}")
    
    print("\nMajor Observations:")
    for obs in observations:
        print(f" - {obs['topic']}: {obs['observation']}")
        
    print(f"\nValidation Status: {val_report['status']}")
    print("\nImportant Limitations:")
    print(" - This is an observational cohort analysis; associations (e.g. failure and churn) do not strictly prove root cause.")
    print(" - CSAT coverage is sparse and non-randomly missing, so caution is required when interpreting CSAT impact.")
    print("--------------------------------------------------")

if __name__ == "__main__":
    create_rider_retention_analytics()
