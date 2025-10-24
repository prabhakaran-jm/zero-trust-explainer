# data.tf - Data resources
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

# Pub/Sub Topic for scan requests
resource "google_pubsub_topic" "scan_requests" {
  name = "zte-scan-requests"

  depends_on = [google_project_service.required_apis]
}
