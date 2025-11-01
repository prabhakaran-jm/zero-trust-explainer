# outputs.tf - Output values
output "backend_url" {
  value       = google_cloud_run_v2_service.backend_api.uri
  description = "URL of the backend API service"
}

output "frontend_url" {
  value       = google_cloud_run_v2_service.frontend.uri
  description = "URL of the frontend service"
}

output "artifact_registry_repo" {
  value       = google_artifact_registry_repository.zte_repo.name
  description = "Artifact Registry repository name"
}

output "pubsub_topic" {
  value       = google_pubsub_topic.scan_requests.name
  description = "Pub/Sub topic name"
}

output "bigquery_dataset" {
  value       = google_bigquery_dataset.zte_dataset.dataset_id
  description = "BigQuery dataset ID"
}

output "reports_bucket" {
  value       = google_storage_bucket.reports_bucket.name
  description = "GCS bucket name for reports"
}

output "service_account_email" {
  value       = google_service_account.zte_service_account.email
  description = "Service account email"
  sensitive   = true
}

output "gemini_api_key_secret_name" {
  value       = google_secret_manager_secret.gemini_api_key.secret_id
  description = "Secret Manager secret name for Gemini API key"
}