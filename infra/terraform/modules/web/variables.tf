variable "service_name" {
  description = "Web service identifier"
  type        = string
}

variable "artifact" {
  description = "Docker image tag or static artifact path"
  type        = string
  default     = ""
}

variable "domain" {
  description = "Primary domain for the web app"
  type        = string
  default     = ""
}

variable "environment_variables" {
  description = "Environment variables for the web runtime"
  type        = map(string)
  default     = {}
}
