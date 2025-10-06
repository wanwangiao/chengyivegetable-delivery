terraform {
  required_version = ">= 1.5.0"
}

resource "null_resource" "web_placeholder" {
  triggers = {
    service_name = var.service_name
    artifact     = var.artifact
    domain       = var.domain
  }
}
