# iam.tf - IAM and service accounts
# Service Account for Cloud Run services
resource "google_service_account" "zte_service_account" {
  account_id   = "zte-service-account"
  display_name = "Zero-Trust Explainer Service Account"
}

# IAM permissions for service account
resource "google_project_iam_member" "zte_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

resource "google_project_iam_member" "zte_bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.user"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

resource "google_project_iam_member" "zte_bigquery_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

resource "google_project_iam_member" "zte_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

resource "google_project_iam_member" "zte_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

resource "google_project_iam_member" "zte_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

resource "google_project_iam_member" "zte_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.zte_service_account.email}"
}

# Allow service account to sign URLs (for GCS signed URLs)
resource "google_service_account_iam_member" "zte_token_creator" {
  service_account_id = google_service_account.zte_service_account.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.zte_service_account.email}"
}
