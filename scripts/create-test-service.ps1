# Create a Cloud Run service with intentional security misconfigurations for testing

$PROJECT_ID = "gcr-hackathon"
$REGION = "us-central1"
$SERVICE_NAME = "test-vulnerable-service"

Write-Host "Creating a vulnerable Cloud Run service for testing..." -ForegroundColor Green

# Deploy a simple hello-world service
gcloud run deploy $SERVICE_NAME `
  --project $PROJECT_ID `
  --region $REGION `
  --image gcr.io/cloudrun/hello `
  --allow-unauthenticated `
  --set-env-vars API_KEY=secret123456,PASSWORD=admin123,TOKEN=my_secret_token

Write-Host ""
Write-Host "Service deployed. Adding overly permissive IAM policy..." -ForegroundColor Yellow

# Add allUsers permission (vulnerable configuration)
gcloud run services add-iam-policy-binding $SERVICE_NAME `
  --region $REGION `
  --member="allUsers" `
  --role="roles/run.invoker" `
  --project $PROJECT_ID

Write-Host ""
Write-Host "`u{2705} Vulnerable service created: $SERVICE_NAME" -ForegroundColor Green
Write-Host ""
Write-Host "Issues created:" -ForegroundColor Cyan
Write-Host "  ❌ Unauthenticated access (allUsers invoker)" -ForegroundColor Red
Write-Host "  ❌ Environment variables with secrets exposed" -ForegroundColor Red
Write-Host ""
Write-Host "Now you can scan this service in the UI!" -ForegroundColor Yellow
Write-Host "Service URL: https://$SERVICE_NAME-459742478845.$REGION.run.app"

