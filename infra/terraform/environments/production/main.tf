# Terraform production environment (placeholder)

# terraform {
#   backend "remote" {
#     organization = "chengyi"
#     workspaces {
#       name = "chengyi-production"
#     }
#   }
# }

# module "api" {
#   source = "../../modules/api"
#   service_name = "chengyi-api-prod"
#   environment_variables = {
#     DATABASE_URL = var.database_url
#     REDIS_URL    = var.redis_url
#   }
# }

# module "web" {
#   source = "../../modules/web"
#   service_name = "chengyi-web-prod"
#   api_base_url = module.api.base_url
#   domain       = "app.chengyi.tw"
# }

# module "database" {
#   source   = "../../modules/database"
#   name     = "chengyi-production"
#   replicas = 1
# }

# variable "database_url" {
#   type = string
# }

# variable "redis_url" {
#   type = string
# }
