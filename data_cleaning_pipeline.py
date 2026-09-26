import pandas as pd
import numpy as np
import os
import json
from datetime import timedelta

RAW_DIR = r"c:\Users\Shiva Sai\OneDrive\Desktop\VoltVision\data\raw"
PROCESSED_DIR = r"c:\Users\Shiva Sai\OneDrive\Desktop\VoltVision\data\processed"
REPORT_PATH = r"c:\Users\Shiva Sai\OneDrive\Desktop\VoltVision\data\processed\data_quality_report.json"

os.makedirs(PROCESSED_DIR, exist_ok=True)

quality_report = {}

def log_report(dataset_name, rows_before, rows_after, missing_before, missing_after, flagged, transformations):
    quality_report[dataset_name] = {
        "rows_before_cleaning": rows_before,
        "rows_after_cleaning": rows_after,
        "missing_values_before": missing_before,
        "missing_values_after": missing_after,
        "records_flagged": flagged,
        "transformations_applied": transformations
    }

def clean_stations():
    df = pd.read_csv(os.path.join(RAW_DIR, "stations.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    # Datetime
    df['commissioned_date'] = pd.to_datetime(df['commissioned_date'])
    df['decommissioned_date'] = pd.to_datetime(df['decommissioned_date'])
    df['firmware_updated_date'] = pd.to_datetime(df['firmware_updated_date'])
    transformations.append({"action": "Parsed dates to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})

    # Test Stations Flag
    df['is_test_station'] = df['station_id'].str.startswith('STN-TST')
    transformations.append({"action": "Created is_test_station flag", "reason": "Identify test stations to exclude from production analysis", "affected_records": int(df['is_test_station'].sum())})

    # Validations
    df['flag_invalid_dates'] = (df['decommissioned_date'].notna()) & (df['decommissioned_date'] < df['commissioned_date'])
    df['flag_invalid_lat'] = ~df['latitude'].between(-90, 90)
    df['flag_invalid_lon'] = ~df['longitude'].between(-180, 180)

    flagged["invalid_dates"] = int(df['flag_invalid_dates'].sum())
    flagged["invalid_lat"] = int(df['flag_invalid_lat'].sum())
    flagged["invalid_lon"] = int(df['flag_invalid_lon'].sum())

    df.to_csv(os.path.join(PROCESSED_DIR, "stations_cleaned.csv"), index=False)
    log_report("stations", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)
    return df

def clean_station_hourly_status(stations_df):
    df = pd.read_csv(os.path.join(RAW_DIR, "station_hourly_status.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    # Datetime
    df['hour_start'] = pd.to_datetime(df['hour_start'])
    transformations.append({"action": "Parsed hour_start to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})

    # Join with stations to find 2W only stations
    df = df.merge(stations_df[['station_id', 'slots_3w']], on='station_id', how='left')
    
    # Impute missing charged_3w_min for 2W only stations
    mask_2w_only = df['slots_3w'] == 0
    mask_missing = df['charged_3w_min'].isna()
    affected_3w = int((mask_2w_only & mask_missing).sum())
    df.loc[mask_2w_only & mask_missing, 'charged_3w_min'] = 0
    transformations.append({"action": "Imputed missing charged_3w_min with 0", "reason": "Station only supports 2W vehicles", "affected_records": affected_3w})
    
    df = df.drop(columns=['slots_3w'])

    # Validations (Explicit bounds: ambient -10 to 60, cabinet -10 to 80, ignores NaN)
    df['flag_invalid_temp'] = (
        (df['ambient_temp_c'].notna() & ~df['ambient_temp_c'].between(-10, 60)) | 
        (df['cabinet_temp_c'].notna() & ~df['cabinet_temp_c'].between(-10, 80))
    )
    df['flag_telemetry_missing'] = df['charged_2w_avg'].isna()
    
    flagged["invalid_temp"] = int(df['flag_invalid_temp'].sum())
    flagged["telemetry_missing"] = int(df['flag_telemetry_missing'].sum())
    
    df.to_csv(os.path.join(PROCESSED_DIR, "station_hourly_status_cleaned.csv"), index=False)
    log_report("station_hourly_status", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)

def clean_riders():
    df = pd.read_csv(os.path.join(RAW_DIR, "riders.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    df['signup_date'] = pd.to_datetime(df['signup_date'])
    transformations.append({"action": "Parsed signup_date to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})

    # Standardize home city mapping to actual distinct names instead of blind Title Case
    city_mapping = {
        'delhi ncr': 'Delhi NCR', 'delhi': 'Delhi NCR',
        'blr': 'Bengaluru', 'bangalore': 'Bengaluru', 'bengaluru': 'Bengaluru',
        'hyd': 'Hyderabad', 'hyderabad': 'Hyderabad',
        'mum': 'Mumbai', 'mumbai': 'Mumbai',
        'pun': 'Pune', 'pune': 'Pune',
        'jai': 'Jaipur', 'jaipur': 'Jaipur'
    }
    # Keep original column untouched.
    df['standardized_home_city'] = df['home_city'].str.strip().str.lower().map(city_mapping).fillna(df['home_city'].str.strip().str.title())
    transformations.append({"action": "Created standardized_home_city field", "reason": "Harmonize inconsistent city names without altering raw data", "affected_records": rows_before})
    
    df.to_csv(os.path.join(PROCESSED_DIR, "riders_cleaned.csv"), index=False)
    log_report("riders", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)

def clean_swap_events():
    chunk_size = 500000
    rows_before = 0
    rows_after = 0
    missing_before = {}
    missing_after = {}
    flagged = {
        "timestamp_corrected": 0, "potential_duplicate": 0, "suspicious_km": 0, 
        "invalid_soc_soh": 0, "financial_mismatch": 0, "unclassified_event": 0,
        "financial_mismatch_none": 0, "financial_mismatch_failed_or_abandoned_zero_charge": 0,
        "financial_mismatch_partner_invoice_pricing": 0, "financial_mismatch_other_mismatch": 0
    }
    transformations = [
        {"action": "Parsed event_ts to datetime", "reason": "Enable time-series analysis"},
        {"action": "Corrected timezone bug (+5h30m)", "reason": "Fix known firmware v3.2.0 issue between Mar 10 and Apr 14, 2025"},
        {"action": "Created event status flags (is_swap_completed, etc.) based on exact event_type", "reason": "Categorize event outcomes cleanly while preserving original"},
        {"action": "Created derived time fields", "reason": "Facilitate temporal aggregation"}
    ]
    
    first_chunk = True
    out_file = os.path.join(PROCESSED_DIR, "swap_events_cleaned.csv")
    
    for chunk in pd.read_csv(os.path.join(RAW_DIR, "swap_events.csv"), chunksize=chunk_size, low_memory=False):
        rows_before += len(chunk)
        for k, v in chunk.isna().sum().items(): missing_before[k] = missing_before.get(k, 0) + v
        
        # Datetime
        chunk['event_ts'] = pd.to_datetime(chunk['event_ts'])
        
        # Firmware bug correction
        bug_mask = (chunk['station_firmware'] == 'v3.2.0') & (chunk['event_ts'] >= '2025-03-10') & (chunk['event_ts'] <= '2025-04-14')
        chunk.loc[bug_mask, 'event_ts'] += pd.Timedelta(hours=5, minutes=30)
        chunk['flag_timestamp_corrected'] = bug_mask
        flagged["timestamp_corrected"] += bug_mask.sum()
        
        # Derived fields
        chunk['event_date'] = chunk['event_ts'].dt.date
        chunk['event_hour'] = chunk['event_ts'].dt.hour
        chunk['event_weekday'] = chunk['event_ts'].dt.day_name()
        chunk['event_month'] = chunk['event_ts'].dt.month
        
        # Event Status Indicators
        chunk['is_swap_completed'] = chunk['event_type'] == 'swap_completed'
        chunk['is_swap_failed'] = chunk['event_type'] == 'failed_no_charged_battery'
        chunk['is_swap_abandoned'] = chunk['event_type'] == 'abandoned_queue'
        chunk['is_swap_cancelled'] = chunk['event_type'] == 'cancelled_by_rider'
        chunk['is_swap_system_error'] = chunk['event_type'] == 'failed_system_error'
        
        classified_mask = chunk['is_swap_completed'] | chunk['is_swap_failed'] | chunk['is_swap_abandoned'] | chunk['is_swap_cancelled'] | chunk['is_swap_system_error']
        chunk['is_unclassified_event'] = ~classified_mask
        flagged["unclassified_event"] += chunk['is_unclassified_event'].sum()
        
        # Duplicates using stronger condition
        chunk['flag_potential_duplicate'] = chunk.duplicated(subset=['rider_id', 'station_id', 'event_ts', 'attempt_seq'], keep=False)
        flagged["potential_duplicate"] += chunk['flag_potential_duplicate'].sum()
        
        # Validations
        chunk['flag_suspicious_km'] = (chunk['km_since_last_swap'] < 0) | (chunk['km_since_last_swap'] > 200)
        flagged["suspicious_km"] += chunk['flag_suspicious_km'].sum()
        
        soc_soh_cols = ['soc_in_pct', 'soh_in_pct', 'soc_out_pct', 'soh_out_pct']
        chunk['flag_invalid_soc_soh'] = False
        for col in soc_soh_cols:
            chunk['flag_invalid_soc_soh'] |= (~chunk[col].between(0, 100)) & (chunk[col].notna())
        flagged["invalid_soc_soh"] += chunk['flag_invalid_soc_soh'].sum()
        
        # Financial tolerance 0.01 instead of exact equality
        chunk['flag_financial_mismatch'] = np.abs(chunk['list_price_inr'] - chunk['discount_inr'] - chunk['amount_charged_inr']) > 0.01
        flagged["financial_mismatch"] += chunk['flag_financial_mismatch'].sum()
        
        # Financial Mismatch Classification
        failed_or_abandoned_mask = chunk['is_swap_failed'] | chunk['is_swap_abandoned'] | chunk['is_swap_cancelled'] | chunk['is_swap_system_error']
        
        cond_failed_zero = chunk['flag_financial_mismatch'] & failed_or_abandoned_mask & (chunk['amount_charged_inr'] == 0)
        cond_partner = chunk['flag_financial_mismatch'] & ~cond_failed_zero & (chunk['payment_mode'] == 'partner_invoice')
        cond_other = chunk['flag_financial_mismatch'] & ~cond_failed_zero & ~cond_partner
        
        chunk['financial_mismatch_type'] = 'none'
        chunk.loc[cond_failed_zero, 'financial_mismatch_type'] = 'failed_or_abandoned_zero_charge'
        chunk.loc[cond_partner, 'financial_mismatch_type'] = 'partner_invoice_pricing'
        chunk.loc[cond_other, 'financial_mismatch_type'] = 'other_mismatch'
        
        flagged["financial_mismatch_none"] += (chunk['financial_mismatch_type'] == 'none').sum()
        flagged["financial_mismatch_failed_or_abandoned_zero_charge"] += cond_failed_zero.sum()
        flagged["financial_mismatch_partner_invoice_pricing"] += cond_partner.sum()
        flagged["financial_mismatch_other_mismatch"] += cond_other.sum()
        
        rows_after += len(chunk)
        for k, v in chunk.isna().sum().items(): missing_after[k] = missing_after.get(k, 0) + v
        
        chunk.to_csv(out_file, mode='a' if not first_chunk else 'w', header=first_chunk, index=False)
        first_chunk = False
        
    flagged = {k: int(v) for k, v in flagged.items()}
    missing_before = {k: int(v) for k, v in missing_before.items()}
    missing_after = {k: int(v) for k, v in missing_after.items()}
    log_report("swap_events", rows_before, rows_after, missing_before, missing_after, flagged, transformations)

def clean_batteries():
    df = pd.read_csv(os.path.join(RAW_DIR, "batteries.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    df['manufacture_date'] = pd.to_datetime(df['manufacture_date'])
    df['commission_date'] = pd.to_datetime(df['commission_date'])
    df['retired_date'] = pd.to_datetime(df['retired_date'])
    transformations.append({"action": "Parsed dates to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})
    
    df['flag_manufacture_after_commission'] = (df['commission_date'].notna()) & (df['manufacture_date'].notna()) & (df['commission_date'] < df['manufacture_date'])
    df['flag_commission_after_retirement'] = (df['retired_date'].notna()) & (df['commission_date'].notna()) & (df['retired_date'] < df['commission_date'])
    df['flag_invalid_soh'] = (~df['current_soh_pct'].between(0, 100)) | (~df['initial_soh_pct'].between(0, 100))
    df['flag_invalid_capacity'] = df['rated_capacity_kwh'] <= 0
    
    flagged["manufacture_after_commission"] = int(df['flag_manufacture_after_commission'].sum())
    flagged["commission_after_retirement"] = int(df['flag_commission_after_retirement'].sum())
    flagged["invalid_soh"] = int(df['flag_invalid_soh'].sum())
    flagged["invalid_capacity"] = int(df['flag_invalid_capacity'].sum())
    
    df.to_csv(os.path.join(PROCESSED_DIR, "batteries_cleaned.csv"), index=False)
    log_report("batteries", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)

def clean_support_tickets():
    df = pd.read_csv(os.path.join(RAW_DIR, "support_tickets.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    df['created_ts'] = pd.to_datetime(df['created_ts'])
    transformations.append({"action": "Parsed created_ts to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})
    
    df['flag_invalid_resolution_hours'] = (df['resolution_hours'] < 0) & (df['resolution_hours'].notna())
    df['flag_invalid_csat'] = (~df['csat_score'].between(1, 5)) & (df['csat_score'].notna())
    
    flagged["invalid_resolution_hours"] = int(df['flag_invalid_resolution_hours'].sum())
    flagged["invalid_csat"] = int(df['flag_invalid_csat'].sum())
    
    df.to_csv(os.path.join(PROCESSED_DIR, "support_tickets_cleaned.csv"), index=False)
    log_report("support_tickets", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)

def clean_city_daily_context():
    df = pd.read_csv(os.path.join(RAW_DIR, "city_daily_context.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    df['date'] = pd.to_datetime(df['date'])
    transformations.append({"action": "Parsed date to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})
    
    df['has_festival_or_event'] = df['festival_or_event'].notna()
    transformations.append({"action": "Created has_festival_or_event flag", "reason": "Identify days with known events, preserving NaNs", "affected_records": int(df['has_festival_or_event'].sum())})
    
    df['flag_invalid_temp'] = df['max_temp_c'] < df['min_temp_c']
    flagged["invalid_temp"] = int(df['flag_invalid_temp'].sum())
    
    df.to_csv(os.path.join(PROCESSED_DIR, "city_daily_context_cleaned.csv"), index=False)
    log_report("city_daily_context", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)

def clean_fleet_partners():
    df = pd.read_csv(os.path.join(RAW_DIR, "fleet_partners.csv"))
    rows_before = len(df)
    missing_before = df.isna().sum().to_dict()
    transformations = []
    flagged = {}

    df['contract_start_date'] = pd.to_datetime(df['contract_start_date'])
    df['amendment_date'] = pd.to_datetime(df['amendment_date'])
    transformations.append({"action": "Parsed dates to datetime", "reason": "Enable time-series analysis", "affected_records": rows_before})
    
    df['flag_invalid_amendment'] = (df['amendment_date'].notna()) & (df['amendment_date'] < df['contract_start_date'])
    flagged["invalid_amendment"] = int(df['flag_invalid_amendment'].sum())
    
    df.to_csv(os.path.join(PROCESSED_DIR, "fleet_partners_cleaned.csv"), index=False)
    log_report("fleet_partners", rows_before, len(df), missing_before, df.isna().sum().to_dict(), flagged, transformations)

def main():
    print("Starting data cleaning pipeline...")
    stations_df = clean_stations()
    clean_station_hourly_status(stations_df)
    clean_riders()
    clean_batteries()
    clean_support_tickets()
    clean_city_daily_context()
    clean_fleet_partners()
    clean_swap_events()
    
    with open(REPORT_PATH, 'w') as f:
        json.dump(quality_report, f, indent=4)
    print("Pipeline completed and quality report generated.")

if __name__ == "__main__":
    main()
