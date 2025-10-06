terraform {
  required_version = ">= 1.5.0"
}

resource "null_resource" "api_placeholder" {
  triggers = {
    service_name = var.service_name
    image        = var.image
    environment  = var.environment
  }
}
