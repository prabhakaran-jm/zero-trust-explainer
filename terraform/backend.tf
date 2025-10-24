# backend.tf - Remote state configuration
# This file configures the remote backend for storing Terraform state
# Uncomment and configure when ready to use remote state

# terraform {
#   backend "gcs" {
#     bucket = "gcr-hackathon-terraform-state"
#     prefix = "zero-trust-explainer"
#   }
# }

# To initialize remote state:
# 1. Create the GCS bucket: gsutil mb gs://gcr-hackathon-terraform-state
# 2. Uncomment the above terraform block
# 3. Run: terraform init -migrate-state
