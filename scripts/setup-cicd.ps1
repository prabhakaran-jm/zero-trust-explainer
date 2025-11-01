# Setup script for GitHub Actions CI/CD (PowerShell)
# This script creates the service account and sets up permissions for GitHub Actions

$ErrorActionPreference = "Stop"

Write-Host "=== GitHub Actions CI/CD Setup ===" -ForegroundColor Green
Write-Host ""

# Check if GCP_PROJECT_ID is set
if (-not $env:GCP_PROJECT_ID) {
    Write-Host "Error: GCP_PROJECT_ID environment variable is not set" -ForegroundColor Red
    Write-Host "Please set it with: `$env:GCP_PROJECT_ID = 'your-project-id'" -ForegroundColor Yellow
    exit 1
}

$PROJECT_ID = $env:GCP_PROJECT_ID
Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Yellow
Write-Host ""

# Service account name
$SERVICE_ACCOUNT_NAME = "zte-deployer"
$SERVICE_ACCOUNT_EMAIL = "$SERVICE_ACCOUNT_NAME@${PROJECT_ID}.iam.gserviceaccount.com"

# Step 1: Create service account
Write-Host "Step 1: Creating service account..." -ForegroundColor Green
try {
    gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID 2>$null | Out-Null
    Write-Host "Service account already exists. Skipping creation." -ForegroundColor Yellow
} catch {
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME `
        --display-name="ZTE GitHub Actions Deployer" `
        --project=$PROJECT_ID
    Write-Host "✓ Service account created" -ForegroundColor Green
}
Write-Host ""

# Step 2: Grant required permissions
Write-Host "Step 2: Granting required permissions..." -ForegroundColor Green

$ROLES = @(
    "roles/storage.admin",
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/artifactregistry.admin",
    "roles/pubsub.admin",
    "roles/bigquery.admin",
    "roles/secretmanager.admin",
    "roles/serviceusage.serviceUsageAdmin"
)

foreach ($ROLE in $ROLES) {
    Write-Host "  Granting $ROLE..."
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" `
        --role=$ROLE `
        --quiet 2>$null | Out-Null
}

Write-Host "✓ Permissions granted" -ForegroundColor Green
Write-Host ""

# Step 3: Create service account key
Write-Host "Step 3: Creating service account key..." -ForegroundColor Green

$KEY_FILE = "github-actions-key.json"
gcloud iam service-accounts keys create $KEY_FILE `
    --iam-account=$SERVICE_ACCOUNT_EMAIL `
    --project=$PROJECT_ID

Write-Host "✓ Service account key created: $KEY_FILE" -ForegroundColor Green
Write-Host ""

# Step 4: Display instructions
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Copy the service account key JSON:"
Write-Host "   Get-Content $KEY_FILE" -ForegroundColor Green
Write-Host ""
Write-Host "2. Go to your GitHub repository:"
Write-Host "   Settings → Secrets and variables → Actions"
Write-Host ""
Write-Host "3. Add the following secrets:"
Write-Host "   GCP_PROJECT_ID: $PROJECT_ID" -ForegroundColor Green
Write-Host "   GCP_SA_KEY: Contents of $KEY_FILE (entire JSON)" -ForegroundColor Green
Write-Host "   GEMINI_API_KEY: (Optional) Your Google AI Studio API key" -ForegroundColor Green
Write-Host ""
Write-Host "4. After adding secrets, delete the key file for security:"
Write-Host "   Remove-Item $KEY_FILE" -ForegroundColor Green
Write-Host ""
Write-Host "Note: The key file contains sensitive credentials. Keep it secure!" -ForegroundColor Yellow
Write-Host ""

