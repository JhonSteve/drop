#!/bin/bash
cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}   🛑 Drop - 停止服务${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# Stop server
SERVER_PID=$(cat /tmp/drop-server.pid 2>/dev/null)
if [ -n "$SERVER_PID" ] && ps -p "$SERVER_PID" >/dev/null 2>&1; then
  echo -e "${BLUE}▶ 停止服务器 (PID: $SERVER_PID)...${NC}"
  kill "$SERVER_PID" 2>/dev/null
  sleep 1
  if ps -p "$SERVER_PID" >/dev/null 2>&1; then
    kill -9 "$SERVER_PID" 2>/dev/null
  fi
  echo -e "${GREEN}✓ 服务器已停止${NC}"
else
  echo -e "${YELLOW}⚠ 服务器未运行${NC}"
fi
rm -f /tmp/drop-server.pid

# Also kill anything on port 3001
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${BLUE}▶ 清理端口 3001...${NC}"
  lsof -ti :3001 | xargs kill -9 2>/dev/null
  echo -e "${GREEN}✓ 端口已清理${NC}"
fi

echo ""

# Stop cloudflared
TUNNEL_PID=$(cat /tmp/drop-tunnel.pid 2>/dev/null)
if [ -n "$TUNNEL_PID" ] && ps -p "$TUNNEL_PID" >/dev/null 2>&1; then
  echo -e "${BLUE}▶ 停止 Cloudflare Tunnel (PID: $TUNNEL_PID)...${NC}"
  kill "$TUNNEL_PID" 2>/dev/null
  echo -e "${GREEN}✓ Tunnel 已停止${NC}"
else
  echo -e "${YELLOW}⚠ Tunnel 未运行${NC}"
fi

# Also kill any cloudflared processes
pkill -f cloudflared 2>/dev/null
rm -f /tmp/drop-tunnel.pid

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ 所有服务已停止${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "按回车键退出..."
read
