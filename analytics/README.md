# VoltVision Network Performance Analytics

This directory contains scripts and outputs for analyzing the overall performance of the VoltRelay battery swapping network over time.

## Overview
The analytics process aggregates cleaned, validated event-level data (`swap_events_cleaned.csv` and `stations_cleaned.csv`) to compute daily and monthly metrics related to network activity, revenue, contribution margin, and queue wait times.

## Scripts
* **`network_performance.py`**: The core data processing engine. It loads the clean data, applies explicit financial and quality rules, and computes rates and averages at both a daily and monthly level.
* **`service_failure_analysis.py`**: Granular analysis of failures, abandonments, and queue wait times across time (hour, day of week), space (city, station), and riders (vehicle class), producing operational risk indicators.
* **`station_geographic_analysis.py`**: Investigates how station characteristics (city, location type, charger generation, age) and telemetry relate to service performance, without making causal claims.
* **`battery_equipment_analysis.py`**: Builds a comprehensive lifecycle and health profile for batteries by mapping individual swap events, analyzing supplier performance, SOH cohorts, and manufacturing lots.
* **`pricing_partner_economics.py`**: Investigates pricing behavior, revenue economics, contribution margin across peak/off-peak, fleet/retail, specific fleet partners, and vehicle classes.
* **`rider_retention_analysis.py`**: Identifies factors associated with rider retention/non-return and early-life experiences without establishing unsupported causation.

## Data Quality Handling
* **Duplicate Events**: Swaps flagged with `flag_potential_duplicate` are explicitly excluded from all performance calculations to prevent double counting of attempts and revenue.
* **Financial Mismatches**: Transactions flagged as `partner_invoice_pricing` mismatches are retained and processed as normal because they are legitimate completed events according to contract terms.
* **Missing Queue Values**: Missing queue times are safely ignored during averaging, resulting in an accurate average/median computation over observed queue wait events.
* **Test Stations**: Stations with `is_test_station == True` are excluded from operational failure analysis to prevent artificial test events from skewing the real customer experience metrics.

## Key Definitions
* **Completion Rate**: `completed_swaps / total_attempts`
* **Failure Rate**: `failed_swaps / total_attempts` (includes specific hardware failure types such as `failed_no_charged_battery`)
* **Abandonment Rate**: `abandoned_swaps / total_attempts`
* **Variable Cost**: Derived dynamically per-swap using `energy_to_recharge_kwh * grid_tariff_inr_kwh`. This is only calculable for swaps that capture energy usage, meaning primarily completed swaps.
* **Contribution Margin**: `amount_charged_inr - variable_cost`. This represents the raw cash profit on the transaction before fixed overheads (rent, depreciation, salaries).
* **Zero-Charge Events**: Failed/abandoned events correctly carry zero revenue and naturally do not artificially depress the "revenue per completed swap" calculation.

## Running the Analytics
To generate or refresh the analytics:
```bash
python analytics/network_performance.py
python analytics/service_failure_analysis.py
python analytics/station_geographic_analysis.py
python analytics/battery_equipment_analysis.py
python analytics/pricing_partner_economics.py
python analytics/rider_retention_analysis.py
```

## Generated Outputs (`data/processed/analytics/`)
1. **`network_daily.csv`**: Core network performance metrics aggregated by day.
2. **`network_monthly.csv`**: Core network performance metrics aggregated by month.
3. **`network_metric_correlations.csv`**: Pearson correlation matrix analyzing the relationship between completion rates, revenue, failure rates, queue waits, and margins over time.
4. **`network_trend_observations.json`**: An automated, factual extraction of periods where network metrics diverged meaningfully (e.g., revenue increasing while margin decreased).
5. **`analytics_validation_report.json`**: Automated checks ensuring metric constraints hold true (e.g., rates are between 0 and 1, subset columns sum perfectly to total attempts).

## Generated Outputs (`data/processed/analytics/service_failure/`)
1. **`failure_type_summary.csv`**: Raw event types and percentages.
2. **`failure_by_hour.csv` & `failure_by_day_of_week.csv`**: Operational metrics sliced by time.
3. **`failure_by_city.csv` & `failure_by_station.csv`**: Operational metrics sliced by geography.
4. **`failure_by_vehicle_class.csv`**: Operational metrics by rider vehicle type.
5. **`failure_concentration.csv`**: Cumulative percentage of failures per station to identify operational hotspots.
6. **`queue_wait_relationship.csv`**: Abandonment and failure rates bucketed by actual queue-wait quantiles.
7. **`station_operational_flags.csv`**: Transparent, data-driven boolean flags highlighting stations with top-quartile failure, abandonment, or wait times.
8. **`support_ticket_station_summary.csv`**: Aggregation of support tickets per station (where safely linked).
9. **`service_failure_observations.json`**: Factual highlights of elevated failure periods and concentrations.
10. **`service_failure_validation_report.json`**: Automated checks ensuring all subpopulations reconcile with the primary analytical dataset.

## Generated Outputs (`data/processed/analytics/station_geographic/`)
1. **`station_profile.csv`**: Master analytical profile for all production stations.
2. **`station_by_city.csv`**, **`station_by_location_type.csv`**, **`station_by_charger_generation.csv`**, **`station_by_commissioning_age.csv`**: Cohort analyses by key physical and temporal characteristics.
3. **`station_telemetry_summary.csv`**: Station-level aggregations of hardware telemetry (uptime, temp, outages).
4. **`station_battery_turnaround.csv`**: Documentation of timestamp limitations for turnaround derivation.
5. **`station_support_summary.csv`**: Categorized support ticket volume safely tied to stations.
6. **`station_metric_distribution.csv`**: The statistical variance (percentiles) of station performance to track network consistency.
7. **`station_cohort_analysis.csv`**: Multi-dimensional intersections (e.g. Generation x City).
8. **`station_geographic_flags.csv`**: Hard, percentile-based flags isolating stations with anomalous performance.
9. **`station_geographic_observations.json`**: Factual text observations about characteristics.
10. **`station_geographic_validation_report.json`**: Automated integrity checks for the aggregations.

## Generated Outputs (`data/processed/analytics/battery_equipment/`)
1. **`battery_profile.csv`**: Master analytical profile mapping swap utilization and health for every valid battery.
2. **`battery_soh_analysis.csv`**: Operational metrics and range delivery segmented by State of Health (SOH) cohorts.
3. **`battery_cycle_analysis.csv`**: Lifecycle analysis grouping batteries by observed charge-cycle (swap) counts.
4. **`battery_by_supplier.csv` & `battery_by_manufacturing_lot.csv`**: Aggregated performance metrics evaluating distinct manufacturing origins.
5. **`battery_swap_activity.csv`**: Groupings of high, medium, and low utilization cohorts based on active days and swap frequency.
6. **`battery_swap_linkage_validation.csv`**: Explicit validation metrics proving the coverage rate of linking `battery_in_id` to the master battery table.
7. **`equipment_battery_relationship.csv`**: Exploration of incoming battery health grouped by the generation of the receiving station charger.
8. **`battery_cohort_analysis.csv`**: Deeper multi-dimensional intersections (e.g., supplier by cycle-count).
9. **`battery_equipment_flags.csv`**: Data-driven, percentile-based operational flags isolating batteries with anomalously low SOH, short delivered range, or extreme cycle counts.
10. **`battery_equipment_observations.json`**: Highlighted factual findings from the analytical cohorts without unsupported causal claims.
11. **`battery_equipment_validation_report.json`**: Automated validation ensuring primary key uniqueness, strict linkage math, and correct subpopulation derivations.

## Generated Outputs (`data/processed/analytics/pricing_partner/`)
1. **`pricing_profile.csv`**: Dimensionally aggregated analytical view of transactions.
2. **`pricing_monthly.csv`**: Monthly aggregated pricing, revenue, and margin economics.
3. **`pricing_peak_offpeak.csv`**: Economics segmented by pricing periods.
4. **`fleet_vs_retail_economics.csv`**: Performance mapping across fleet and retail usage.
5. **`fleet_partner_economics.csv`**: Economics mapped uniquely to specific fleet partners.
6. **`pricing_by_city.csv`**: City-level aggregation of margins and revenues.
7. **`pricing_by_vehicle_class.csv`**: Vehicle-class aggregation of margins and revenues.
8. **`pricing_period_analysis.csv`**: Time-segmented cohort analysis mapping peak changes dynamically.
9. **`revenue_margin_relationship.csv`**: Relationship mapping to track gross revenue vs unit margins over time.
10. **`pricing_partner_flags.csv`**: Specific, percentiles-based flags highlighting low-margin or high-discount combinations.
11. **`pricing_partner_observations.json`**: Automated generation of unbiased statistical observations.
12. **`pricing_partner_validation_report.json`**: Reconciles mathematical outputs and confirms correct treatment of legitimate partner pricing.

## Generated Outputs (`data/processed/analytics/rider_retention/`)
1. **`rider_profile.csv`**: Complete rider-level analytical profile.
2. **`new_rider_cohort.csv`**: Transparent definition of the new-rider cohort based on early behavior.
3. **`retention_summary.csv`**: Core retention metrics and non-return rates with explicit denominators.
4. **`retention_first_experience.csv`**: Retention segmented by initial exposure (failure, wait time).
5. **`retention_by_rider_segment.csv`**: Retention variations across physical and business cohorts.
6. **`failure_retention_relationship.csv`**: Impact of early-life failures on return probability.
7. **`pricing_retention_relationship.csv`**: Impact of early-life pricing exposures on return probability.
8. **`support_retention_relationship.csv`**: Interaction between support activity, CSAT, and retention.
9. **`rider_journey_analysis.csv`**: Early-life (first 30 days) behavioral progression tracking.
10. **`retention_factor_analysis.csv`**: Consolidated factor-level observations for rapid intelligence.
11. **`retention_cohort_analysis.csv`**: Intersectional cohorts highlighting compounding return risk.
12. **`retention_flags.csv`**: Statistically significant flags identifying unusually low-retention groups.
13. **`rider_retention_observations.json`**: Strictly observational insights confirming early-life associations.
14. **`rider_retention_validation_report.json`**: Confirms that denominators correctly isolate only those with sufficient follow-up windows.
