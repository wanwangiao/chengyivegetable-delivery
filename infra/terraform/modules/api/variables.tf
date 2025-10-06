variable "service_name" {
  description = "API service identifier"
  type        = string
}

variable "image" {
  description = "Container image tag (if applicable)"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Deployment environment (staging/production)"
  type        = string
  default     = "staging"
}

variable "environment_variables" {
  description = "Environment variables passed to the service"
  type        = map(string)
  default     = {}
}
