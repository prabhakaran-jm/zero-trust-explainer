# storage.tf - Storage resources
# Artifact Registry Repository
resource "google_artifact_registry_repository" "zte_repo" {
  location      = var.region
  repository_id = "zte-repo"
  description   = "Zero-Trust Explainer container images"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# GCS Bucket for reports
resource "google_storage_bucket" "reports_bucket" {
  name          = "${var.project_id}-zte-reports"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required_apis]
}
