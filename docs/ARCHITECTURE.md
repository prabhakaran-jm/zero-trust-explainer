# Zero-Trust Explainer Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ HTTPS
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Cloud Run - Frontend                           │
│                   (React/Vite/Nginx)                              │
└───────────────────────┬───────────────────────────────────────────┘
                        │
                        │ REST API
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Cloud Run - Backend API                        │
│                      (FastAPI/Python)                             │
└─────┬─────────┬──────────┬──────────┬─────────────┬──────────────┘
      │         │          │          │             │
      │         │          │          │             │
      ▼         ▼          ▼          ▼             ▼
┌──────────┐ ┌─────┐  ┌─────────┐ ┌─────┐   ┌──────────────┐
│  Pub/Sub │ │ BQ  │  │   GCS   │ │ Run │   │ Secret Mgr   │
│  Topic   │ │     │  │ Bucket  │ │ Job │   │ (API Key)    │
└──────────┘ └─────┘  └─────────┘ └─────┘   └──────────────┘
     │          ▲          ▲         │             ▲
     │          │          │         │             │
     └──────────┴──────────┴─────────┘             │
            Data Flow                               │
                                         API Key Injection
```

## Components

### Frontend (React/Vite)
- **Purpose**: User interface for interacting with the system
- **Technology**: React 18, Vite build tool, Nginx web server
- **Features**:
  - Scan submission form
  - Job listing with severity breakdown
  - Findings viewer with filters
  - Explain, Summary, and Propose actions
  - Real-time status updates

### Backend API (FastAPI)
- **Purpose**: REST API for managing scans, findings, and proposals
- **Technology**: Python 3.11, FastAPI, Uvicorn
- **Endpoints**:
  - POST /scan - Submit new scan request
  - GET /findings/{job_id} - Retrieve findings
  - GET /explain/{finding_id} - Get detailed explanation
  - GET /summary/{job_id} - Generate AI-powered executive summary
  - POST /propose/{job_id} - Trigger fix proposal
  - GET /jobs - List recent jobs

### Pub/Sub
- **Purpose**: Asynchronous message queue for scan requests
- **Flow**: Backend publishes scan requests → Workers consume and process
- **Benefits**: Decoupling, scalability, reliability

### BigQuery
- **Purpose**: Data warehouse for findings storage and analysis
- **Schema**: 
  - Findings table with partitioning by date
  - Columns: id, job_id, severity, resource info, recommendations
- **Usage**: Query findings with filters, aggregations, and analytics

### Cloud Storage (GCS)
- **Purpose**: Storage for detailed reports and artifacts
- **Features**:
  - Signed URLs for secure access
  - Versioning enabled
  - Lifecycle policies for cleanup
- **Structure**: /proposals/{job_id}/report.json

### Cloud Run Job
- **Purpose**: Batch processing for fix proposals
- **Trigger**: On-demand via API
- **Function**: Analyze findings and generate least-privilege patches

## Data Flow

### Scan Workflow
1. User submits scan via frontend
2. Frontend calls POST /scan on backend
3. Backend generates job_id and publishes to Pub/Sub
4. Backend returns job_id to user
5. Worker (not yet implemented) consumes message and scans service
6. Worker writes findings to BigQuery
7. User queries findings via GET /findings/{job_id}

### Explain Workflow
1. User clicks "Explain" on a finding
2. Frontend calls GET /explain/{finding_id}
3. Backend queries BigQuery for detailed finding data
4. Backend calls AI Studio to generate explanation with blast radius
5. Backend returns structured explanation
6. Frontend displays explanation to user

### Summary Workflow
1. User clicks "AI Summary" on a job
2. Frontend calls GET /summary/{job_id}
3. Backend queries BigQuery for all findings in the job
4. Backend calls AI Studio to generate executive summary
5. AI returns comprehensive summary with risk overview, compliance status, and remediation roadmap
6. Backend returns summary data
7. Frontend displays formatted summary modal with phase-based roadmap

### Propose Workflow
1. User clicks "Propose" for a job
2. Frontend calls POST /propose/{job_id}
3. Backend triggers Cloud Run Job
4. Job processes findings and generates fixes
5. Job writes report to GCS
6. Backend generates signed URL for report
7. Backend returns URL to user

## Security

### Authentication & Authorization
- Service accounts with least-privilege IAM roles
- Cloud Run services use dedicated service account
- Public access controlled via IAM bindings
- Signed URLs for temporary GCS access

### Secret Management
- **GCP Secret Manager** for storing sensitive data (Gemini API key)
- Secrets encrypted at rest and in transit
- Automatic secret injection into Cloud Run containers as environment variables
- Service account has `secretmanager.secretAccessor` role (least privilege)
- Secret rotation supported via Secret Manager versions
- API key never stored in Terraform state or code

### Network Security
- HTTPS enforced for all traffic
- Cloud Run services in same VPC (configurable)
- Private Google Access for GCP APIs
- CORS configured appropriately

### Data Security
- BigQuery data encrypted at rest
- GCS bucket encryption enabled
- Service account keys rotation
- Audit logging enabled

## Deployment

### Infrastructure as Code
- Terraform manages all GCP resources
- Modular configuration with variables
- State management (local or remote)

### CI/CD Pipeline
- GitHub Actions workflow
- Automated Docker builds
- Artifact Registry for images
- Terraform apply on push to main

## Monitoring & Observability

### Logging
- Cloud Logging integration
- Structured logs from application
- Request/response logging
- Error tracking

### Metrics
- Cloud Run built-in metrics
- Custom metrics for business logic
- BigQuery query performance
- Pub/Sub message throughput

### Alerting
- Cloud Monitoring alerts
- Anomaly detection
- Budget alerts
- SLO monitoring

## Scalability

### Horizontal Scaling
- Cloud Run auto-scales based on traffic
- Min 0, max 10 instances (configurable)
- Pub/Sub handles message backlog
- BigQuery scales automatically

### Performance Optimization
- BigQuery table partitioning
- Query result caching
- Frontend asset optimization
- CDN for static content (optional)

## Cost Optimization

### Resource Efficiency
- Cloud Run scales to zero
- BigQuery slot reservation (optional)
- GCS lifecycle policies
- Artifact Registry cleanup

### Monitoring
- Budget alerts configured
- Cost allocation by label
- Usage reports
- Optimization recommendations
