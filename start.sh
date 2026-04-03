#!/bin/bash
# Drop 启动脚本
# 用于 Cloudflare Tunnel 部署

# 设置环境变量绕过代理（确保直连 Cloudflare）
export NO_PROXY=cloudflare.com,cfargotunnel.com,cloudflareresolve.com,localhost,127.0.0.1
export no_proxy=$NO_PROXY
export HTTP_PROXY=
export HTTPS_PROXY=
export http_proxy=
export https_proxy=

# 项目目录
PROJECT_DIR="/Users/jhonsteve/Downloads/openclaw-drop"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$PROJECT_DIR/.server.pid"

# 日志文件
SERVER_LOG="$LOG_DIR/server.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 启动 Drop 服务
start_server() {
    echo "正在启动 Drop 服务..."
    cd "$PROJECT_DIR"
    
    # 设置生产环境
    export NODE_ENV=production
    export PORT=3001
    
    # 启动服务（后台运行）
    nohup npx tsx server.ts > "$SERVER_LOG" 2>&1 &
    echo $! > "$PID_FILE"
    
    echo "Drop 服务已启动 (PID: $(cat $PID_FILE))"
    echo "日志文件: $SERVER_LOG"
}

# 启动 Cloudflare Tunnel
start_tunnel() {
    echo "正在启动 Cloudflare Tunnel..."
    
    # 使用 cloudflared 配置文件启动 tunnel
    nohup cloudflared tunnel run drop > "$TUNNEL_LOG" 2>&1 &
    
    echo "Cloudflare Tunnel 已启动"
    echo "日志文件: $TUNNEL_LOG"
}

# 主流程
echo "========================================="
echo "Drop 服务启动"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# 检查是否已经构建
if [ ! -d "$PROJECT_DIR/dist" ]; then
    echo "错误：dist 目录不存在，请先运行 'npm run build'"
    exit 1
fi

# 启动服务
start_server
sleep 2

# 启动 Tunnel
start_tunnel

echo "========================================="
echo "所有服务已启动"
echo "访问地址：https://drop.jhonsteve.com"
echo "本地地址：http://localhost:3001"
echo "========================================="
