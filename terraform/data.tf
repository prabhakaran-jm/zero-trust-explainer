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
  dataset_id          = google_bigquery_dataset.zte_dataset.dataset_id
  table_id            = "findings"
  deletion_protection = false

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

  # Prevent unnecessary replacements due to schema format differences
  lifecycle {
    ignore_changes = [
      # Ignore changes to schema format (mode attributes) that don't affect actual structure
      schema
    ]
  }
}

# Pub/Sub Topic for scan requests
resource "google_pubsub_topic" "scan_requests" {
  name = "zte-scan-requests"

  depends_on = [google_project_service.required_apis]
}

# Pub/Sub Subscription for scan processor
resource "google_pubsub_subscription" "scan_requests_sub" {
  name  = "zte-scan-requests-sub"
  topic = google_pubsub_topic.scan_requests.name

  ack_deadline_seconds = 60

  expiration_policy {
    ttl = "604800s"  # 7 days to match message retention
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  depends_on = [google_pubsub_topic.scan_requests]
}
