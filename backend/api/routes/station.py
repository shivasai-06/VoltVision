from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()
MODULE = "station_geographic"

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
    return _load_csv("station_profile.csv")

@router.get("/city")
def get_city():
    return _load_csv("station_by_city.csv")

@router.get("/location-type")
def get_location_type():
    return _load_csv("station_by_location_type.csv")

@router.get("/charger-generation")
def get_charger_generation():
    return _load_csv("station_by_charger_generation.csv")

@router.get("/commissioning-age")
def get_commissioning_age():
    return _load_csv("station_by_commissioning_age.csv")

@router.get("/telemetry")
def get_telemetry():
    return _load_csv("station_telemetry_summary.csv")

@router.get("/support")
def get_support():
    return _load_csv("station_support_summary.csv")

@router.get("/cohort")
def get_cohort():
    return _load_csv("station_cohort_analysis.csv")

@router.get("/flags")
def get_flags():
    return _load_csv("station_geographic_flags.csv")

@router.get("/observations")
def get_observations():
    return _load_json("station_geographic_observations.json")

@router.get("/validation")
def get_validation():
    return _load_json("station_geographic_validation_report.json")
