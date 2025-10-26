# Zero-Trust Explainer - Repository Structure

## 📁 Clean Repository Structure

```
zero-trust-explainer/
├── README.md                    # Main documentation
├── SUBMISSION.md                # Hackathon submission details
├── LICENSE                      # MIT License
├── .gitignore                   # Git ignore rules
│
├── backend/                     # FastAPI backend
│   ├── main.py                  # Main API application with AI integration
│   ├── propose_job.py           # Cloud Run Job for AI-powered fix proposals
│   ├── scan_processor.py        # Cloud Run scanning logic
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Backend container
│
├── frontend/                     # React/Vite frontend
│   ├── src/
│   │   ├── App.jsx              # Main application
│   │   ├── App.css               # Styles
│   │   ├── main.jsx              # Entry point
│   │   ├── index.css             # Global styles
│   │   ├── components/           # React components
│   │   │   ├── FindingsList.jsx
│   │   │   ├── FindingsList.css
│   │   │   ├── JobCard.jsx
│   │   │   ├── JobCard.css
│   │   │   ├── ScanForm.jsx
│   │   │   └── ScanForm.css
│   │   └── services/
│   │       └── api.js            # API client
│   ├── package.json             # Node dependencies
│   ├── vite.config.js           # Vite configuration
│   ├── index.html               # HTML template
│   ├── nginx.conf               # Nginx configuration
│   └── Dockerfile               # Frontend container
│
├── terraform/                    # Infrastructure as Code
│   ├── apis.tf                   # API enablement
│   ├── backend.tf                # Terraform state backend
│   ├── cloudrun.tf               # Cloud Run services and jobs
│   ├── data.tf                   # BigQuery and Pub/Sub
│   ├── iam.tf                    # IAM roles and permissions
│   ├── outputs.tf                # Output variables
│   ├── providers.tf              # Terraform providers
│   ├── storage.tf                # Artifact Registry and GCS
│   ├── variables.tf              # Input variables
│   └── terraform.tfvars         # Variable values (.gitignored)
│
├── docs/                         # Documentation
│   ├── API.md                    # API reference
│   ├── ARCHITECTURE.md           # System architecture
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── SCANNING_GUIDE.md         # How to scan services
│   └── VULNERABLE_SERVICE_GUIDE.md # Test service creation
│
└── scripts/                      # Utility scripts
    ├── create-test-service.sh   # Create vulnerable service (Unix)
    ├── create-test-service.ps1   # Create vulnerable service (Windows)
    └── verify-structure.sh       # Verify project structure
```

## 📚 Documentation Files

### Essential Documentation
- **README.md** - Main project documentation with setup and usage
- **SUBMISSION.md** - Hackathon submission details

### Technical Documentation (docs/)
- **API.md** - API endpoint reference
- **ARCHITECTURE.md** - System architecture and components
- **DEPLOYMENT.md** - Deployment instructions
- **SCANNING_GUIDE.md** - How to scan Cloud Run services
- **VULNERABLE_SERVICE_GUIDE.md** - Creating test services

## 🎯 Key Features

### AI-Powered Capabilities (Google AI Studio)
- 🤖 **AI Explain** - Intelligent security analysis with blast radius
- 🤖 **AI Propose** - Automated Terraform remediation code
- 📊 **Executive Summaries** - AI-powered compliance reporting

### Core Functionality
- 🔍 Real Cloud Run service scanning
- 📊 BigQuery data warehouse
- 🔄 Pub/Sub message queue
- 🛠️ Cloud Run Jobs for async processing
- 📁 GCS report storage with signed URLs

## 🚀 Quick Start

1. **Deploy Infrastructure**:
   ```bash
   cd terraform
   terraform init
   terraform apply
   ```

2. **Build and Deploy**:
   ```bash
   # Backend
   cd backend
   docker build -t gcr.io/your-project/backend:latest .
   docker push gcr.io/your-project/backend:latest
   
   # Frontend  
   cd ../frontend
   docker build -t gcr.io/your-project/frontend:latest .
   docker push gcr.io/your-project/frontend:latest
   ```

3. **Access Application**:
   - Frontend: https://zte-frontend-xxx.run.app
   - Backend API: https://zte-backend-api-xxx.run.app

## 📝 Configuration

Set the following in `terraform/terraform.tfvars`:
- `project_id` - Your GCP project ID
- `region` - Deployment region
- `backend_image` - Backend container image
- `frontend_image` - Frontend container image
- `gemini_api_key` - Google AI Studio API key

## 🎬 Demo Scenarios

See `SUBMISSION.md` for detailed demo scenarios showcasing:
- Scanning Cloud Run services
- AI-powered security analysis
- Automated remediation code generation
- Executive reporting

