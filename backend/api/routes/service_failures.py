from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()

MODULE = "service_failure"

@router.get("")
def get_service_failures():
    try:
        return AnalyticsLoader.load_csv(MODULE, "failure_type_summary.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading service failure summary")

@router.get("/hourly")
def get_service_failures_hourly():
    try:
        return AnalyticsLoader.load_csv(MODULE, "failure_by_hour.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading hourly failures")

@router.get("/city")
def get_service_failures_city():
    try:
        return AnalyticsLoader.load_csv(MODULE, "failure_by_city.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading city failures")

@router.get("/vehicle-class")
def get_service_failures_vehicle_class():
    try:
        return AnalyticsLoader.load_csv(MODULE, "failure_by_vehicle_class.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading vehicle class failures")

@router.get("/concentration")
def get_service_failures_concentration():
    try:
        return AnalyticsLoader.load_csv(MODULE, "failure_concentration.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading failure concentration")

@router.get("/queue-wait")
def get_service_failures_queue_wait():
    try:
        return AnalyticsLoader.load_csv(MODULE, "queue_wait_relationship.csv")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading queue-wait relationship")

@router.get("/validation")
def get_service_failures_validation():
    try:
        return AnalyticsLoader.load_json(MODULE, "service_failure_validation_report.json")
    except Exception:
        raise HTTPException(status_code=500, detail="Error loading validation report")
