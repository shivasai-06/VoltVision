from fastapi import APIRouter

router = APIRouter()

@router.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "VoltVision Backend"
    }

@router.get("/")
def root():
    return {
        "message": "VoltVision API is running"
    }
