terraform {
  required_version = ">= 1.5.0"
}

resource "null_resource" "database_placeholder" {
  triggers = {
    name       = var.name
    engine     = var.engine
    size       = var.instance_size
    enable_redis = tostring(var.enable_redis)
  }
}
