# Flowable Insight - Deployment Repository

統一管理 Flowable Insight 全平台服務的部署配置，適用於工廠 Server Farm 的 Ubuntu VM 單機部署。

## 架構概覽

本 Repo **不包含任何程式碼**，只負責「如何把所有服務組裝起來」。

所有 Docker Images 由各自的開發 Repo 透過 GitLab CI 編譯並推送到公司內部的 Harbor：

| 來源 Repo | 產出的 Image | 說明 |
|-----------|-------------|------|
| `flowable-insight-etl` | `flowable-clickhouse-odbc` | ClickHouse + MSSQL ODBC 驅動 |
| `flowable-insight-etl` | `flowable-bff` | Node.js BFF API Gateway |
| `flowable-frontend` | `flowable-frontend` | React.js 前端 |
| `flowable-backend` | `flowable-backend` | Java 後端 (LDAP 整合) |

## 目錄結構

```text
flowable-insight-deployment/
├── .gitlab-ci.yml           # CI: 打包 Release Artifact (tar.gz)
├── .env.example             # 環境變數範本 (SI 複製為 .env 後填寫)
├── docker-compose.yml       # Umbrella Compose (所有服務)
├── flowable-ctl.sh          # 服務管理腳本
├── config/
│   └── cube/                # Cube.js Schema (從 ETL Repo 同步)
├── backup/                  # S3 自動備份工具
│   ├── backup-to-s3.sh
│   └── setup-backup-cron.sh
└── docs/
    └── SI_部署手冊.md        # 廠端 SI 工程師的完整教學
```

## 快速使用

> 詳細教學請參考 `docs/SI_部署手冊.md`

```bash
# 1. 解壓發布包
tar -xzvf flowable-insight-deploy.tar.gz
cd flowable-insight

# 2. 登入 Harbor
docker login harbor.company.local

# 3. 編輯設定 (填寫 ✏️ 標記的欄位)
cp .env.example .env
nano .env

# 4. 一鍵啟動
chmod +x flowable-ctl.sh
./flowable-ctl.sh start
```
