#!/bin/bash
# Setup script for GitHub Actions CI/CD
# This script creates the service account and sets up permissions for GitHub Actions

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== GitHub Actions CI/CD Setup ===${NC}\n"

# Check if GCP_PROJECT_ID is set
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable is not set${NC}"
    echo "Please set it with: export GCP_PROJECT_ID=\"your-project-id\""
    exit 1
fi

echo -e "Project ID: ${YELLOW}${GCP_PROJECT_ID}${NC}\n"

# Service account name
SERVICE_ACCOUNT_NAME="zte-deployer"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# Step 1: Create service account
echo -e "${GREEN}Step 1: Creating service account...${NC}"
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} --project=${GCP_PROJECT_ID} &>/dev/null; then
    echo -e "${YELLOW}Service account already exists. Skipping creation.${NC}"
else
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --display-name="ZTE GitHub Actions Deployer" \
        --project=${GCP_PROJECT_ID}
    echo -e "${GREEN}✓ Service account created${NC}"
fi
echo ""

# Step 2: Grant required permissions
echo -e "${GREEN}Step 2: Granting required permissions...${NC}"

ROLES=(
    "roles/storage.admin"
    "roles/run.admin"
    "roles/iam.serviceAccountUser"
    "roles/artifactregistry.admin"
    "roles/pubsub.admin"
    "roles/bigquery.admin"
    "roles/secretmanager.admin"
    "roles/serviceusage.serviceUsageAdmin"
)

for ROLE in "${ROLES[@]}"; do
    echo -e "  Granting ${ROLE}..."
    gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="${ROLE}" \
        --quiet > /dev/null 2>&1 || true
done

echo -e "${GREEN}✓ Permissions granted${NC}\n"

# Step 3: Create service account key
echo -e "${GREEN}Step 3: Creating service account key...${NC}"

KEY_FILE="github-actions-key.json"
gcloud iam service-accounts keys create ${KEY_FILE} \
    --iam-account=${SERVICE_ACCOUNT_EMAIL} \
    --project=${GCP_PROJECT_ID}

echo -e "${GREEN}✓ Service account key created: ${KEY_FILE}${NC}\n"

# Step 4: Display instructions
echo -e "${GREEN}=== Setup Complete! ===${NC}\n"
echo -e "${YELLOW}Next Steps:${NC}\n"
echo "1. Copy the service account key JSON:"
echo -e "   ${GREEN}cat ${KEY_FILE}${NC}\n"
echo "2. Go to your GitHub repository:"
echo "   Settings → Secrets and variables → Actions"
echo ""
echo "3. Add the following secrets:"
echo -e "   ${GREEN}GCP_PROJECT_ID${NC}: ${GCP_PROJECT_ID}"
echo -e "   ${GREEN}GCP_SA_KEY${NC}: Contents of ${KEY_FILE} (entire JSON)"
echo -e "   ${GREEN}GEMINI_API_KEY${NC}: (Optional) Your Google AI Studio API key"
echo ""
echo "4. After adding secrets, delete the key file for security:"
echo -e "   ${GREEN}rm ${KEY_FILE}${NC}\n"
echo -e "${YELLOW}Note: The key file contains sensitive credentials. Keep it secure!${NC}\n"

