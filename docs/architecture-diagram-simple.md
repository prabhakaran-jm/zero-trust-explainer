# Zero-Trust Explainer - Architecture Diagram

## Simple Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                         👤 User                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Web Request (HTTPS)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Run Service                        │
│  ┌──────────────────┐        ┌──────────────────────────┐   │
│  │   Frontend       │        │    Backend API           │   │
│  │  (React/Vite UI) │◄──────►│  (FastAPI + Gemini Pro) │   │
│  └──────────────────┘ REST   └──────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Prompts
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Google AI Studio                         │
│                      🤖 Gemini Pro                           │
│                   AI Analysis & Code Gen                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ AI Responses
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API                              │
└─────┬─────────┬─────────┬─────────┬─────────┬─────────────┘
      │         │         │         │         │
      ▼         ▼         ▼         ▼         ▼
┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐
│ Pub/Sub │ │  BQ  │ │  GCS │ │ Scan │ │ Propose │
│         │ │      │ │      │ │ Job  │ │  Job    │
└─────────┘ └──────┘ └──────┘ └──────┘ └─────────┘
```

## Component Breakdown

### Cloud Run Service
- **Frontend (React/Vite)**: User interface for submitting scans and viewing results
- **Backend API (FastAPI)**: RESTful API with Gemini Pro integration for AI analysis

### Google AI Studio (Gemini Pro)
- **Security Finding Explanations**: Blast radius, risk assessment, business impact
- **Scan Summaries**: Executive summaries with compliance analysis
- **Code Generation**: Production-ready Terraform remediation code

### Google Cloud Data Services
- **Pub/Sub**: Asynchronous scan request queue
- **BigQuery**: Findings data warehouse
- **Cloud Storage**: Report storage with signed URLs

### Cloud Run Jobs
- **Scan Processor Job**: Processes scan requests and writes findings to BigQuery
- **Propose Job**: Generates AI-powered remediation reports

## Key Technologies Used

1. **Cloud Run Services**: Frontend and Backend API
2. **Google AI Studio**: Gemini Pro for AI analysis
3. **Cloud Run Jobs**: Async processing for scans and proposals
4. **Pub/Sub**: Event-driven messaging
5. **BigQuery**: Data warehouse for findings
6. **Cloud Storage**: Secure report storage

## Data Flow

1. **User** sends Web Request → **Cloud Run Service (Frontend)**
2. **Frontend** → **Backend API** (REST calls)
3. **Backend API** sends **Prompts** → **Gemini Pro**
4. **Gemini Pro** returns **AI Responses** → **Backend API**
5. **Backend API** interacts with:
   - **Pub/Sub** (publish scan requests)
   - **BigQuery** (query/store findings)
   - **Cloud Storage** (store reports)
   - **Cloud Run Jobs** (trigger async processing)

## Architecture Diagram Reference

- **Mermaid Diagram**: `docs/architecture-diagram-full.mmd`
- **Visual PNG**: Generate using Mermaid tools or online renderers
- **Interactive**: Can be rendered at https://mermaid.live/

