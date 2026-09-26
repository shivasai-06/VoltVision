from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()
MODULE = "pricing_partner"

def _load_csv(filename: str):
    try:
        return AnalyticsLoader.load_csv(MODULE, filename)
    except Exception:
        raise HTTPException(status_code=500, detail=f"Error loading {filename}")

def _load_json(filename: str):
    try:
        return AnalyticsLoader.load_json(MODULE, filename)
    except Exception:
        raise HTTPException(status_code=500, detail=f"Error loading {filename}")

@router.get("/profile")
def get_profile():
    return _load_csv("pricing_profile.csv")

@router.get("/monthly")
def get_monthly():
    return _load_csv("pricing_monthly.csv")

@router.get("/peak-offpeak")
def get_peak_offpeak():
    return _load_csv("pricing_peak_offpeak.csv")

@router.get("/fleet-vs-retail")
def get_fleet_vs_retail():
    return _load_csv("fleet_vs_retail_economics.csv")

@router.get("/fleet-partners")
def get_fleet_partners():
    return _load_csv("fleet_partner_economics.csv")

@router.get("/city")
def get_city():
    return _load_csv("pricing_by_city.csv")

@router.get("/vehicle-class")
def get_vehicle_class():
    return _load_csv("pricing_by_vehicle_class.csv")

@router.get("/period")
def get_period():
    return _load_csv("pricing_period_analysis.csv")

@router.get("/revenue-margin")
def get_revenue_margin():
    return _load_csv("revenue_margin_relationship.csv")

@router.get("/flags")
def get_flags():
    return _load_csv("pricing_partner_flags.csv")

@router.get("/observations")
def get_observations():
    return _load_json("pricing_partner_observations.json")

@router.get("/validation")
def get_validation():
    return _load_json("pricing_partner_validation_report.json")
