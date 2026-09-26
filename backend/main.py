from fastapi import FastAPI

app = FastAPI(title="VoltVision API")


@app.get("/")
def root():
    return {
        "message": "VoltVision API is running"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "VoltVision Backend"
    }
