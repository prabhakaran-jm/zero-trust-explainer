# Real Cloud Run Service Scanning Guide

## Overview
The Zero-Trust Explainer can now scan **real Cloud Run services** in your Google Cloud project to identify IAM policy vulnerabilities and security issues.

## How to Scan a Real Service

### Option 1: Using the Web UI (Recommended)

1. Open the frontend: https://zte-frontend-459742478845.us-central1.run.app

2. Click **"Scan Service"** button

3. Fill in the form:
   - **Service Name**: The Cloud Run service name (e.g., `zte-backend-api`, `my-service`)
   - **Region**: The service region (e.g., `us-central1`)
   - **Project ID**: `gcr-hackathon` (or your project ID)

4. Click **"Start Scan"**

5. Wait ~10-15 seconds for the scan to complete

6. View findings and use AI-powered features:
   - Click **"AI Explain"** on any finding to get AI-powered security analysis
   - Click **"AI Propose"** to get AI-generated Terraform remediation code

### Option 2: Using the API Directly

```powershell
# Create scan request
$body = @{
    service_name = "zte-backend-api"
    region = "us-central1"
    project_id = "gcr-hackathon"
} | ConvertTo-Json

# Submit scan
Invoke-WebRequest -Uri "https://zte-backend-api-459742478845.us-central1.run.app/scan" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing

# Get job_id from response, then manually trigger the scan processor
gcloud run jobs execute zte-scan-processor --region us-central1 --update-env-vars="JOB_ID=<job_id>,SERVICE_NAME=<service_name>,REGION=<region>,PROJECT_ID=<project_id>"
```

## What Gets Scanned

The scanner analyzes:

1. **IAM Policy**
   - Unauthenticated access (`allUsers`, `allAuthenticatedUsers`)
   - Overly permissive roles (Owner, Editor)
   - Broad access patterns

2. **Network Configuration**
   - VPC connector presence
   - Traffic encryption

3. **Security Configuration**
   - Request timeout settings
   - Environment variable exposure
   - Secret management

## Viewing Results

After scanning:

1. **Findings Dashboard**: See all security findings with severity, description, and recommendations
2. **AI Explanation**: Click "AI Explain" for detailed analysis including:
   - Blast radius assessment
   - Risk assessment
   - Attack vector analysis
   - Compliance impact
   - Priority scoring
3. **AI Proposals**: Click "AI Propose" to get:
   - AI-generated Terraform remediation code
   - Implementation steps
   - Testing recommendations

## Example Services to Scan

Try scanning these services in your project:
- `zte-backend-api` - The backend API service
- `zte-frontend` - The frontend service
- Any other Cloud Run services in your project

## Troubleshooting

### No Findings Returned
- Check Cloud Run service permissions (needs IAM read access)
- Verify the service exists in the specified region
- Check scan processor job logs in Cloud Logging

### AI Features Not Working
- Verify Gemini API key is configured in backend
- Check backend logs for errors
- Ensure `GEMINI_API_KEY` environment variable is set

## Architecture

```
User → Frontend → Backend API → Pub/Sub → Scan Processor Job → BigQuery
                                                  ↓
                                          Cloud Run Services API
                                          IAM Policy Analysis
```

The scan processor runs as a **Cloud Run Job** that:
1. Receives scan request parameters
2. Calls Cloud Run Services API
3. Analyzes IAM policies and configuration
4. Writes security findings to BigQuery
5. Returns findings via backend API

## Next Steps

Once you have findings:
1. Review AI explanations to understand the security risks
2. Use AI Propose to generate remediation code
3. Test the proposed changes in a development environment
4. Apply fixes and re-scan to verify remediation

