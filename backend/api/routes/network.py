from fastapi import APIRouter, HTTPException, Query
from services.analytics_loader import AnalyticsLoader
from schemas.network import KPISummary
from typing import Any, List, Optional
import pandas as pd

router = APIRouter()

@router.get("/kpis", response_model=KPISummary)
def get_kpis():
    try:
        # Load monthly data to aggregate global KPIs safely
        monthly_data = AnalyticsLoader.load_csv("", "network_monthly.csv")
        validation = AnalyticsLoader.load_json("", "analytics_validation_report.json")
        
        if not monthly_data:
            raise HTTPException(status_code=404, detail="No analytics data found.")
            
        df = pd.DataFrame(monthly_data)
        
        total_attempts = df['total_attempts'].sum()
        completed_swaps = df['completed_swaps'].sum()
        failed_swaps = df['failed_swaps'].sum()
        abandoned_swaps = df['abandoned_swaps'].sum()
        cancelled_swaps = df['cancelled_swaps'].sum()
        system_errors = df['system_error_swaps'].sum()
        total_revenue = df['total_revenue'].sum()
        total_margin = df['total_contribution_margin'].sum()
        
        margin_per_swap = total_margin / completed_swaps if completed_swaps > 0 else None
        
        dates = validation.get("checks", {}).get("date_coverage", {})
        start_date = dates.get("daily_min", "")
        end_date = dates.get("daily_max", "")
        
        return KPISummary(
            total_attempts=int(total_attempts),
            completed_swaps=int(completed_swaps),
            completion_rate=completed_swaps / total_attempts if total_attempts > 0 else 0.0,
            total_revenue_inr=float(total_revenue),
            failure_rate=failed_swaps / total_attempts if total_attempts > 0 else 0.0,
            abandonment_rate=abandoned_swaps / total_attempts if total_attempts > 0 else 0.0,
            cancellation_rate=cancelled_swaps / total_attempts if total_attempts > 0 else 0.0,
            system_error_rate=system_errors / total_attempts if total_attempts > 0 else 0.0,
            contribution_margin_per_swap=float(margin_per_swap) if margin_per_swap is not None else None,
            data_start_date=start_date,
            data_end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error computing KPIs")

@router.get("/network/trends")
def get_network_trends(limit: Optional[int] = Query(None, description="Limit the number of trend rows returned")):
    try:
        data = AnalyticsLoader.load_csv("", "network_monthly.csv")
        if limit and limit > 0:
            data = data[-limit:] # typical trend view wants the most recent if limited
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error loading trend data")

@router.get("/network/correlations")
def get_network_correlations():
    try:
        return AnalyticsLoader.load_csv("", "network_metric_correlations.csv")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error loading correlation data")

@router.get("/network/observations")
def get_network_observations():
    try:
        return AnalyticsLoader.load_json("", "network_trend_observations.json")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error loading observations")

@router.get("/network/validation")
def get_network_validation():
    try:
        return AnalyticsLoader.load_json("", "analytics_validation_report.json")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error loading validation report")
