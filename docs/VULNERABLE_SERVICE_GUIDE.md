# Creating a Vulnerable Cloud Run Service for Testing

This guide helps you create a Cloud Run service with intentional security misconfigurations to test the Zero-Trust Explainer scanner.

## Quick Start

### Option 1: Use the PowerShell Script (Windows)

```powershell
.\scripts\create-test-service.ps1
```

### Option 2: Use the Bash Script (Linux/Mac)

```bash
chmod +x scripts/create-test-service.sh
./scripts/create-test-service.sh
```

### Option 3: Manual Creation

```powershell
# Deploy a simple service with vulnerable configuration
gcloud run deploy test-vulnerable-service `
  --project gcr-hackathon `
  --region us-central1 `
  --image gcr.io/cloudrun/hello `
  --allow-unauthenticated `
  --set-env-vars API_KEY=secret123456,PASSWORD=admin123,TOKEN=my_secret_token

# Make it vulnerable - add allUsers permission
gcloud run services add-iam-policy-binding test-vulnerable-service `
  --region us-central1 `
  --member="allUsers" `
  --role="roles/run.invoker" `
  --project gcr-hackathon
```

## What Makes This Service Vulnerable?

The created service has these security issues:

### 1. ❌ Unauthenticated Access
- **Issue**: `allUsers` has invoker permission
- **Risk**: Anyone on the internet can invoke the service
- **Severity**: CRITICAL

### 2. ❌ Exposed Secrets
- **Issue**: Secrets stored as plain text environment variables
- **Variables**: `API_KEY`, `PASSWORD`, `TOKEN`
- **Risk**: Secrets visible in logs and container runtime
- **Severity**: HIGH

### 3. ⚠️ No VPC Connector
- **Issue**: Service not connected to private VPC
- **Risk**: Exposes network traffic to public internet
- **Severity**: MEDIUM

## Testing the Scanner

After creating the vulnerable service:

1. Open: https://zte-frontend-459742478845.us-central1.run.app
2. Click **"Scan Service"**
3. Enter:
   - Service Name: `test-vulnerable-service`
   - Region: `us-central1`
   - Project ID: `gcr-hackathon`
4. Click **"Start Scan"**
5. Wait ~10 seconds for results

## Expected Findings

You should see these security findings:

### CRITICAL
- **Unauthenticated access**: Service allows `allUsers` to invoke

### HIGH
- **Exposed secrets**: Environment variables contain API keys, passwords, or tokens
- **Over-permissive roles**: Service account has Editor/Owner role (if applicable)

### MEDIUM
- **No VPC connector**: Service not configured for private network access
- **Missing timeouts**: No request timeout configured

## Remediation

### Fix Unauthenticated Access

```powershell
# Remove public access
gcloud run services remove-iam-policy-binding test-vulnerable-service `
  --region us-central1 `
  --member="allUsers" `
  --role="roles/run.invoker"
```

### Fix Exposed Secrets

```powershell
# Store secrets in Secret Manager
gcloud secrets create api-key --data-file=api-key.txt
gcloud secrets add-iam-policy-binding api-key \
  --member="serviceAccount:test-vulnerable-service-sa@gcr-hackathon.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secret
gcloud run services update test-vulnerable-service \
  --region us-central1 \
  --update-secrets API_KEY=api-key:latest
```

### Fix VPC Configuration

```powershell
# Create VPC connector
gcloud compute networks vpc-access connectors create test-connector \
  --region us-central1 \
  --subnet test-subnet

# Update service to use VPC
gcloud run services update test-vulnerable-service \
  --region us-central1 \
  --vpc-connector test-connector \
  --vpc-egress all-traffic
```

## Cleanup

After testing, delete the vulnerable service:

```powershell
gcloud run services delete test-vulnerable-service `
  --region us-central1 `
  --project gcr-hackathon
```

## Tips

- Use different service names if testing multiple configurations
- Check Cloud Logging for scan processor errors
- Verify IAM permissions for the scan processor service account
- Test with both public and private services to see different findings

