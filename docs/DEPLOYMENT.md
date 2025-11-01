# Deployment Guide

This guide covers deploying Zero-Trust Explainer to Google Cloud Platform.

## Prerequisites

- GCP Project with billing enabled
- `gcloud` CLI installed and configured
- Terraform >= 1.5 installed
- Docker installed
- GitHub repository forked (for CI/CD)

## Step 1: GCP Project Setup

### Create or Select Project
```bash
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID
```

### Enable Required APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

## Step 2: Manual Deployment

### Build and Push Images

1. Configure Docker for Artifact Registry:
```bash
export REGION="us-central1"
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

2. Build and push backend:
```bash
cd backend
docker build -t ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/zte-repo/backend:latest .
docker push ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/zte-repo/backend:latest
```

3. Build and push frontend:
```bash
cd frontend
docker build -t ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/zte-repo/frontend:latest .
docker push ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/zte-repo/frontend:latest
```

### Deploy with Terraform

1. Create Artifact Registry Repository first (if not exists):
```bash
gcloud artifacts repositories create zte-repo \
  --repository-format=docker \
  --location=${REGION} \
  --description="Zero-Trust Explainer container images"
```

2. Initialize Terraform:
```bash
cd terraform
terraform init
```

3. Create `terraform.tfvars`:
   
   **Option A: Copy from example file (Recommended)**
   ```bash
   cp terraform/terraform.tfvars.example terraform/terraform.tfvars
   # Edit terraform/terraform.tfvars with your actual values
   ```
   
   **Option B: Create manually**
   ```hcl
   project_id     = "your-project-id"
   region         = "us-central1"
   backend_image  = "us-central1-docker.pkg.dev/your-project-id/zte-repo/backend:latest"
   frontend_image = "us-central1-docker.pkg.dev/your-project-id/zte-repo/frontend:latest"
   # Optionally provide API key for initial Secret Manager setup
   # After first deployment, you can remove this line
   gemini_api_key = "your-ai-studio-api-key"  # Optional - only for initial secret creation
   ```
   
   **Note**: See `terraform/terraform.tfvars.example` for a complete template with all options documented.
   
   **Important**: For CI/CD deployments (GitHub Actions), quick link URLs should be configured via GitHub Secrets (not in terraform.tfvars). See [Step 4: GitHub Actions CI/CD](#step-4-github-actions-cicd) for details. The `terraform.tfvars` file is primarily for local/manual deployments.

4. **Set up Secret Manager (Optional - if not providing API key in tfvars)**:
   ```bash
   # Create the secret manually
   echo -n "your-api-key-here" | gcloud secrets create gemini-api-key \
     --data-file=- \
     --replication-policy="automatic" \
     --project=${GCP_PROJECT_ID}
   ```
   
   If you provide `gemini_api_key` in `terraform.tfvars`, Terraform will create the secret automatically.

5. Plan and apply:
```bash
terraform plan
terraform apply
```

**Note**: On first deployment with `gemini_api_key` in `terraform.tfvars`, Terraform will:
- Create the Secret Manager secret
- Store the API key securely
- Configure Cloud Run to use the secret

After successful deployment, you can remove `gemini_api_key` from `terraform.tfvars` - the secret will continue to work.

6. Get deployment URLs:
```bash
terraform output backend_url
terraform output frontend_url
```

## Step 3: Secret Manager Setup

The application uses GCP Secret Manager to securely store the Gemini API key. This is configured automatically by Terraform.

### Initial Setup (Option 1: Via Terraform)

If you provide `gemini_api_key` in `terraform.tfvars`, Terraform will:
1. Create the secret `gemini-api-key`
2. Store the initial version
3. Grant service account access
4. Configure Cloud Run to use the secret

### Initial Setup (Option 2: Manual)

If you prefer to create the secret manually:

```bash
# Create the secret
echo -n "your-api-key-here" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  --project=${GCP_PROJECT_ID}

# Grant service account access (Terraform will do this, but if doing manually):
SERVICE_ACCOUNT="zte-service-account@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=${GCP_PROJECT_ID}
```

### Update Secret

To update the API key later:

```bash
echo -n "new-api-key-here" | gcloud secrets versions add gemini-api-key \
  --data-file=- \
  --project=${GCP_PROJECT_ID}
```

Cloud Run will automatically use the latest version.

### Verify Secret

```bash
# Check secret exists
gcloud secrets list | grep gemini-api-key

# Check Cloud Run is using secret
gcloud run services describe zte-backend-api \
  --region=${REGION} \
  --format="yaml" | grep -A 5 GEMINI_API_KEY
```

## Step 4: GitHub Actions CI/CD

### Quick Setup (Recommended)

**Option A: Use Setup Script**

1. **Run setup script**:
```bash
# Unix/Mac
export GCP_PROJECT_ID="your-project-id"
chmod +x scripts/setup-cicd.sh
./scripts/setup-cicd.sh

# Windows PowerShell
$env:GCP_PROJECT_ID = "your-project-id"
.\scripts\setup-cicd.ps1
```

2. **Follow the script instructions** to add GitHub Secrets

### Manual Setup

If you prefer to set up manually:

**1. Create Service Account**

```bash
gcloud iam service-accounts create zte-deployer \
  --display-name="ZTE GitHub Actions Deployer" \
  --project=${GCP_PROJECT_ID}
```

**2. Grant Required Permissions**
```bash
# Storage Admin (for Artifact Registry)
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Cloud Run Admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Service Account User (to act as other SAs)
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Project IAM Admin (required to manage project-level IAM policies for Terraform)
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"

# Service Account Admin (required to create/manage service accounts for Terraform)
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountAdmin"

# Artifact Registry Admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

# Pub/Sub Admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/pubsub.admin"

# BigQuery Admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.admin"

# Secret Manager Admin (for managing secrets)
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

# Service Usage Admin (for enabling APIs)
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageAdmin"
```

3. Create and download key:
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com
```

### Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add the following secrets:
   - `GCP_PROJECT_ID`: Your GCP project ID
   - `GCP_SA_KEY`: Contents of the `key.json` file
   - `GEMINI_API_KEY`: Your Google AI Studio API key (optional - only if Terraform will create the secret)
   
   **Optional - Quick Links URLs** (for frontend header links):
   - `DEMO_VIDEO_URL`: URL to demo video (e.g., YouTube, Vimeo)
   - `REPO_URL`: URL to GitHub repository
   - `ARCH_URL`: URL to architecture diagram
   - `AI_STUDIO_URL`: URL to AI Studio prompts/app (using Share App functionality)
   
   **Note**: These quick link URLs will be automatically injected into the frontend at runtime.

### Trigger Deployment

Push to the main branch to trigger automatic deployment:
```bash
git push origin main
```

## Step 4: Verify Deployment

### Check Services
```bash
# List Cloud Run services
gcloud run services list --region=${REGION}

# Get backend URL
gcloud run services describe zte-backend-api \
  --region=${REGION} \
  --format='value(status.url)'

# Get frontend URL
gcloud run services describe zte-frontend \
  --region=${REGION} \
  --format='value(status.url)'
```

### Test Backend API
```bash
export BACKEND_URL=$(gcloud run services describe zte-backend-api \
  --region=${REGION} \
  --format='value(status.url)')

# Health check
curl ${BACKEND_URL}/health

# Test scan endpoint (will fail without proper GCP setup)
curl -X POST ${BACKEND_URL}/scan \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "test-service",
    "region": "us-central1"
  }'
```

### Test Frontend
Open the frontend URL in a browser and verify:
- Page loads correctly
- Can submit scan form
- Can view jobs list
- UI is responsive

## Step 5: Insert Sample Data

For testing, insert sample data into BigQuery:

```bash
# Copy sample data
cat docs/sample-data.sql

# Insert via bq command
bq query --use_legacy_sql=false < docs/sample-data.sql
```

## Troubleshooting

### Image Push Fails
- Verify Artifact Registry repository exists
- Check Docker authentication: `gcloud auth configure-docker`
- Ensure repository permissions are correct

### Terraform Apply Fails
- Check service account permissions
- Verify all required APIs are enabled
- Check image URLs are correct
- Review Terraform error messages

### Cloud Run Service Fails
- Check service logs: `gcloud run services logs read zte-backend-api --region=${REGION}`
- Verify environment variables are set correctly
- Check service account permissions
- Ensure BigQuery dataset and table exist

### Frontend Can't Connect to Backend
- Verify CORS settings in backend
- Check backend URL is correct in frontend environment
- Verify IAM permissions allow public access
- Check network connectivity

## Maintenance

### Update Services

1. Build new images with version tags:
```bash
docker build -t ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/zte-repo/backend:v1.1 .
docker push ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/zte-repo/backend:v1.1
```

2. Update Terraform variables:
```hcl
backend_image = "us-central1-docker.pkg.dev/your-project-id/zte-repo/backend:v1.1"
```

3. Apply changes:
```bash
terraform apply
```

### Monitor Costs

```bash
# Check current costs
gcloud billing accounts list

# View budget alerts
gcloud billing budgets list --billing-account=YOUR_BILLING_ACCOUNT
```

### Scale Services

Edit `terraform/main.tf` to adjust scaling parameters:
```hcl
scaling {
  min_instance_count = 1  # Keep warm instances
  max_instance_count = 20 # Allow more scale
}
```

## Cleanup

To destroy all resources:
```bash
cd terraform
terraform destroy
```

To delete specific resources:
```bash
# Delete Cloud Run services
gcloud run services delete zte-backend-api --region=${REGION}
gcloud run services delete zte-frontend --region=${REGION}

# Delete BigQuery dataset
bq rm -r -f -d zero_trust_explainer

# Delete GCS bucket
gsutil -m rm -r gs://${GCP_PROJECT_ID}-zte-reports
```
