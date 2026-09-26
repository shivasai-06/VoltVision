from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import health, test_loader, network, service_failures, stations, service_failure, station

app = FastAPI(title="VoltVision API")

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Hide internal stack traces
    return JSONResponse(
        status_code=500,
        content={"error": "An unexpected server error occurred."},
    )

# Include Routers
app.include_router(health.router)
app.include_router(test_loader.router)
app.include_router(network.router, prefix="/api")
app.include_router(service_failures.router, prefix="/api/service-failures")
app.include_router(stations.router, prefix="/api/stations")
app.include_router(service_failure.router, prefix="/api/service-failure")
app.include_router(station.router, prefix="/api/stations")

# Placeholders for future endpoints:
# app.include_router(batteries.router, prefix="/api/batteries")
# app.include_router(pricing.router, prefix="/api/pricing")
# app.include_router(retention.router, prefix="/api/retention")
# app.include_router(insights.router, prefix="/api/insights")
