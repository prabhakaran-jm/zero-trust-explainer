# Secret Manager Setup

This guide explains how the Zero-Trust Explainer application uses GCP Secret Manager to securely store the Gemini API key.

## Overview

The application uses **GCP Secret Manager** to store the Gemini API key instead of hardcoding it in Terraform variables or code. This provides:

- ✅ **Secure storage** - Encrypted at rest and in transit
- ✅ **Automatic injection** - Cloud Run automatically injects secrets as environment variables
- ✅ **Easy rotation** - Update secrets without code changes
- ✅ **Audit trail** - Secret access is logged
- ✅ **Least privilege** - Only service account has access

## Architecture

```
┌─────────────────────────────────────────┐
│      GCP Secret Manager                 │
│      Secret: gemini-api-key             │
└─────────────┬───────────────────────────┘
              │ IAM: secretmanager.secretAccessor
              │
              ▼
┌─────────────────────────────────────────┐
│   Service Account: zte-service-account  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      Cloud Run Services/Jobs            │
│      Environment Variable:               │
│      GEMINI_API_KEY (auto-injected)     │
└─────────────────────────────────────────┘
```

## Setup Methods

### Method 1: Terraform Auto-Creation (Easiest)

If you provide the API key in `terraform.tfvars` during initial deployment:

1. **Add to `terraform.tfvars`**:
```hcl
project_id     = "your-project-id"
region         = "us-central1"
backend_image  = "..."
frontend_image = "..."
gemini_api_key = "your-api-key-here"  # Only needed for initial setup
```

2. **Run Terraform**:
```bash
cd terraform
terraform apply
```

Terraform will:
- ✅ Enable Secret Manager API
- ✅ Create secret `gemini-api-key`
- ✅ Store the API key as initial version
- ✅ Grant service account access
- ✅ Configure Cloud Run to use the secret

3. **After deployment**, remove `gemini_api_key` from `terraform.tfvars`:
```hcl
# Remove this line - secret is now in Secret Manager
# gemini_api_key = "..."
```

The secret will continue to work even after removing the variable.

### Method 2: Manual Creation

If you prefer to create the secret manually (more secure for CI/CD):

1. **Create the secret**:
```bash
echo -n "your-api-key-here" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  --project=YOUR_PROJECT_ID
```

2. **Run Terraform** (without API key in tfvars):
```bash
cd terraform
terraform apply
```

Terraform will:
- ✅ Enable Secret Manager API
- ✅ Create the secret resource (if it doesn't exist)
- ✅ Grant service account access
- ✅ Configure Cloud Run to use the secret

**Note**: If the secret already exists, Terraform will reference it. If it doesn't exist, Terraform will create the empty secret, and you'll need to add the secret version manually.

## Updating the Secret

To update the API key after initial setup:

```bash
echo -n "new-api-key-here" | gcloud secrets versions add gemini-api-key \
  --data-file=- \
  --project=YOUR_PROJECT_ID
```

Cloud Run will automatically use the latest version. You may need to restart services:

```bash
gcloud run services update zte-backend-api \
  --region=us-central1 \
  --project=YOUR_PROJECT_ID
```

## Verification

### Check Secret Exists

```bash
gcloud secrets list --project=YOUR_PROJECT_ID | grep gemini-api-key
```

### Check IAM Permissions

```bash
gcloud secrets get-iam-policy gemini-api-key --project=YOUR_PROJECT_ID
```

Should show `zte-service-account@...` with role `roles/secretmanager.secretAccessor`.

### Check Cloud Run Configuration

```bash
gcloud run services describe zte-backend-api \
  --region=us-central1 \
  --project=YOUR_PROJECT_ID \
  --format="yaml" | grep -A 10 GEMINI_API_KEY
```

Should show:
```yaml
- name: GEMINI_API_KEY
  valueSource:
    secretKeyRef:
      secret: gemini-api-key
      version: latest
```

### Test the Service

```bash
BACKEND_URL=$(gcloud run services describe zte-backend-api \
  --region=us-central1 \
  --project=YOUR_PROJECT_ID \
  --format='value(status.url)')

curl ${BACKEND_URL}/
```

Should return JSON with `ai_studio.enabled: true` if the secret is working.

## Troubleshooting

### Secret Not Found

**Error**: `Secret [gemini-api-key] not found`

**Solution**:
1. Create the secret manually (Method 2 above)
2. Or provide `gemini_api_key` in `terraform.tfvars` and run `terraform apply`

### Permission Denied

**Error**: `Permission denied on secret`

**Solution**:
1. Verify service account has access:
```bash
gcloud secrets get-iam-policy gemini-api-key --project=YOUR_PROJECT_ID
```

2. Grant access if missing:
```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:zte-service-account@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID
```

### Service Not Reading Secret

**Issue**: Service shows `ai_studio.enabled: false`

**Solution**:
1. Verify Cloud Run configuration:
```bash
gcloud run services describe zte-backend-api --region=us-central1 --format=yaml | grep -A 5 GEMINI_API_KEY
```

2. Restart the service:
```bash
gcloud run services update zte-backend-api --region=us-central1
```

3. Check service logs:
```bash
gcloud run services logs read zte-backend-api --region=us-central1 --limit=50
```

## Local Development

For local development, Secret Manager is not used. Instead, use environment variables:

**Backend `.env` file**:
```bash
GEMINI_API_KEY=your-api-key-here
```

Or export:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

The backend code reads from `os.environ.get("GEMINI_API_KEY")`, which works for both:
- Local: Environment variable
- Cloud Run: Secret Manager injection

## Security Best Practices

1. ✅ **Never commit secrets to git** - `terraform.tfvars` is in `.gitignore`
2. ✅ **Use Secret Manager** - Secrets are encrypted and audited
3. ✅ **Rotate secrets regularly** - Update secret versions periodically
4. ✅ **Least privilege access** - Only service account has access
5. ✅ **Monitor secret access** - Review Cloud Logging for secret access

## Terraform Configuration

The Secret Manager integration is configured in:

- **`terraform/secrets.tf`** - Secret resource and IAM bindings
- **`terraform/cloudrun.tf`** - Cloud Run secret configuration
- **`terraform/variables.tf`** - Optional `gemini_api_key` variable

See these files for the complete implementation.

