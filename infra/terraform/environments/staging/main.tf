# Terraform staging environment (placeholder)

# terraform {
#   backend "remote" {
#     organization = "chengyi"
#     workspaces {
#       name = "chengyi-staging"
#     }
#   }
# }

# module "api" {
#   source = "../../modules/api"
#   service_name = "chengyi-api-staging"
#   environment_variables = {
#     DATABASE_URL = var.database_url
#   }
# }

# module "web" {
#   source = "../../modules/web"
#   service_name = "chengyi-web-staging"
#   api_base_url = module.api.base_url
# }

# module "database" {
#   source = "../../modules/database"
#   name   = "chengyi-staging"
# }

# variable "database_url" {
#   type = string
# }
