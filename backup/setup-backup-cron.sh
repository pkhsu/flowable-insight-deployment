#!/bin/bash
# ============================================
# Flowable Insight - 備份排程安裝腳本
# ============================================
# 功能: 設定 systemd timer 定期執行 S3 備份
# 用法: sudo bash setup-backup-cron.sh
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 檢查 root
if [ "$EUID" -ne 0 ]; then
    log_error "請使用 sudo 執行此腳本"
    exit 1
fi

echo ""
echo "=========================================="
echo "  Flowable Insight - 備份排程設定"
echo "=========================================="
echo ""

# 1. 安裝 AWS CLI
log_info "檢查 AWS CLI..."
if ! command -v aws &> /dev/null; then
    log_info "安裝 AWS CLI..."
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws
    log_success "AWS CLI 已安裝"
else
    log_success "AWS CLI 已安裝: $(aws --version | head -1)"
fi

# 2. 設定執行權限
log_info "設定腳本權限..."
chmod +x "${SCRIPT_DIR}/backup-to-s3.sh"

# 3. 建立符號連結
ln -sf "${SCRIPT_DIR}/backup-to-s3.sh" /usr/local/bin/flowable-backup

# 4. 安裝 systemd 服務
log_info "安裝 systemd 服務..."
cp "${SCRIPT_DIR}/flowable-backup.service" /etc/systemd/system/
cp "${SCRIPT_DIR}/flowable-backup.timer" /etc/systemd/system/

# 更新服務檔案中的路徑
sed -i "s|/opt/flowable-insight|$(dirname $(dirname $(dirname $SCRIPT_DIR)))|g" /etc/systemd/system/flowable-backup.service

# 5. 重載 systemd
systemctl daemon-reload

# 6. 啟用並啟動 timer
log_info "啟用備份排程..."
systemctl enable flowable-backup.timer
systemctl start flowable-backup.timer

echo ""
log_success "備份排程設定完成!"
echo ""
echo "=========================================="
echo ""
echo "📋 後續步驟:"
echo ""
echo "  1. 設定 AWS 憑證:"
echo "     aws configure"
echo ""
echo "  2. 編輯 .env 新增 S3 設定:"
echo "     S3_BUCKET=your-bucket-name"
echo "     S3_PREFIX=flowable-insight-backup"
echo ""
echo "  3. 測試備份:"
echo "     flowable-backup full"
echo ""
echo "  4. 查看排程狀態:"
echo "     systemctl status flowable-backup.timer"
echo ""
echo "=========================================="
echo ""
echo "📅 備份排程: 每天凌晨 2:00"
echo ""
echo "🔧 常用命令:"
echo "  flowable-backup full      # 手動執行完整備份"
echo "  flowable-backup list      # 查看備份清單"
echo "  flowable-backup cleanup   # 清理舊備份"
echo ""
