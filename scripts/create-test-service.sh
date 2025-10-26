#!/bin/bash
# Create a Cloud Run service with intentional security misconfigurations for testing

PROJECT_ID="gcr-hackathon"
REGION="us-central1"
SERVICE_NAME="test-vulnerable-service"

echo "Creating a vulnerable Cloud Run service for testing..."

# Deploy a simple hello-world service
gcloud run deploy $SERVICE_NAME \
  --project $PROJECT_ID \
  --region $REGION \
  --image gcr.io/cloudrun/hello \
  --allow-unauthenticated \
  --set-env-vars API_KEY=secret123456,PASSWORD=admin123,TOKEN=my_secret_token

echo ""
echo "Service deployed. Adding overly permissive IAM policy..."

# Add allUsers permission (vulnerable configuration)
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --region $REGION \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project $PROJECT_ID

echo ""
echo "✅ Vulnerable service created: $SERVICE_NAME"
echo ""
echo "Issues created:"
echo "  ❌ Unauthenticated access (allUsers invoker)"
echo "  ❌ Environment variables with secrets exposed"
echo ""
echo "Now you can scan this service in the UI!"
echo "Service URL: https://$SERVICE_NAME-459742478845.$REGION.run.app"

