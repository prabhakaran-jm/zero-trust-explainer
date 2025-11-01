# Complete CI/CD Setup Guide

This is a comprehensive guide for setting up GitHub Actions CI/CD for Zero-Trust Explainer.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Setup (5 Steps)](#quick-setup-5-steps)
3. [Detailed Setup](#detailed-setup)
4. [Workflow Overview](#workflow-overview)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

## Prerequisites

- ✅ GCP Project with billing enabled
- ✅ `gcloud` CLI installed and configured
- ✅ GitHub repository (can be public or private)
- ✅ GitHub repository admin/maintainer access
- ✅ Git installed locally

## Quick Setup (5 Steps)

### Step 1: Run Setup Script

**Unix/Mac**:
```bash
export GCP_PROJECT_ID="your-project-id"
chmod +x scripts/setup-cicd.sh
./scripts/setup-cicd.sh
```

**Windows PowerShell**:
```powershell
$env:GCP_PROJECT_ID = "your-project-id"
.\scripts\setup-cicd.ps1
```

This script will:
- ✅ Create service account `zte-deployer`
- ✅ Grant all required permissions
- ✅ Create service account key file
- ✅ Display next steps

### Step 2: Copy Service Account Key

The script creates `github-actions-key.json`. Copy its contents:

**Unix/Mac**:
```bash
cat github-actions-key.json
```

**Windows PowerShell**:
```powershell
Get-Content github-actions-key.json
```

### Step 3: Add GitHub Secrets

1. Go to your **GitHub repository**
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

#### Secret 1: `GCP_PROJECT_ID`
- **Name**: `GCP_PROJECT_ID`
- **Value**: Your GCP project ID (e.g., `gcr-hackathon`)

#### Secret 2: `GCP_SA_KEY`
- **Name**: `GCP_SA_KEY`
- **Value**: Paste the entire JSON content from `github-actions-key.json`

#### Secret 3: `GEMINI_API_KEY` (Optional)
- **Name**: `GEMINI_API_KEY`
- **Value**: Your Google AI Studio API key
- **Note**: Only needed for initial Secret Manager setup. Can be removed after first deployment.

### Step 4: Delete Key File

For security, delete the key file after copying:

```bash
# Unix/Mac
rm github-actions-key.json

# Windows PowerShell
Remove-Item github-actions-key.json
```

### Step 5: Trigger Deployment

**Option A: Push to Main Branch**
```bash
git add .
git commit -m "Setup CI/CD"
git push origin master
```

**Option B: Manual Trigger**
1. Go to **Actions** tab in GitHub
2. Select **Deploy Zero-Trust Explainer** workflow
3. Click **Run workflow**
4. Select branch (`master`)
5. Click **Run workflow**

## Detailed Setup

### Service Account Permissions Explained

The setup script grants these roles:

| Role | Purpose |
|------|---------|
| `roles/storage.admin` | Access to Artifact Registry (push/pull images) |
| `roles/run.admin` | Deploy and manage Cloud Run services |
| `roles/iam.serviceAccountUser` | Act as other service accounts |
| `roles/resourcemanager.projectIamAdmin` | Manage project-level IAM policies (required for Terraform) |
| `roles/iam.serviceAccountAdmin` | Create and manage service accounts (required for Terraform) |
| `roles/artifactregistry.admin` | Manage Artifact Registry repositories |
| `roles/pubsub.admin` | Manage Pub/Sub topics/subscriptions |
| `roles/bigquery.admin` | Manage BigQuery datasets/tables |
| `roles/secretmanager.admin` | Manage Secret Manager secrets |
| `roles/serviceusage.serviceUsageAdmin` | Enable/disable GCP APIs |

### Manual Permission Setup

If you prefer to grant permissions manually:

```bash
export GCP_PROJECT_ID="your-project-id"
export SERVICE_ACCOUNT="zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# Grant each role
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/resourcemanager.projectIamAdmin"

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountAdmin"

# ... repeat for other roles
```

## Workflow Overview

### What Happens on Each Push

1. **Trigger**: Push to `main` branch or manual dispatch
2. **Checkout**: Code is checked out to GitHub Actions runner
3. **Authenticate**: GitHub Actions authenticates to GCP using service account key
4. **Build Backend**: Docker image built and pushed to Artifact Registry
5. **Build Frontend**: Docker image built and pushed to Artifact Registry
6. **Enable Prerequisite APIs**: Automatically enables `cloudresourcemanager.googleapis.com` and `iam.googleapis.com` (required for Terraform)
7. **Terraform Plan**: Creates deployment plan with new image URLs
8. **Terraform Apply**: Deploys/updates infrastructure with new images
9. **Display URLs**: Shows backend and frontend URLs

### Workflow File Structure

```
.github/
└── workflows/
    └── deploy.yml          # Main deployment workflow
```

### Workflow Configuration

**Triggers**:
- Push to `main` branch
- Manual dispatch (`workflow_dispatch`)

**Environment Variables**:
- `GCP_PROJECT_ID`: From GitHub Secret
- `GCP_REGION`: `us-central1` (hardcoded)
- `ARTIFACT_REGISTRY_REPO`: `zte-repo` (hardcoded)

**Image Tagging**:
- Commit SHA: `backend:${{ github.sha }}` (immutable)
- Latest: `backend:latest` (updated each push)

## Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering

**Problem**: Workflow doesn't run on push

**Solutions**:
- Check workflow file exists at `.github/workflows/deploy.yml`
- Verify you're pushing to `main` branch (or branch specified in workflow)
- Check GitHub Actions is enabled for your repository

#### 2. Authentication Fails

**Problem**: `Failed to authenticate to Google Cloud`

**Solutions**:
- Verify `GCP_SA_KEY` secret is correct (entire JSON)
- Check service account key hasn't expired
- Verify `GCP_PROJECT_ID` secret is correct
- Check service account has required permissions

#### 3. Docker Build Fails

**Problem**: `Docker build failed`

**Solutions**:
- Check Dockerfile syntax
- Verify all dependencies are correct
- Check build logs for specific errors
- Ensure Dockerfile is in correct directory

#### 4. Docker Push Fails

**Problem**: `Failed to push image`

**Solutions**:
- Verify Artifact Registry repository exists
- Check service account has `artifactregistry.admin` role
- Verify Docker authentication worked
- Check repository format matches: `{region}-docker.pkg.dev/{project-id}/{repo}/{image}`

#### 5. Terraform Plan Fails - Prerequisite APIs Not Enabled

**Problem**: `Cloud Resource Manager API has not been used` or `IAM API has not been used`

**Solutions**:
- The workflow now automatically enables `cloudresourcemanager.googleapis.com` and `iam.googleapis.com` before Terraform runs
- If you still see this error, wait a few minutes for APIs to propagate
- You can also enable manually:
  ```bash
  gcloud services enable cloudresourcemanager.googleapis.com --project=${GCP_PROJECT_ID}
  gcloud services enable iam.googleapis.com --project=${GCP_PROJECT_ID}
  ```

#### 6. Terraform Plan Fails - Other Errors

**Problem**: `Terraform plan failed` (other errors)

**Solutions**:
- Check Terraform plan output in logs
- Verify all required APIs are enabled
- Check service account has Terraform permissions
- Verify Secret Manager secret exists (if using)

#### 7. Terraform Plan Fails - IAM Permission Denied

**Problem**: `Error retrieving IAM policy for project` or `Permission 'iam.serviceAccounts.getIamPolicy' denied`

**Solutions**:
- The GitHub Actions service account needs:
  - `roles/resourcemanager.projectIamAdmin` to manage project-level IAM policies
  - `roles/iam.serviceAccountAdmin` to create/manage service accounts and their IAM policies
- Grant both roles manually:
  ```bash
  # Project IAM Admin
  gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/resourcemanager.projectIamAdmin"
  
  # Service Account Admin
  gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member="serviceAccount:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountAdmin"
  ```
- Or re-run the setup script (it now includes both roles)
- After granting the roles, re-run the GitHub Actions workflow

#### 8. Secret Manager Issues

**Problem**: `Secret not found` or `Permission denied`

**Solutions**:
- If `GEMINI_API_KEY` is in GitHub Secrets, Terraform will create the secret
- If not, create the secret manually:
  ```bash
  echo -n "your-api-key" | gcloud secrets create gemini-api-key \
    --data-file=- \
    --replication-policy="automatic" \
    --project=${GCP_PROJECT_ID}
  ```

## Best Practices

### Security

1. ✅ **Use GitHub Secrets** - Never hardcode credentials
2. ✅ **Rotate Service Account Keys** - Periodically rotate `GCP_SA_KEY`
3. ✅ **Delete Key Files** - Remove `github-actions-key.json` after copying
4. ✅ **Least Privilege** - Grant only necessary permissions
5. ✅ **Secret Manager** - Use Secret Manager for API keys after first deployment

### Workflow Optimization

1. ✅ **Use SHA Tags** - Terraform uses commit SHA tags (immutable)
2. ✅ **Keep Latest Tag** - Latest tag updated for convenience
3. ✅ **Monitor Builds** - Check workflow runs regularly
4. ✅ **Test Locally** - Test Docker builds locally before pushing

### Deployment Strategy

1. ✅ **Small Changes** - Push small, incremental changes
2. ✅ **Monitor Deployments** - Watch workflow runs for errors
3. ✅ **Rollback Plan** - Know how to rollback if needed
4. ✅ **Documentation** - Keep deployment process documented

## Workflow File Reference

### Current Workflow: `.github/workflows/deploy.yml`

**Key Features**:
- ✅ Automatic deployment on push to `main`
- ✅ Manual trigger support
- ✅ Secret Manager support (conditional)
- ✅ SHA-based image tagging
- ✅ Terraform integration
- ✅ Deployment URL output

**Variables Passed to Terraform**:
- `project_id` - From GitHub Secret
- `region` - `us-central1`
- `backend_image` - Built image URL with commit SHA
- `frontend_image` - Built image URL with commit SHA
- `gemini_api_key` - From GitHub Secret (if exists)

## Next Steps

After successful setup:

1. ✅ **Test Deployment** - Push a small change and verify deployment
2. ✅ **Monitor Workflow** - Check workflow runs in Actions tab
3. ✅ **Verify Services** - Test backend and frontend URLs
4. ✅ **Remove API Key** - After first deployment, remove `GEMINI_API_KEY` from GitHub Secrets
5. ✅ **Document Team** - Share setup with team members

## Quick Commands Reference

```bash
# Check service account exists
gcloud iam service-accounts describe zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com

# Check permissions
gcloud projects get-iam-policy ${GCP_PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:zte-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# View workflow runs (if using gh CLI)
gh run list --workflow=deploy.yml

# View latest run logs
gh run view --log

# Rerun failed workflow
gh run rerun RUN_ID
```

## Additional Resources

- **Full Setup Guide**: `docs/CICD_SETUP.md`
- **Quick Start Guide**: `docs/CICD_SETUP_QUICKSTART.md`
- **GitHub Actions Guide**: `docs/GITHUB_ACTIONS.md`
- **Deployment Guide**: `docs/DEPLOYMENT.md`
- **Secret Manager Guide**: `docs/SECRET_MANAGER.md`

---

*Last Updated: [Current Date]*
*Setup Version: 1.0*

