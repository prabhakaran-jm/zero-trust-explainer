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
│  └──────────────────┘ REST   └───────┬────────────────────┘   │
└────────────────────────────────────────│────────────────────┘
                                         │
                         ┌───────────────┘
                         │ API Key (auto-injected)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Secret Manager                          │
│                  🔐 gemini-api-key                          │
└─────────────────────────────────────────────────────────────┘
                                         │
                                         │ Prompts (with API Key)
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
- **Secret Manager**: Secure storage for Gemini API key (auto-injected into Cloud Run)

### Cloud Run Jobs
- **Scan Processor Job**: Processes scan requests and writes findings to BigQuery
- **Propose Job**: Generates AI-powered remediation reports

## Key Technologies Used

1. **Cloud Run Services**: Frontend and Backend API
2. **Google AI Studio**: Gemini Pro for AI analysis
3. **Secret Manager**: Secure API key storage and injection
4. **Cloud Run Jobs**: Async processing for scans and proposals
5. **Pub/Sub**: Event-driven messaging
6. **BigQuery**: Data warehouse for findings
7. **Cloud Storage**: Secure report storage

## Data Flow

1. **User** sends Web Request → **Cloud Run Service (Frontend)**
2. **Frontend** → **Backend API** (REST calls)
3. **Secret Manager** → **Backend API** (API key auto-injected as environment variable)
4. **Backend API** sends **Prompts** → **Gemini Pro** (using API key from Secret Manager)
5. **Gemini Pro** returns **AI Responses** → **Backend API**
6. **Backend API** interacts with:
   - **Secret Manager** (reads API key automatically)
   - **Pub/Sub** (publish scan requests)
   - **BigQuery** (query/store findings)
   - **Cloud Storage** (store reports)
   - **Cloud Run Jobs** (trigger async processing, which also receive API key from Secret Manager)

## Architecture Diagram Reference

- **Mermaid Diagram**: `docs/architecture-diagram-full.mmd`
- **Visual PNG**: Generate using Mermaid tools or online renderers
- **Interactive**: Can be rendered at https://mermaid.live/

