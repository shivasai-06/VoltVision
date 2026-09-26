# VoltVision — EV Battery Swap Analytics & Decision Intelligence

## 1. Project Overview
VoltVision is an advanced analytical engine designed for the VoltRelay EV battery swapping network. It processes millions of telemetry, financial, and operational records to identify operational bottlenecks, measure customer experience, and track network reliability without making unverified causal claims.

## 2. Problem Statement
Managing a rapidly growing distributed EV battery swapping network involves complex interactions between hardware performance, operational logistics, and consumer behavior. Without clear, data-driven visibility into service failures, station-level telemetry, and network margins, strategic decisions cannot be made effectively.

## 3. Business Questions
VoltVision is designed to answer three core business questions:
1. How did the VoltRelay network perform over time in terms of completed swaps, revenue, failure rates, and contribution margin per swap?
2. Where and when are service failures happening, and how are they affecting the customer experience?
3. How do station characteristics and geography relate to service performance?

## 4. Key Capabilities
* **Data Cleansing Engine:** Robust pipelines that handle missing telemetry safely, categorize financial discrepancies contractually, and gracefully isolate test stations and duplicates.
* **Network Performance Analytics:** Daily and monthly aggregations tracking network health and raw contribution margins.
* **Service Failure Profiling:** Granular breakdown of failure points across time (hours, days) and space (stations, cities), tied to queue waits.
* **Geographic & Cohort Intelligence:** Identification of anomalous station metrics, segmented by charger hardware generation and commissioning age.

## 5. Architecture
VoltVision processes raw CSV data pipelines through Python Pandas transformations, outputting rigorously validated analytical data models. These clean data models serve as the foundational backend for downstream applications (dashboards, AI integration).

## 6. Technology Stack
* **Language:** Python 3.12+
* **Data Processing:** Pandas, NumPy
* **Analytics Automation:** Custom Python analytical modules
* **Output Format:** Interoperable CSV and JSON metadata

## 7. Project Structure
* `analytics/` - Core analytical engines for network performance, service failures, and geographic intelligence.
* `backend/` - (Planned) Backend API layer.
* `data_cleaning_pipeline.py` - The primary ETL script transitioning raw data to clean structured outputs.
* `frontend/` - (Planned) User interface for dynamic operational tracking.
* `docs/` - Documentation directory.
* `notebooks/` - Exploratory analytical notebooks.

## 8. Analytics Pipeline
1. **Cleaning:** `data_cleaning_pipeline.py` processes raw files and stores validated outputs in `data/processed/`.
2. **Aggregation:** Scripts within `analytics/` read from `data/processed/` and construct granular business insights.
3. **Validation:** Automated JSON validation reports accompany every analytical module to ensure mathematical integrity.

## 9. Data Setup
Raw operational datasets must be placed in `data/raw/` (ignored by Git). Required raw files:
* `stations.csv`
* `swap_events.csv`
* `station_hourly_status.csv`
* `support_tickets.csv`
* `riders.csv`

## 10. How to Run Locally
1. Ensure Python 3.12+ is installed.
2. Initialize a virtual environment and install requirements (e.g., pandas, numpy).
3. Run the cleaning pipeline: `python data_cleaning_pipeline.py`
4. Run analytical modules:
   * `python analytics/network_performance.py`
   * `python analytics/service_failure_analysis.py`
   * `python analytics/station_geographic_analysis.py`

## 11. Current Development Status
Steps 4A, 4B, and 4C of the backend analytical pipeline have been completely implemented and validated. The system outputs robust data layers ready for frontend visualization.

## 12. Future Roadmap
* Frontend UI dashboard implementation.
* Integration of an LLM/AI (Gemini) intelligent assistant to query analytical findings dynamically.
* API endpoints to serve validated data layers to downstream microservices.

## 13. Data-Quality and Analytical Methodology
The project strictly enforces transparent data rules: potential duplicate records are dropped from aggregations, zero-revenue failed events are handled accurately, test stations are walled off from production performance, and missing telemetry correctly defaults to `NaN` instead of artificially depressing numerical averages. 

## 14. Important Analytical Disclaimer
VoltVision's analytical modules identify statistical *associations* between operational characteristics (such as queue wait times and abandonment rates). The analytics **do not prove causation**, as unknown confounders may influence user behavior and hardware performance.

## 15. Step 5 — Backend API
* A robust **FastAPI backend** now exists in the `backend/` directory.
* The processed **analytics outputs are served through a backend layer** via the reusable `AnalyticsLoader`.
* The current step establishes a **clean modular API foundation** (with CORS, strict error handling, and separation of concerns).
* Current implemented analytical endpoints expose the precomputed Step 4 metrics rather than recalculating them:
  * `GET /api/kpis` - Exposes the overall, validated network KPIs.
  * `GET /api/network/trends` - Returns monthly network trends (completed swaps, margin, rates).
  * `GET /api/network/correlations` - Exposes mathematically derived network metric correlations.
  * `GET /api/network/observations` - Returns the engine's automated behavioral observations.
  * `GET /api/network/validation` - Supplies the network validation report for data-integrity checks.
* **Future endpoints** will expose the remaining analytics modules to power the frontend interface.
