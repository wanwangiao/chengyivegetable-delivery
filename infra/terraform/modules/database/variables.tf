variable "name" {
  description = "Database cluster name"
  type        = string
}

variable "engine" {
  description = "Database engine (e.g. postgres, mysql)"
  type        = string
  default     = "postgres"
}

variable "instance_size" {
  description = "Database instance size / plan"
  type        = string
  default     = "small"
}

variable "enable_redis" {
  description = "Whether to provision Redis"
  type        = bool
  default     = false
}
