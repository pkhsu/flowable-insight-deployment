# Flowable Insight - S3 備份功能

## 概述

定期將系統配置和 ClickHouse 資料備份到 S3。

## 快速設定

```bash
# 1. 設定 AWS 憑證
aws configure
# AWS Access Key ID: xxx
# AWS Secret Access Key: xxx
# Default region name: ap-northeast-1
# Default output format: json

# 2. 編輯 .env 新增 S3 設定
nano /opt/flowable-insight/.env
# 新增:
# S3_BUCKET=your-bucket-name
# S3_PREFIX=flowable-insight-backup

# 3. 安裝備份排程
sudo bash setup-backup-cron.sh
```

## 備份內容

| 類型 | 內容 | 檔案格式 |
|------|------|---------|
| **config** | `.env`, Cube schemas, transformations, BFF code | tar.gz |
| **data** | ClickHouse 所有表格 + Schema | tar.gz (Native 格式) |

## 常用命令

```bash
# 手動備份
flowable-backup config     # 只備份配置
flowable-backup data       # 只備份資料
flowable-backup full       # 完整備份

# 管理
flowable-backup list       # 查看 S3 備份清單
flowable-backup cleanup    # 清理超過 30 天的舊備份
flowable-backup restore data/clickhouse_xxx.tar.gz  # 還原
```

## 排程設定

使用 **systemd timer** (比 cron 更可靠):
- 每天凌晨 2:00 執行
- 如果機器關機錯過執行，開機後自動補執行

```bash
# 查看排程狀態
systemctl status flowable-backup.timer

# 查看下次執行時間
systemctl list-timers flowable-backup.timer

# 手動觸發 (測試)
systemctl start flowable-backup.service
journalctl -u flowable-backup.service -f  # 查看日誌
```

## 環境變數

```bash
# .env 中設定
S3_BUCKET=my-backup-bucket         # (必填) S3 Bucket 名稱
S3_PREFIX=flowable-insight-backup  # S3 路徑前綴
S3_ENDPOINT=                       # 自訂 S3 endpoint (MinIO 等)
BACKUP_RETENTION_DAYS=30           # 備份保留天數
```

## S3 路徑結構

```
s3://your-bucket/flowable-insight-backup/
├── config/
│   ├── config_20240101_020000.tar.gz
│   └── config_20240102_020000.tar.gz
└── data/
    ├── clickhouse_20240101_020000.tar.gz
    └── clickhouse_20240102_020000.tar.gz
```

## 還原流程

```bash
# 1. 下載備份
flowable-backup restore data/clickhouse_20240101_020000.tar.gz

# 2. 備份會解壓到 /tmp/flowable-backup/

# 3. 還原 ClickHouse 資料
# 先停止服務
flowable-ctl stop

# 逐表還原 (範例)
cat /tmp/flowable-backup/clickhouse_xxx/schema.sql | \
  curl "http://localhost:8123/" --data-binary @-

# 匯入資料
zcat /tmp/flowable-backup/clickhouse_xxx/tablename.native.gz | \
  curl "http://localhost:8123/?query=INSERT%20INTO%20tablename%20FORMAT%20Native" \
  --data-binary @-

# 重啟服務
flowable-ctl start
```
