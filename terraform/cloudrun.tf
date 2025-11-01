# cloudrun.tf - Cloud Run services and jobs
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

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "SERVICE_ACCOUNT_EMAIL"
        value = google_service_account.zte_service_account.email
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
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
    google_pubsub_topic.scan_requests,
    google_secret_manager_secret_iam_member.gemini_api_key_accessor
  ]
}

# IAM policy to allow public access to backend
resource "google_cloud_run_v2_service_iam_member" "backend_public_access" {
  name     = google_cloud_run_v2_service.backend_api.name
  location = google_cloud_run_v2_service.backend_api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
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

      # Optional: Quick Links URLs (for runtime config injection)
      dynamic "env" {
        for_each = var.demo_video_url != "" ? [1] : []
        content {
          name  = "VITE_DEMO_VIDEO_URL"
          value = var.demo_video_url
        }
      }

      dynamic "env" {
        for_each = var.repo_url != "" ? [1] : []
        content {
          name  = "VITE_REPO_URL"
          value = var.repo_url
        }
      }

      dynamic "env" {
        for_each = var.arch_url != "" ? [1] : []
        content {
          name  = "VITE_ARCH_URL"
          value = var.arch_url
        }
      }

      dynamic "env" {
        for_each = var.ai_studio_url != "" ? [1] : []
        content {
          name  = "VITE_AI_STUDIO_URL"
          value = var.ai_studio_url
        }
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
  name     = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Run Job for scan processing
resource "google_cloud_run_v2_job" "scan_processor" {
  name     = "zte-scan-processor"
  location = var.region

  template {
    template {
      service_account = google_service_account.zte_service_account.email

      containers {
        image = var.backend_image

        command = ["python"]
        args    = ["scan_processor.py"]

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "PUBSUB_SUBSCRIPTION"
          value = google_pubsub_subscription.scan_requests_sub.name
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

      max_retries = 3
      timeout     = "600s"
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_bigquery_table.findings_table,
    google_pubsub_subscription.scan_requests_sub
  ]
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
        args    = ["propose_job.py"]

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

        env {
          name = "GEMINI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.gemini_api_key.secret_id
              version = "latest"
            }
          }
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
    google_storage_bucket.reports_bucket,
    google_secret_manager_secret_iam_member.gemini_api_key_accessor
  ]
}
