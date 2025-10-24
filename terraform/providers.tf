# providers.tf - Provider configuration
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Remote backend configuration
  backend "gcs" {
    bucket = "gcr-hackathon-terraform-state"
    prefix = "zero-trust-explainer"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
