# secrets.tf - Secret Manager configuration
# Secret for Gemini API Key
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }

  depends_on = [
    google_project_service.required_apis
  ]
}

# Secret version - only create if gemini_api_key variable is provided
# This allows initial creation via Terraform, but subsequent updates should use:
# gcloud secrets versions add gemini-api-key --data-file=-
resource "google_secret_manager_secret_version" "gemini_api_key_initial" {
  count       = var.gemini_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
  depends_on  = [google_secret_manager_secret.gemini_api_key]
}

# IAM binding: Allow service account to access the secret
resource "google_secret_manager_secret_iam_member" "gemini_api_key_accessor" {
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.zte_service_account.email}"
  
  depends_on = [
    google_secret_manager_secret.gemini_api_key,
    google_service_account.zte_service_account
  ]
}

