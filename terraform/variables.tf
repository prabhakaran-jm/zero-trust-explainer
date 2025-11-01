# variables.tf - Input variables
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

variable "gemini_api_key" {
  description = "Gemini API key for AI Studio integration (optional if using Secret Manager - only needed for initial secret creation)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "demo_video_url" {
  description = "URL to demo video (optional - for QuickLinks)"
  type        = string
  default     = ""
}

variable "repo_url" {
  description = "URL to GitHub repository (optional - for QuickLinks)"
  type        = string
  default     = ""
}

variable "arch_url" {
  description = "URL to architecture diagram (optional - for QuickLinks)"
  type        = string
  default     = ""
}

variable "ai_studio_url" {
  description = "URL to AI Studio prompts (optional - for QuickLinks)"
  type        = string
  default     = ""
}
