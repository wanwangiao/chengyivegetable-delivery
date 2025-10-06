# Terraform 指南

```
infra/terraform/
├── modules/
│   ├── api/          # API 服務（Railway/Fly.io/K8s）
│   ├── web/          # Web 應用部署設定
│   └── database/     # PostgreSQL / Redis / 其他託管資源
└── environments/
    ├── staging/      # 測試環境配置
    └── production/   # 正式環境配置
```

## 建議流程
1. 在 `modules/` 下撰寫共用模組（例如 Railway service、AWS ECS、Kubernetes Deployment 等）。
2. 在 `environments/staging` 與 `production` 內撰寫 `main.tf` 引用模組並提供對應變數。
3. 於 GitHub Actions 中加入 `terraform fmt`、`terraform validate`、`terraform plan`、`terraform apply` 步驟。
4. 建議使用 Terraform Cloud 或鎖定 Backend（S3 + Dynamo / GCS / Azure Storage）以確保狀態檔安全。

## TODO
- 完成 modules 下 API / Web / Database 的實際資源定義。
- 決定 Backend （例：Terraform Cloud）與 workspace 策略。
- 將機密資料以 TF_VAR 或 Secrets 管理。
