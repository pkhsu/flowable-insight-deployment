#!/bin/bash
# ============================================
# Flowable Insight - S3 備份腳本
# ============================================
# 功能: 備份系統設定和 ClickHouse 資料到 S3
# 用法: ./backup-to-s3.sh [config|data|full]
# 排程: 建議使用 systemd timer 或 cron
# ============================================

set -euo pipefail

# ============ 配置區 ============
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 部署根目錄 = backup/ 的上一層 (例如 /opt/flowable-insight)
DEPLOY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 載入環境變數
if [ -f "${DEPLOY_ROOT}/.env" ]; then
    set -a
    source "${DEPLOY_ROOT}/.env"
    set +a
fi

# S3 配置 (可透過 .env 或環境變數覆蓋)
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-flowable-insight-backup}"
S3_ENDPOINT="${S3_ENDPOINT:-}"  # 留空使用 AWS S3，或設定自訂 endpoint

# ClickHouse 配置
CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
CLICKHOUSE_DB="${CLICKHOUSE_DB:-flowable_analytics}"
CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"

# 本地暫存目錄
BACKUP_TMP_DIR="/tmp/flowable-backup"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]${NC} $1"; }
log_error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"; }

# ============ 前置檢查 ============
check_prerequisites() {
    # 檢查 AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI 未安裝"
        log_info "安裝方式: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
        exit 1
    fi
    
    # 檢查 S3 配置
    if [ -z "$S3_BUCKET" ]; then
        log_error "S3_BUCKET 未設定，請在 .env 中設定"
        exit 1
    fi
    
    # 測試 S3 連線
    local s3_args=""
    if [ -n "$S3_ENDPOINT" ]; then
        s3_args="--endpoint-url $S3_ENDPOINT"
    fi
    
    if ! aws s3 ls "s3://${S3_BUCKET}" $s3_args &>/dev/null; then
        log_error "無法連線到 S3 bucket: ${S3_BUCKET}"
        log_info "請確認 AWS credentials 已設定 (aws configure)"
        exit 1
    fi
    
    # 建立暫存目錄
    mkdir -p "$BACKUP_TMP_DIR"
}

# ============ 配置備份 ============
backup_config() {
    log_info "開始備份系統配置..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="config_${timestamp}"
    local backup_file="${BACKUP_TMP_DIR}/${backup_name}.tar.gz"
    
    # 要備份的配置
    local config_items=(
        "${DEPLOY_ROOT}/.env"
        "${DEPLOY_ROOT}/config/cube"
        "${DEPLOY_ROOT}/docker-compose.yml"
    )
    
    # 建立暫存目錄
    local staging_dir="${BACKUP_TMP_DIR}/${backup_name}"
    mkdir -p "$staging_dir"
    
    # 複製配置檔案
    for item in "${config_items[@]}"; do
        if [ -e "$item" ]; then
            cp -r "$item" "$staging_dir/" 2>/dev/null || true
        fi
    done
    
    # 打包
    tar -czf "$backup_file" -C "$BACKUP_TMP_DIR" "$backup_name"
    rm -rf "$staging_dir"
    
    # 上傳到 S3
    upload_to_s3 "$backup_file" "config/${backup_name}.tar.gz"
    
    # 清理本地暫存
    rm -f "$backup_file"
    
    log_success "配置備份完成: config/${backup_name}.tar.gz"
}

# ============ ClickHouse 資料備份 ============
backup_clickhouse_data() {
    log_info "開始備份 ClickHouse 資料..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="clickhouse_${timestamp}"
    local backup_dir="${BACKUP_TMP_DIR}/${backup_name}"
    
    mkdir -p "$backup_dir"
    
    # 取得所有表格清單
    local tables=$(curl -s "http://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}/?user=${CLICKHOUSE_USER}&password=${CLICKHOUSE_PASSWORD}" \
        --data-binary "SELECT name FROM system.tables WHERE database = '${CLICKHOUSE_DB}' AND engine NOT LIKE '%View%' FORMAT TabSeparated")
    
    if [ -z "$tables" ]; then
        log_warn "沒有找到需要備份的表格"
        return
    fi
    
    # 備份每個表格 (使用 Native 格式)
    for table in $tables; do
        log_info "  備份表格: ${table}..."
        
        local table_file="${backup_dir}/${table}.native.gz"
        
        curl -s "http://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}/?user=${CLICKHOUSE_USER}&password=${CLICKHOUSE_PASSWORD}" \
            --data-binary "SELECT * FROM ${CLICKHOUSE_DB}.${table} FORMAT Native" \
            | gzip > "$table_file"
        
        local size=$(du -h "$table_file" | cut -f1)
        log_info "    ${table}: ${size}"
    done
    
    # 導出 Schema
    log_info "  導出 Schema..."
    for table in $tables; do
        curl -s "http://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}/?user=${CLICKHOUSE_USER}&password=${CLICKHOUSE_PASSWORD}" \
            --data-binary "SHOW CREATE TABLE ${CLICKHOUSE_DB}.${table}" \
            >> "${backup_dir}/schema.sql"
        echo ";" >> "${backup_dir}/schema.sql"
        echo "" >> "${backup_dir}/schema.sql"
    done
    
    # 打包
    local backup_file="${BACKUP_TMP_DIR}/${backup_name}.tar.gz"
    tar -czf "$backup_file" -C "$BACKUP_TMP_DIR" "$backup_name"
    rm -rf "$backup_dir"
    
    # 上傳到 S3
    upload_to_s3 "$backup_file" "data/${backup_name}.tar.gz"
    
    # 清理本地暫存
    rm -f "$backup_file"
    
    log_success "ClickHouse 資料備份完成: data/${backup_name}.tar.gz"
}

# ============ 上傳到 S3 ============
upload_to_s3() {
    local local_file="$1"
    local s3_key="$2"
    
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/${s3_key}"
    local s3_args=""
    
    if [ -n "$S3_ENDPOINT" ]; then
        s3_args="--endpoint-url $S3_ENDPOINT"
    fi
    
    log_info "上傳到 S3: ${s3_path}"
    aws s3 cp "$local_file" "$s3_path" $s3_args --quiet
}

# ============ 清理舊備份 ============
cleanup_old_backups() {
    log_info "清理超過 ${RETENTION_DAYS} 天的舊備份..."
    
    local s3_args=""
    if [ -n "$S3_ENDPOINT" ]; then
        s3_args="--endpoint-url $S3_ENDPOINT"
    fi
    
    local cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)
    
    # 列出並刪除舊檔案
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" $s3_args --recursive | while read -r line; do
        local file_date=$(echo "$line" | awk '{print $1}' | tr -d '-')
        local file_key=$(echo "$line" | awk '{print $4}')
        
        if [ -n "$file_key" ] && [ "$file_date" -lt "$cutoff_date" ] 2>/dev/null; then
            log_info "  刪除: ${file_key}"
            aws s3 rm "s3://${S3_BUCKET}/${file_key}" $s3_args --quiet
        fi
    done
    
    log_success "清理完成"
}

# ============ 列出備份 ============
list_backups() {
    log_info "S3 備份清單 (${S3_BUCKET}/${S3_PREFIX}):"
    echo ""
    
    local s3_args=""
    if [ -n "$S3_ENDPOINT" ]; then
        s3_args="--endpoint-url $S3_ENDPOINT"
    fi
    
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" $s3_args --recursive --human-readable
}

# ============ 還原備份 ============
restore_backup() {
    local backup_key="$1"
    
    if [ -z "$backup_key" ]; then
        log_error "請指定要還原的備份檔案"
        echo "  用法: $0 restore <s3-key>"
        echo "  範例: $0 restore data/clickhouse_20240101_120000.tar.gz"
        exit 1
    fi
    
    log_warn "⚠️  還原作業將覆蓋現有資料！"
    read -p "確定要繼續嗎? [y/N] " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "已取消"
        exit 0
    fi
    
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/${backup_key}"
    local local_file="${BACKUP_TMP_DIR}/$(basename $backup_key)"
    
    local s3_args=""
    if [ -n "$S3_ENDPOINT" ]; then
        s3_args="--endpoint-url $S3_ENDPOINT"
    fi
    
    log_info "下載備份: ${s3_path}"
    aws s3 cp "$s3_path" "$local_file" $s3_args
    
    log_info "解壓縮..."
    tar -xzf "$local_file" -C "$BACKUP_TMP_DIR"
    
    log_success "備份已下載並解壓到: ${BACKUP_TMP_DIR}"
    log_info "請手動執行還原操作"
}

# ============ 使用說明 ============
show_usage() {
    echo ""
    echo "Flowable Insight - S3 備份管理"
    echo ""
    echo "用法: $0 <command>"
    echo ""
    echo "命令:"
    echo "  config     備份系統配置 (.env, schemas, transformations)"
    echo "  data       備份 ClickHouse 資料"
    echo "  full       完整備份 (config + data)"
    echo "  list       列出 S3 上的備份"
    echo "  cleanup    清理舊備份 (超過 ${RETENTION_DAYS} 天)"
    echo "  restore    還原備份"
    echo ""
    echo "環境變數 (在 .env 中設定):"
    echo "  S3_BUCKET              S3 Bucket 名稱 (必填)"
    echo "  S3_PREFIX              S3 路徑前綴 (預設: flowable-insight-backup)"
    echo "  S3_ENDPOINT            自訂 S3 endpoint (可選)"
    echo "  BACKUP_RETENTION_DAYS  備份保留天數 (預設: 30)"
    echo ""
    echo "範例:"
    echo "  $0 full                     # 完整備份"
    echo "  $0 list                     # 查看備份"
    echo "  $0 restore data/xxx.tar.gz  # 還原指定備份"
    echo ""
}

# ============ 主程式 ============
main() {
    local command="${1:-}"
    
    case "$command" in
        config)
            check_prerequisites
            backup_config
            ;;
        data)
            check_prerequisites
            backup_clickhouse_data
            ;;
        full)
            check_prerequisites
            log_info "========== 開始完整備份 =========="
            backup_config
            backup_clickhouse_data
            log_success "========== 完整備份完成 =========="
            ;;
        list)
            check_prerequisites
            list_backups
            ;;
        cleanup)
            check_prerequisites
            cleanup_old_backups
            ;;
        restore)
            check_prerequisites
            restore_backup "${2:-}"
            ;;
        -h|--help|help|"")
            show_usage
            ;;
        *)
            log_error "未知命令: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
