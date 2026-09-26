import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

def create_pricing_partner_analytics():
    print("Starting Pricing & Partner Economics Analytics...")
    
    base_dir = Path(__file__).parent.parent
    processed_dir = base_dir / "data" / "processed"
    output_dir = processed_dir / "analytics" / "pricing_partner"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Load Data
    swap_events = pd.read_csv(processed_dir / "swap_events_cleaned.csv", low_memory=False)
    stations = pd.read_csv(processed_dir / "stations_cleaned.csv")
    riders = pd.read_csv(processed_dir / "riders_cleaned.csv")
    fleet_partners = pd.read_csv(processed_dir / "fleet_partners_cleaned.csv")
    
    # Pre-process dates
    swap_events['event_ts'] = pd.to_datetime(swap_events['event_ts'])
    swap_events['event_month_str'] = swap_events['event_ts'].dt.to_period('M').astype(str)
    
    # Filter analytical population
    initial_swaps = len(swap_events)
    # Exclude duplicates
    swap_events = swap_events[~swap_events['flag_potential_duplicate']].copy()
    analytical_population = len(swap_events)
    
    # Identify test stations and separate them
    test_station_ids = set(stations[stations['is_test_station'] == True]['station_id'])
    prod_swap_events = swap_events[~swap_events['station_id'].isin(test_station_ids)].copy()
    
    # Join necessary fields
    prod_swap_events = prod_swap_events.merge(
        stations[['station_id', 'city', 'grid_tariff_inr_kwh']],
        on='station_id', how='inner'
    )
    
    prod_swap_events = prod_swap_events.merge(
        riders[['rider_id', 'partner_id', 'vehicle_class']],
        on='rider_id', how='left'
    )
    
    prod_swap_events = prod_swap_events.merge(
        fleet_partners[['partner_id', 'partner_name', 'partner_segment']],
        on='partner_id', how='left'
    )
    
    # Derived variables
    prod_swap_events['is_peak'] = prod_swap_events['tariff_code'].str.contains('PEAK', case=False, na=False)
    prod_swap_events['is_fleet'] = prod_swap_events['partner_id'].notna() | (prod_swap_events['payment_mode'] == 'partner_invoice')
    prod_swap_events['partner_segment'] = prod_swap_events['partner_segment'].fillna('Retail')
    
    # Contribution Margin Calculation
    # Formula: amount_charged_inr - (energy_to_recharge_kwh * grid_tariff_inr_kwh)
    prod_swap_events['variable_cost'] = prod_swap_events['energy_to_recharge_kwh'] * prod_swap_events['grid_tariff_inr_kwh']
    prod_swap_events['contribution_margin_inr'] = prod_swap_events['amount_charged_inr'] - prod_swap_events['variable_cost']
    
    # Track completed population
    completed_events = prod_swap_events[prod_swap_events['is_swap_completed']].copy()
    completed_swap_count = len(completed_events)
    total_revenue = completed_events['amount_charged_inr'].sum()
    
    # Function to calculate consistent aggregated metrics
    def aggregate_pricing(df, groupby_cols):
        agg = df.groupby(groupby_cols).agg(
            total_attempts=('event_id', 'count'),
            completed_swaps=('is_swap_completed', 'sum'),
            failed_swaps=('is_swap_failed', 'sum'),
            abandoned_swaps=('is_swap_abandoned', 'sum'),
            avg_list_price=('list_price_inr', 'mean'),
            median_list_price=('list_price_inr', 'median'),
            avg_discount=('discount_inr', 'mean'),
            avg_amount_charged=('amount_charged_inr', 'mean')
        ).reset_index()
        
        comp_df = df[df['is_swap_completed']]
        rev_agg = comp_df.groupby(groupby_cols).agg(
            revenue=('amount_charged_inr', 'sum'),
            total_margin=('contribution_margin_inr', 'sum'),
            valid_margin_events=('contribution_margin_inr', 'count')
        ).reset_index()
        
        agg = agg.merge(rev_agg, on=groupby_cols, how='left')
        agg['revenue'] = agg['revenue'].fillna(0)
        agg['total_margin'] = agg['total_margin'].fillna(0)
        agg['valid_margin_events'] = agg['valid_margin_events'].fillna(0)
        
        agg['revenue_per_completed_swap'] = np.where(agg['completed_swaps'] > 0, agg['revenue'] / agg['completed_swaps'], np.nan)
        agg['margin_per_completed_swap'] = np.where(agg['valid_margin_events'] > 0, agg['total_margin'] / agg['valid_margin_events'], np.nan)
        
        return agg

    # --- 1. Pricing Profile ---
    # Aggregate to save space and create analytical multi-dimensional view
    profile_cols = ['event_month_str', 'city', 'vehicle_class', 'partner_segment', 'is_peak', 'payment_mode', 'is_swap_completed']
    pricing_profile = prod_swap_events.groupby(profile_cols).agg(
        event_count=('event_id', 'count'),
        avg_list_price=('list_price_inr', 'mean'),
        avg_discount=('discount_inr', 'mean'),
        avg_amount_charged=('amount_charged_inr', 'mean'),
        total_revenue=('amount_charged_inr', lambda x: x[prod_swap_events.loc[x.index, 'is_swap_completed']].sum()),
        total_margin=('contribution_margin_inr', lambda x: x[prod_swap_events.loc[x.index, 'is_swap_completed']].sum())
    ).reset_index()
    pricing_profile.to_csv(output_dir / "pricing_profile.csv", index=False)
    
    # --- 2. Pricing Trends Over Time ---
    monthly_pricing = aggregate_pricing(prod_swap_events, 'event_month_str')
    monthly_pricing.to_csv(output_dir / "pricing_monthly.csv", index=False)
    
    # --- 3. Peak vs Off-Peak Analysis ---
    peak_analysis = aggregate_pricing(prod_swap_events, 'is_peak')
    peak_analysis['swap_volume_share'] = peak_analysis['completed_swaps'] / completed_swap_count
    peak_analysis.to_csv(output_dir / "pricing_peak_offpeak.csv", index=False)
    
    # --- 4. Fleet vs Retail Economics ---
    fleet_retail = aggregate_pricing(prod_swap_events, 'is_fleet')
    fleet_retail['failure_rate'] = fleet_retail['failed_swaps'] / fleet_retail['total_attempts']
    fleet_retail['abandonment_rate'] = fleet_retail['abandoned_swaps'] / fleet_retail['total_attempts']
    fleet_retail.to_csv(output_dir / "fleet_vs_retail_economics.csv", index=False)
    
    # --- 5. Fleet Partner Analysis ---
    fleet_events = prod_swap_events[prod_swap_events['is_fleet']].copy()
    # Attempt to group by partner name (handling missing/unjoined partners safely)
    fleet_events['partner_name_display'] = fleet_events['partner_name'].fillna('Unregistered_Fleet')
    partner_analysis = aggregate_pricing(fleet_events, 'partner_name_display')
    partner_analysis.to_csv(output_dir / "fleet_partner_economics.csv", index=False)
    
    # --- 6. City Pricing Economics ---
    city_pricing = aggregate_pricing(prod_swap_events, 'city')
    city_pricing.to_csv(output_dir / "pricing_by_city.csv", index=False)
    
    # --- 7. Vehicle-class Economics ---
    vc_pricing = aggregate_pricing(prod_swap_events, 'vehicle_class')
    vc_pricing['failure_rate'] = vc_pricing['failed_swaps'] / vc_pricing['total_attempts']
    vc_pricing.to_csv(output_dir / "pricing_by_vehicle_class.csv", index=False)
    
    # --- 8. Pricing Period Analysis ---
    period_pricing = aggregate_pricing(prod_swap_events, ['event_month_str', 'is_peak'])
    period_pricing.to_csv(output_dir / "pricing_period_analysis.csv", index=False)
    
    # --- 9. Revenue vs Margin Analysis ---
    rev_margin = aggregate_pricing(prod_swap_events, 'event_month_str')
    rev_margin = rev_margin[['event_month_str', 'completed_swaps', 'revenue', 'revenue_per_completed_swap', 'total_margin', 'margin_per_completed_swap']].sort_values('event_month_str')
    
    rev_margin['revenue_mom_change'] = rev_margin['revenue'].pct_change()
    rev_margin['margin_mom_change'] = rev_margin['total_margin'].pct_change()
    rev_margin.to_csv(output_dir / "revenue_margin_relationship.csv", index=False)
    
    # --- 10. Pricing / Partner Flags ---
    flags = partner_analysis[['partner_name_display', 'completed_swaps', 'margin_per_completed_swap', 'avg_discount']].copy()
    
    if len(partner_analysis) > 0:
        p25_margin = flags['margin_per_completed_swap'].quantile(0.25)
        p75_discount = flags['avg_discount'].quantile(0.75)
        
        flags['flag_unusually_low_margin'] = flags['margin_per_completed_swap'] <= p25_margin
        flags['flag_unusually_high_discount'] = flags['avg_discount'] >= p75_discount
    flags.to_csv(output_dir / "pricing_partner_flags.csv", index=False)
    
    # --- 11. Observations ---
    observations = []
    
    # Peak off-peak
    if len(peak_analysis) > 1:
        peak_row = peak_analysis[peak_analysis['is_peak'] == True].iloc[0] if not peak_analysis[peak_analysis['is_peak'] == True].empty else None
        offpeak_row = peak_analysis[peak_analysis['is_peak'] == False].iloc[0] if not peak_analysis[peak_analysis['is_peak'] == False].empty else None
        
        if peak_row is not None and offpeak_row is not None:
            observations.append({
                "topic": "Peak vs Off-Peak Pricing",
                "observation": f"Peak periods were associated with an average revenue per swap of INR {peak_row['revenue_per_completed_swap']:.2f}, compared to INR {offpeak_row['revenue_per_completed_swap']:.2f} during off-peak periods."
            })
            
    # Fleet vs Retail
    if len(fleet_retail) > 1:
        fleet_row = fleet_retail[fleet_retail['is_fleet'] == True].iloc[0] if not fleet_retail[fleet_retail['is_fleet'] == True].empty else None
        retail_row = fleet_retail[fleet_retail['is_fleet'] == False].iloc[0] if not fleet_retail[fleet_retail['is_fleet'] == False].empty else None
        
        if fleet_row is not None and retail_row is not None:
            observations.append({
                "topic": "Fleet vs Retail Margins",
                "observation": f"Fleet transactions observed an average contribution margin per swap of INR {fleet_row['margin_per_completed_swap']:.2f}, while retail transactions averaged INR {retail_row['margin_per_completed_swap']:.2f}."
            })
            
    # Revenue vs Margin Growth Disconnect
    if len(rev_margin) > 2:
        first_m = rev_margin.iloc[0]
        last_m = rev_margin.iloc[-1]
        
        observations.append({
            "topic": "Revenue vs Margin Trends",
            "observation": f"Over the analyzed period, monthly revenue shifted from INR {first_m['revenue']:,.0f} to INR {last_m['revenue']:,.0f}. Concurrently, contribution margin per swap shifted from INR {first_m['margin_per_completed_swap']:.2f} to INR {last_m['margin_per_completed_swap']:.2f}."
        })
        
    with open(output_dir / "pricing_partner_observations.json", "w") as f:
        json.dump({"observations": observations}, f, indent=4)
        
    # --- 12. Validation ---
    val_report = {"status": "PASS", "checks": {}}
    
    val_report["checks"]["attempts_reconcile"] = bool(monthly_pricing['total_attempts'].sum() == len(prod_swap_events))
    val_report["checks"]["completed_swaps_reconcile"] = bool(monthly_pricing['completed_swaps'].sum() == completed_swap_count)
    val_report["checks"]["revenue_totals_reconcile"] = bool(abs(monthly_pricing['revenue'].sum() - total_revenue) < 1.0)
    
    val_report["checks"]["city_totals_reconcile"] = bool(city_pricing['total_attempts'].sum() == len(prod_swap_events))
    val_report["checks"]["fleet_retail_totals_reconcile"] = bool(fleet_retail['total_attempts'].sum() == len(prod_swap_events))
    
    # Check bounds
    val_report["checks"]["rates_bounded"] = bool((fleet_retail['failure_rate'].max() <= 1.0) and (fleet_retail['failure_rate'].min() >= 0.0))
    val_report["checks"]["no_negative_completed_counts"] = bool(city_pricing['completed_swaps'].min() >= 0)
    
    if not all(val_report["checks"].values()):
        val_report["status"] = "FAIL"
        
    with open(output_dir / "pricing_partner_validation_report.json", "w") as f:
        json.dump(val_report, f, indent=4)
        
    print("--------------------------------------------------")
    print("PRICING & PARTNER ECONOMICS ANALYTICS COMPLETE")
    print("--------------------------------------------------")
    print(f"Files created in {output_dir}:")
    print(" - pricing_profile.csv")
    print(" - pricing_monthly.csv")
    print(" - pricing_peak_offpeak.csv")
    print(" - fleet_vs_retail_economics.csv")
    print(" - fleet_partner_economics.csv")
    print(" - pricing_by_city.csv")
    print(" - pricing_by_vehicle_class.csv")
    print(" - pricing_period_analysis.csv")
    print(" - revenue_margin_relationship.csv")
    print(" - pricing_partner_flags.csv")
    print(" - pricing_partner_observations.json")
    print(" - pricing_partner_validation_report.json")
    
    print(f"\nAnalytical Population: {analytical_population:,} (excluding duplicates)")
    print(f"Completed-Swap Population: {completed_swap_count:,} (production only)")
    print(f"Total Revenue: INR {total_revenue:,.2f}")
    
    coverage = prod_swap_events['contribution_margin_inr'].notna().sum() / len(prod_swap_events)
    print(f"Contribution Margin Coverage: {coverage:.2%} of analytical events")
    
    print("\nKey Observations:")
    for obs in observations:
        print(f" - {obs['topic']}: {obs['observation']}")
        
    print(f"\nValidation Status: {val_report['status']}")
    print("\nImportant Limitations:")
    print(" - Observations describe statistical associations (e.g. margin differences by segment) and do not definitively prove causation.")
    print(" - Missing energy measurements correctly yield a NULL contribution margin, rather than assuming a zero cost.")
    print(" - 'partner_invoice' transactions often feature structured pricing differences; they are correctly treated as legitimate economic events rather than errors.")
    print("--------------------------------------------------")

if __name__ == "__main__":
    create_pricing_partner_analytics()
