terraform {
  required_version = ">= 1.5"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "backend_image" {
  description = "Backend Docker image URL"
  type        = string
}

variable "frontend_image" {
  description = "Frontend Docker image URL"
  type        = string
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "pubsub.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
  ])
  
  service            = each.value
  disable_on_destroy = false
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "zte_repo" {
  location      = var.region
  repository_id = "zte-repo"
  description   = "Zero-Trust Explainer container images"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# Pub/Sub Topic for scan requests
resource "google_pubsub_topic" "scan_requests" {
  name = "zte-scan-requests"

  depends_on = [google_project_service.required_apis]
}

# BigQuery Dataset
resource "google_bigquery_dataset" "zte_dataset" {
  dataset_id    = "zero_trust_explainer"
  friendly_name = "Zero Trust Explainer"
  description   = "Dataset for Zero-Trust Explainer findings"
  location      = var.region

  depends_on = [google_project_service.required_apis]
}

# BigQuery Table for findings
resource "google_bigquery_table" "findings_table" {
  dataset_id = google_bigquery_dataset.zte_dataset.dataset_id
  table_id   = "findings"

  schema = jsonencode([
    {
      name = "id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "job_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "severity"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "resource_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "resource_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "issue_description"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "recommendation"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "blast_radius"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "affected_resources"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "risk_score"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "created_at"
      type = "TIMESTAMP"
      mode = "REQUIRED"
    }
  ])

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }
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

# Cloud Run Service - Backend API
resource "google_cloud_run_v2_service" "backend_api" {
  name     = "zte-backend-api"
  location = var.region

  template {
    service_account = google_service_account.zte_service_account.email

    containers {
      image = var.backend_image

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.scan_requests.name
      }

      env {
        name  = "BQ_DATASET"
        value = google_bigquery_dataset.zte_dataset.dataset_id
      }

      env {
        name  = "BQ_TABLE"
        value = google_bigquery_table.findings_table.table_id
      }

      env {
        name  = "REPORT_BUCKET"
        value = google_storage_bucket.reports_bucket.name
      }

      env {
        name  = "PROPOSE_JOB_NAME"
        value = "zte-propose-job"
      }

      env {
        name  = "REGION"
        value = var.region
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_apis,
    google_bigquery_table.findings_table,
    google_storage_bucket.reports_bucket,
    google_pubsub_topic.scan_requests
  ]
}

# IAM policy to allow public access to backend
resource "google_cloud_run_v2_service_iam_member" "backend_public_access" {
  name   = google_cloud_run_v2_service.backend_api.name
  location = google_cloud_run_v2_service.backend_api.location
  role   = "roles/run.invoker"
  member = "allUsers"
}

# Cloud Run Service - Frontend
resource "google_cloud_run_v2_service" "frontend" {
  name     = "zte-frontend"
  location = var.region

  template {
    containers {
      image = var.frontend_image

      env {
        name  = "VITE_API_URL"
        value = google_cloud_run_v2_service.backend_api.uri
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.backend_api
  ]
}

# IAM policy to allow public access to frontend
resource "google_cloud_run_v2_service_iam_member" "frontend_public_access" {
  name   = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role   = "roles/run.invoker"
  member = "allUsers"
}

# Cloud Run Job for propose functionality
resource "google_cloud_run_v2_job" "propose_job" {
  name     = "zte-propose-job"
  location = var.region

  template {
    template {
      service_account = google_service_account.zte_service_account.email

      containers {
        image = var.backend_image
        
        command = ["python"]
        args    = ["-c", "print('Propose job executed'); import time; time.sleep(5)"]

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "BQ_DATASET"
          value = google_bigquery_dataset.zte_dataset.dataset_id
        }

        env {
          name  = "BQ_TABLE"
          value = google_bigquery_table.findings_table.table_id
        }

        env {
          name  = "REPORT_BUCKET"
          value = google_storage_bucket.reports_bucket.name
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }

      max_retries = 3
      timeout     = "600s"
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_bigquery_table.findings_table,
    google_storage_bucket.reports_bucket
  ]
}

# Outputs
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
