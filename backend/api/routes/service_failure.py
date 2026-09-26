from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()
MODULE = "service_failure"

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

@router.get("/summary")
def get_summary():
    return _load_csv("failure_type_summary.csv")

@router.get("/hourly")
def get_hourly():
    return _load_csv("failure_by_hour.csv")

@router.get("/day-of-week")
def get_day_of_week():
    return _load_csv("failure_by_day_of_week.csv")

@router.get("/city")
def get_city():
    return _load_csv("failure_by_city.csv")

@router.get("/station")
def get_station():
    return _load_csv("failure_by_station.csv")

@router.get("/vehicle-class")
def get_vehicle_class():
    return _load_csv("failure_by_vehicle_class.csv")

@router.get("/concentration")
def get_concentration():
    return _load_csv("failure_concentration.csv")

@router.get("/queue-wait")
def get_queue_wait():
    return _load_csv("queue_wait_relationship.csv")

@router.get("/observations")
def get_observations():
    return _load_json("service_failure_observations.json")

@router.get("/validation")
def get_validation():
    return _load_json("service_failure_validation_report.json")
