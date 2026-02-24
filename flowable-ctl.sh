#!/bin/bash
# ============================================
# Flowable Insight - 服務管理腳本 v2.1
# ============================================
# 適用: Release Artifact 解壓後的扁平目錄
# 路徑: /opt/flowable-insight/flowable-ctl.sh
# ============================================

set -euo pipefail

# ---- 路徑設定 ----
# 腳本所在目錄即為部署根目錄 (例如 /opt/flowable-insight)
DEPLOY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${DEPLOY_ROOT}/docker-compose.yml"
ENV_FILE="${DEPLOY_ROOT}/.env"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日誌函數
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 顯示 Banner
show_banner() {
    echo ""
    echo "============================================"
    echo "  Flowable Insight - Single Node Deployment"
    echo "  服務管理腳本 v2.1"
    echo "============================================"
    echo ""
}

check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安裝"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安裝"
        exit 1
    fi

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "找不到 docker-compose.yml: $COMPOSE_FILE"
        exit 1
    fi

    # 自動建立 .env (如果不存在)
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${DEPLOY_ROOT}/.env.example" ]; then
            log_warn ".env 不存在，從 .env.example 複製..."
            cp "${DEPLOY_ROOT}/.env.example" "$ENV_FILE"
            log_warn ""
            log_warn "=========================================================="
            log_warn "  ⚠️  請先編輯 ${ENV_FILE}"
            log_warn "  必填項目 (標記為 ✏️ 的欄位):"
            log_warn "    - HARBOR_HOST / HARBOR_PROJECT (映像檔來源)"
            log_warn "    - SOURCE_MSSQL_HOST / USER / PASSWORD (ERP 資料庫)"
            log_warn "    - CLICKHOUSE_PASSWORD (ClickHouse 密碼)"
            log_warn "    - CUBEJS_API_SECRET (API 金鑰，可用 openssl rand -hex 32 產生)"
            log_warn "=========================================================="
            log_warn ""
            exit 1
        else
            log_error ".env 和 .env.example 都不存在"
            exit 1
        fi
    fi

    # 自動建立資料目錄
    mkdir -p "${DEPLOY_ROOT}/data/clickhouse"
    mkdir -p "${DEPLOY_ROOT}/data/cubestore"
}

# Docker Compose 通用指令 (相容 V1 和 V2)
dc() {
    cd "${DEPLOY_ROOT}"
    if docker compose version &> /dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
    else
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
    fi
}

# 啟動服務
cmd_start() {
    log_info "拉取最新的 Docker Images..."

    # 嘗試預先 pull image
    if ! dc pull; then
         log_warn "映像檔拉取失敗。請確認："
         log_warn "  1. 已執行過 docker login <HARBOR_HOST>"
         log_warn "  2. .env 檔案內的 HARBOR_HOST / HARBOR_PROJECT 是否正確"
         log_warn ""
         read -p "是否仍然使用本地現有的映像檔嘗試啟動？ [y/N] " -n 1 -r
         echo
         if [[ ! $REPLY =~ ^[Yy]$ ]]; then
             log_info "操作已取消"
             exit 1
         fi
    else
         log_success "映像檔拉取完成！"
    fi

    log_info "啟動 Flowable Insight 服務..."
    dc up -d

    log_info "等待服務啟動..."
    sleep 10

    cmd_health
}

# 停止服務
cmd_stop() {
    log_info "停止 Flowable Insight 服務..."
    dc stop
    log_success "服務已停止"
}

# 重啟服務
cmd_restart() {
    log_info "重啟 Flowable Insight 服務..."
    cmd_stop
    sleep 2
    cmd_start
}

# 完全停止並移除容器
cmd_down() {
    log_warn "即將停止並移除所有容器 (資料會保留在 data/ 目錄中)"
    read -p "確定要繼續嗎? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        dc down
        log_success "容器已移除"
    else
        log_info "操作已取消"
    fi
}

# 顯示服務狀態
cmd_status() {
    log_info "服務狀態:"
    echo ""
    dc ps
    echo ""
}

# 健康檢查
cmd_health() {
    log_info "執行健康檢查..."
    echo ""

    local all_healthy=true

    # ClickHouse
    echo -n "  ClickHouse (8123): "
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8123/ping" 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✅ 健康${NC}"
    else
        echo -e "${RED}❌ 無法連線${NC}"
        all_healthy=false
    fi

    # CubeStore
    echo -n "  CubeStore  (3030): "
    if docker exec flowable_cubestore echo "ok" &>/dev/null; then
        echo -e "${GREEN}✅ 運行中${NC}"
    else
        echo -e "${RED}❌ 無法連線${NC}"
        all_healthy=false
    fi

    # Cube.js
    echo -n "  Cube.js    (4000): "
    if curl -s -o /dev/null "http://localhost:4000/readyz" 2>/dev/null; then
        echo -e "${GREEN}✅ 健康${NC}"
    else
        echo -e "${RED}❌ 無法連線${NC}"
        all_healthy=false
    fi

    # BFF
    echo -n "  BFF API    (8050): "
    if curl -s -o /dev/null "http://localhost:8050/health" 2>/dev/null; then
        echo -e "${GREEN}✅ 健康${NC}"
    else
        echo -e "${RED}❌ 無法連線${NC}"
        all_healthy=false
    fi

    echo ""

    if $all_healthy; then
        log_success "所有服務正常運行"
        return 0
    else
        log_error "部分服務異常，請執行 '$0 logs' 檢查日誌"
        return 1
    fi
}

# 查看日誌
cmd_logs() {
    local service="${1:-}"
    local lines="${2:-100}"

    if [ -z "$service" ]; then
        log_info "顯示所有服務日誌 (最後 $lines 行)..."
        dc logs --tail="$lines" -f
    else
        log_info "顯示 $service 服務日誌 (最後 $lines 行)..."
        dc logs --tail="$lines" -f "$service"
    fi
}

# 顯示使用說明
show_usage() {
    show_banner
    echo "用法: $0 <command> [options]"
    echo ""
    echo "服務管理命令:"
    echo "  start           從 Harbor 拉取最新映像檔並啟動服務"
    echo "  stop            停止所有服務"
    echo "  restart         重啟所有服務"
    echo "  down            停止並移除容器 (保留 data/ 資料)"
    echo "  status          顯示容器狀態"
    echo "  health          執行健康檢查"
    echo ""
    echo "日誌命令:"
    echo "  logs [service]  查看服務日誌"
    echo "                  可用: clickhouse-server, cube, bff-service, cubestore"
    echo ""
    echo "範例:"
    echo "  $0 start                    # 啟動服務"
    echo "  $0 logs bff-service         # 查看 BFF 日誌"
    echo "  $0 health                   # 健康檢查"
    echo ""
}

# 主程式
main() {
    local command="${1:-}"

    case "$command" in
        start)
            show_banner
            check_prerequisites
            cmd_start
            ;;
        stop)
            show_banner
            check_prerequisites
            cmd_stop
            ;;
        restart)
            show_banner
            check_prerequisites
            cmd_restart
            ;;
        down)
            show_banner
            check_prerequisites
            cmd_down
            ;;
        status)
            show_banner
            check_prerequisites
            cmd_status
            ;;
        health)
            show_banner
            check_prerequisites
            cmd_health
            ;;
        logs)
            check_prerequisites
            cmd_logs "${2:-}" "${3:-100}"
            ;;
        -h|--help|help|"")
            show_usage
            ;;
        *)
            log_error "未知命令: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
