import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

def create_battery_equipment_analytics():
    print("Starting Battery & Equipment Intelligence Analytics...")
    
    base_dir = Path(__file__).parent.parent
    processed_dir = base_dir / "data" / "processed"
    output_dir = processed_dir / "analytics" / "battery_equipment"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load data
    batteries = pd.read_csv(processed_dir / "batteries_cleaned.csv")
    swap_events = pd.read_csv(processed_dir / "swap_events_cleaned.csv", low_memory=False)
    stations = pd.read_csv(processed_dir / "stations_cleaned.csv")
    
    # Pre-process dates
    swap_events['event_ts'] = pd.to_datetime(swap_events['event_ts'])
    swap_events['event_date'] = swap_events['event_ts'].dt.date
    
    # 1. Base analytical populations
    initial_swap_count = len(swap_events)
    # Remove duplicates as per 4A/4B/4C rule
    swap_events = swap_events[~swap_events['flag_potential_duplicate']].copy()
    analytical_swap_count = len(swap_events)
    
    test_station_ids = set(stations[stations['is_test_station'] == True]['station_id'])
    prod_swap_events = swap_events[~swap_events['station_id'].isin(test_station_ids)].copy()
    
    valid_batteries = batteries[~batteries['flag_invalid_soh']].copy()
    battery_population = len(valid_batteries)
    
    # --- Linkage Analysis ---
    # To map swap activity to batteries, we use battery_in_id (when battery finishes a cycle and returns to station)
    # This captures the delivered range for that cycle.
    valid_linked_swaps_in = prod_swap_events['battery_in_id'].notna() & prod_swap_events['battery_in_id'].isin(valid_batteries['battery_id'])
    
    linkage_report = {
        "total_production_swap_events": len(prod_swap_events),
        "events_with_battery_in_recorded": int(prod_swap_events['battery_in_id'].notna().sum()),
        "events_with_valid_linked_battery": int(valid_linked_swaps_in.sum()),
        "unmatched_recorded_batteries": int((prod_swap_events['battery_in_id'].notna() & ~valid_linked_swaps_in).sum())
    }
    
    if linkage_report['events_with_battery_in_recorded'] > 0:
        linkage_report['valid_linkage_percentage'] = linkage_report['events_with_valid_linked_battery'] / linkage_report['events_with_battery_in_recorded']
    else:
        linkage_report['valid_linkage_percentage'] = 0.0
        
    pd.DataFrame([linkage_report]).to_csv(output_dir / "battery_swap_linkage_validation.csv", index=False)
    
    # Only use successfully linked completed swaps for battery usage profiling
    linked_swaps = prod_swap_events[valid_linked_swaps_in].copy()
    
    # Clean swap measurements
    linked_swaps['valid_km'] = np.where(~linked_swaps['flag_suspicious_km'], linked_swaps['km_since_last_swap'], np.nan)
    linked_swaps['valid_soh_in'] = np.where(~linked_swaps['flag_invalid_soc_soh'], linked_swaps['soh_in_pct'], np.nan)
    
    # Aggregate battery activity from swap events
    battery_activity = linked_swaps.groupby('battery_in_id').agg(
        total_swaps=('event_id', 'count'),
        completed_swaps=('is_swap_completed', 'sum'),
        failed_swaps=('is_swap_failed', 'sum'),
        total_delivered_km=('valid_km', 'sum'),
        avg_delivered_km=('valid_km', 'mean'),
        active_days=('event_date', 'nunique')
    ).reset_index().rename(columns={'battery_in_id': 'battery_id'})
    
    # --- 1. Battery Master Profile ---
    battery_profile = valid_batteries.merge(battery_activity, on='battery_id', how='left')
    
    # Fill NAs for batteries with no recorded swaps
    fill_cols = ['total_swaps', 'completed_swaps', 'failed_swaps', 'total_delivered_km', 'active_days']
    battery_profile[fill_cols] = battery_profile[fill_cols].fillna(0)
    
    battery_profile['swaps_per_active_day'] = np.where(
        battery_profile['active_days'] > 0,
        battery_profile['total_swaps'] / battery_profile['active_days'],
        np.nan
    )
    
    # Derive battery status (if retired_date is populated -> Retired, else Active)
    battery_profile['battery_status'] = np.where(battery_profile['retired_date'].notna(), 'Retired', 'Active')
    
    battery_profile.to_csv(output_dir / "battery_profile.csv", index=False)
    
    # --- 2. Battery Health Analysis (SOH Cohorts) ---
    # Create cohorts based on current_soh_pct
    soh_bins = [0, 70, 80, 90, 100]
    soh_labels = ['<70%', '70-80%', '80-90%', '90-100%']
    battery_profile['soh_cohort'] = pd.cut(battery_profile['current_soh_pct'], bins=soh_bins, labels=soh_labels)
    
    soh_analysis = battery_profile.groupby('soh_cohort').agg(
        battery_count=('battery_id', 'count'),
        total_swaps=('total_swaps', 'sum'),
        avg_delivered_km=('avg_delivered_km', 'mean'),
        total_failed_swaps=('failed_swaps', 'sum')
    ).reset_index()
    
    soh_analysis['failure_rate'] = np.where(soh_analysis['total_swaps'] > 0, soh_analysis['total_failed_swaps'] / soh_analysis['total_swaps'], 0)
    soh_analysis.to_csv(output_dir / "battery_soh_analysis.csv", index=False)
    
    # --- 3. Charge-cycle Analysis ---
    # We use 'total_swaps' as a proxy for charge cycles in the network.
    cycle_bins = [-1, 10, 100, 500, 1000, np.inf]
    cycle_labels = ['0-10', '11-100', '101-500', '501-1000', '1000+']
    battery_profile['cycle_cohort'] = pd.cut(battery_profile['total_swaps'], bins=cycle_bins, labels=cycle_labels)
    
    cycle_analysis = battery_profile.groupby('cycle_cohort').agg(
        battery_count=('battery_id', 'count'),
        total_swaps=('total_swaps', 'sum'),
        avg_soh=('current_soh_pct', 'mean'),
        avg_delivered_km=('avg_delivered_km', 'mean')
    ).reset_index()
    cycle_analysis.to_csv(output_dir / "battery_cycle_analysis.csv", index=False)
    
    # --- 4. Supplier Analysis ---
    supplier_analysis = battery_profile.groupby('supplier').agg(
        battery_count=('battery_id', 'count'),
        total_swaps=('total_swaps', 'sum'),
        avg_soh=('current_soh_pct', 'mean'),
        avg_delivered_km=('avg_delivered_km', 'mean'),
        total_failed_swaps=('failed_swaps', 'sum')
    ).reset_index()
    supplier_analysis['failure_rate'] = np.where(supplier_analysis['total_swaps'] > 0, supplier_analysis['total_failed_swaps'] / supplier_analysis['total_swaps'], 0)
    supplier_analysis.to_csv(output_dir / "battery_by_supplier.csv", index=False)
    
    # --- 5. Manufacturing Lot Analysis ---
    lot_analysis = battery_profile.groupby('manufacturing_lot').agg(
        lot_size=('battery_id', 'count'),
        avg_soh=('current_soh_pct', 'mean'),
        median_soh=('current_soh_pct', 'median'),
        avg_delivered_km=('avg_delivered_km', 'mean'),
        total_swaps=('total_swaps', 'sum')
    ).reset_index()
    lot_analysis.to_csv(output_dir / "battery_by_manufacturing_lot.csv", index=False)
    
    # --- 6. Battery Swap Activity ---
    # High/Medium/Low utilization based on quantiles of total_swaps
    try:
        battery_profile['utilization_cohort'] = pd.qcut(battery_profile['total_swaps'], q=3, labels=['Low', 'Medium', 'High'], duplicates='drop')
    except ValueError:
        battery_profile['utilization_cohort'] = 'Unknown'
        
    activity_analysis = battery_profile.groupby('utilization_cohort').agg(
        battery_count=('battery_id', 'count'),
        avg_swaps=('total_swaps', 'mean'),
        avg_active_days=('active_days', 'mean'),
        avg_soh=('current_soh_pct', 'mean')
    ).reset_index()
    activity_analysis.to_csv(output_dir / "battery_swap_activity.csv", index=False)
    
    # --- 8. Equipment / Charger Analysis ---
    # Merge swap events with station details to see if hardware impacts battery incoming metrics
    equipment_events = linked_swaps.merge(stations[['station_id', 'city', 'location_type', 'charger_generation']], on='station_id', how='left')
    
    equipment_analysis = equipment_events.groupby('charger_generation').agg(
        total_swaps=('event_id', 'count'),
        avg_soh_in=('valid_soh_in', 'mean'),
        avg_delivered_km=('valid_km', 'mean')
    ).reset_index()
    equipment_analysis.to_csv(output_dir / "equipment_battery_relationship.csv", index=False)
    
    # --- 9. Battery Cohort Analysis ---
    cohort_analysis = battery_profile.groupby(['supplier', 'cycle_cohort']).agg(
        battery_count=('battery_id', 'count'),
        avg_soh=('current_soh_pct', 'mean')
    ).reset_index()
    # Filter small cohorts
    cohort_analysis = cohort_analysis[cohort_analysis['battery_count'] >= 50]
    cohort_analysis.to_csv(output_dir / "battery_cohort_analysis.csv", index=False)
    
    # --- 10. Battery Intelligence Flags ---
    # Transparent anomaly indicators for investigation
    flags_df = battery_profile[['battery_id', 'supplier', 'manufacturing_lot']].copy()
    
    p10_soh = battery_profile['current_soh_pct'].quantile(0.10)
    p90_cycles = battery_profile['total_swaps'].quantile(0.90)
    p10_km = battery_profile['avg_delivered_km'].dropna().quantile(0.10)
    
    flags_df['flag_unusually_low_soh'] = battery_profile['current_soh_pct'] <= p10_soh
    flags_df['flag_unusually_high_cycles'] = battery_profile['total_swaps'] >= p90_cycles
    flags_df['flag_unusually_low_delivered_km'] = battery_profile['avg_delivered_km'] <= p10_km
    flags_df.to_csv(output_dir / "battery_equipment_flags.csv", index=False)
    
    # --- 11. Observations ---
    observations = []
    
    if len(soh_analysis) > 1:
        valid_sohs = soh_analysis[soh_analysis['avg_delivered_km'].notna()].sort_values('avg_delivered_km')
        if len(valid_sohs) > 0:
            lowest = valid_sohs.iloc[0]
            highest = valid_sohs.iloc[-1]
            observations.append(f"Observed delivered range varied by SOH cohort: The {lowest['soh_cohort']} cohort averaged {lowest['avg_delivered_km']:.1f} km, while the {highest['soh_cohort']} cohort averaged {highest['avg_delivered_km']:.1f} km.")
            
    if len(supplier_analysis) > 1:
        highest_fail = supplier_analysis.sort_values('failure_rate', ascending=False).iloc[0]
        observations.append(f"Batteries from supplier {highest_fail['supplier']} exhibited an observed failure rate of {highest_fail['failure_rate']:.2%} across {highest_fail['battery_count']} batteries, meriting routine operational review.")
    
    low_soh_count = flags_df['flag_unusually_low_soh'].sum()
    observations.append(f"Identified {low_soh_count} batteries mathematically flagged for unusually low SOH (bottom 10th percentile), tagged for investigation.")

    with open(output_dir / "battery_equipment_observations.json", "w") as f:
        json.dump({"observations": observations}, f, indent=4)
        
    # --- 12. Validation ---
    val_report = {"status": "PASS", "checks": {}}
    
    val_report["checks"]["no_potential_duplicates_used"] = bool(analytical_swap_count < initial_swap_count)
    val_report["checks"]["linkage_did_not_inflate_events"] = bool(len(linked_swaps) <= len(prod_swap_events))
    val_report["checks"]["profile_count_matches_valid_batteries"] = bool(len(battery_profile) == battery_population)
    
    # Check that total swaps in profile sum closely to linked swaps (could be exact if no missing battery_in_id)
    val_report["checks"]["profile_swaps_reconcile"] = bool(battery_profile['total_swaps'].sum() == len(linked_swaps))
    
    val_report["checks"]["rates_valid"] = bool((supplier_analysis['failure_rate'].max() <= 1.0) and (supplier_analysis['failure_rate'].min() >= 0.0))
    val_report["checks"]["no_negative_metrics"] = bool(battery_profile['total_swaps'].min() >= 0)
    
    if not all(val_report["checks"].values()):
        val_report["status"] = "FAIL"
        
    with open(output_dir / "battery_equipment_validation_report.json", "w") as f:
        json.dump(val_report, f, indent=4)
        
    # Final Reporting
    print("--------------------------------------------------")
    print("BATTERY & EQUIPMENT ANALYTICS COMPLETE")
    print("--------------------------------------------------")
    print(f"Files created in {output_dir}:")
    print(" - battery_profile.csv")
    print(" - battery_soh_analysis.csv")
    print(" - battery_cycle_analysis.csv")
    print(" - battery_by_supplier.csv")
    print(" - battery_by_manufacturing_lot.csv")
    print(" - battery_swap_activity.csv")
    print(" - equipment_battery_relationship.csv")
    print(" - battery_cohort_analysis.csv")
    print(" - battery_equipment_flags.csv")
    print(" - battery_swap_linkage_validation.csv")
    print(" - battery_equipment_observations.json")
    print(" - battery_equipment_validation_report.json")
    
    print(f"\nBattery Population: {battery_population:,}")
    print(f"Swap-Event Population: {len(prod_swap_events):,} (excluding dupes & test stations)")
    print(f"Linkage Coverage: {linkage_report['valid_linkage_percentage']:.2%} of recorded incoming batteries successfully linked")
    
    print("\nMajor Observations:")
    for obs in observations:
        print(f" - {obs}")
        
    print(f"\nValidation Status: {val_report['status']}")
    print("\nImportant Limitations:")
    print(" - Analysis is purely observational and does not prove causal equipment defects.")
    print(" - Battery usage metrics depend heavily on valid `battery_in_id` linkage in the swap events.")
    print("--------------------------------------------------")

if __name__ == "__main__":
    create_battery_equipment_analytics()
