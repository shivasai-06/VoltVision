from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()

MODULE = "station_geographic"

@router.get("")
def get_stations():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_profile.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station profile")

@router.get("/city")
def get_stations_by_city():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_by_city.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station by city")

@router.get("/location-type")
def get_stations_by_location_type():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_by_location_type.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station by location type")

@router.get("/charger-generation")
def get_stations_by_charger_generation():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_by_charger_generation.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station by charger generation")

@router.get("/commissioning-age")
def get_stations_by_commissioning_age():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_by_commissioning_age.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station by commissioning age")

@router.get("/telemetry")
def get_stations_telemetry():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_telemetry_summary.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station telemetry")

@router.get("/support")
def get_stations_support():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_support_summary.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station support summary")

@router.get("/flags")
def get_stations_flags():
    try:
        return AnalyticsLoader.load_csv(MODULE, "station_geographic_flags.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station flags")

@router.get("/observations")
def get_stations_observations():
    try:
        return AnalyticsLoader.load_json(MODULE, "station_geographic_observations.json")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading station observations")

@router.get("/validation")
def get_stations_validation():
    try:
        return AnalyticsLoader.load_json(MODULE, "station_geographic_validation_report.json")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading validation report")
