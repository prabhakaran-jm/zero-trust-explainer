# Zero-Trust Explainer (ZTE)

Human-readable IAM diffs for Cloud Run — find risk, explain blast radius, ship least-privilege patches (with proofs).

## Overview

Zero-Trust Explainer is a comprehensive security scanning and analysis tool for Google Cloud Run services. It helps identify IAM misconfigurations, explains security risks with blast radius analysis, and proposes least-privilege fixes.

### Features

- 🔍 **Scan Cloud Run Services**: Submit scan requests via REST API to analyze IAM configurations
- 📊 **View Findings**: Query findings from BigQuery with filtering by job ID and severity
- 💡 **Explain Risks**: Get detailed explanations with blast radius analysis for each finding
- 🛠️ **Propose Fixes**: Trigger automated least-privilege fix proposals via Cloud Run Jobs
- 📁 **Signed Reports**: Generate and access security reports via signed GCS URLs
- 🎨 **Modern UI**: React/Vite frontend with job cards, severity filters, and action buttons

## Architecture

### Backend (FastAPI)
- **POST /scan** - Publishes scan requests to Pub/Sub
- **GET /findings/{job_id}** - Retrieves findings from BigQuery with optional severity filtering
- **GET /explain/{id}** - Provides detailed explanation with blast radius analysis
- **POST /propose/{job_id}** - Triggers Cloud Run Job to propose least-privilege fixes
- **GET /jobs** - Lists recent scan jobs with summary statistics

### Frontend (React/Vite)
- Job cards with severity breakdown (critical, high, medium, low)
- Filtering by job_id and severity
- Actions: Scan, Refresh, Explain, Propose
- Real-time updates and loading states

### Infrastructure (Terraform)
- **Artifact Registry**: Container image repository
- **Cloud Run Services**: Backend API and Frontend
- **Cloud Run Job**: Propose fixes execution
- **Pub/Sub**: Scan request queue
- **BigQuery**: Findings data warehouse
- **GCS Bucket**: Report storage with signed URLs

## Prerequisites

- Google Cloud Platform account
- GCP Project with billing enabled
- Terraform >= 1.5
- Docker
- Node.js >= 20 (for local frontend development)
- Python >= 3.11 (for local backend development)

## Setup

### 1. Configure GCP

```bash
# Set your project ID
export GCP_PROJECT_ID="your-project-id"

# Enable required APIs (done automatically by Terraform)
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com
```

### 2. Local Development

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export PUBSUB_TOPIC="zte-scan-requests"
export BQ_DATASET="zero_trust_explainer"
export BQ_TABLE="findings"
export REPORT_BUCKET="your-project-id-zte-reports"
export REGION="us-central1"

# Run locally
python main.py
```

#### Frontend
```bash
cd frontend
npm install

# Set API URL
export VITE_API_URL="http://localhost:8080"

# Run development server
npm run dev
```

### 3. Deploy with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_id = "your-project-id"
region = "us-central1"
backend_image = "us-central1-docker.pkg.dev/your-project-id/zte-repo/backend:latest"
frontend_image = "us-central1-docker.pkg.dev/your-project-id/zte-repo/frontend:latest"
EOF

# Plan deployment
terraform plan

# Apply deployment
terraform apply
```

### 4. GitHub Actions Deployment

1. Create GCP Service Account with required permissions:
```bash
gcloud iam service-accounts create zte-deployer \
  --display-name="ZTE Deployer"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/owner"

gcloud iam service-accounts keys create key.json \
  --iam-account=zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com
```

2. Add GitHub Secrets:
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Contents of key.json file

3. Push to main branch to trigger deployment

## API Usage

### Submit a Scan
```bash
curl -X POST https://your-backend-url/scan \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "my-cloud-run-service",
    "region": "us-central1",
    "project_id": "your-project-id"
  }'
```

### Get Findings
```bash
curl https://your-backend-url/findings/{job_id}?severity=high
```

### Explain Finding
```bash
curl https://your-backend-url/explain/{finding_id}
```

### Propose Fixes
```bash
curl -X POST https://your-backend-url/propose/{job_id}
```

### List Jobs
```bash
curl https://your-backend-url/jobs?limit=50
```

## Environment Variables

### Backend
- `GCP_PROJECT_ID` - GCP project ID
- `PUBSUB_TOPIC` - Pub/Sub topic name (default: zte-scan-requests)
- `BQ_DATASET` - BigQuery dataset ID (default: zero_trust_explainer)
- `BQ_TABLE` - BigQuery table name (default: findings)
- `REPORT_BUCKET` - GCS bucket for reports (optional, enables signed URLs)
- `PROPOSE_JOB_NAME` - Cloud Run Job name (default: zte-propose-job)
- `REGION` - GCP region (default: us-central1)

### Frontend
- `VITE_API_URL` - Backend API URL

## BigQuery Schema

The findings table includes:
- `id` (STRING, REQUIRED) - Unique finding identifier
- `job_id` (STRING, REQUIRED) - Scan job identifier
- `severity` (STRING, REQUIRED) - Severity level (critical, high, medium, low)
- `resource_type` (STRING, REQUIRED) - Type of resource
- `resource_name` (STRING, REQUIRED) - Name of the resource
- `issue_description` (STRING, REQUIRED) - Description of the issue
- `recommendation` (STRING, REQUIRED) - Recommended fix
- `blast_radius` (STRING, NULLABLE) - Blast radius description
- `affected_resources` (STRING, NULLABLE) - JSON array of affected resources
- `risk_score` (INTEGER, NULLABLE) - Risk score (0-100)
- `created_at` (TIMESTAMP, REQUIRED) - Creation timestamp

## Development

### Project Structure
```
zero-trust-explainer/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   └── Dockerfile        # Backend container
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main application
│   │   ├── components/   # React components
│   │   └── services/     # API service
│   ├── package.json      # Node dependencies
│   ├── vite.config.js    # Vite configuration
│   ├── Dockerfile        # Frontend container
│   └── nginx.conf        # Nginx configuration
├── terraform/
│   └── main.tf           # Infrastructure as code
└── .github/
    └── workflows/
        └── deploy.yml    # CI/CD pipeline
```

### Testing Locally

1. Start backend:
```bash
cd backend
python main.py
```

2. Start frontend in another terminal:
```bash
cd frontend
npm run dev
```

3. Open http://localhost:3000 in your browser

## Security Considerations

- All Cloud Run services use dedicated service accounts with least-privilege permissions
- BigQuery data is partitioned by date for efficient querying
- GCS bucket uses uniform bucket-level access
- Signed URLs expire after 1 hour
- CORS is configured (adjust for production)
- Service accounts have specific IAM roles for each GCP service

## Troubleshooting

### Backend fails to start
- Verify all environment variables are set
- Check GCP credentials and project permissions
- Ensure BigQuery dataset and table exist

### Frontend can't connect to backend
- Verify VITE_API_URL is correct
- Check CORS configuration in backend
- Ensure backend service is publicly accessible

### Terraform errors
- Verify service account has required permissions
- Check that all required APIs are enabled
- Ensure image URLs are correct and images exist

## License

This project is provided as-is for demonstration purposes.

## Support

For issues and questions, please open a GitHub issue.
