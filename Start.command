#!/bin/bash
cd "$(dirname "$0")"

# Colors for terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}   🚀 OpenClaw Drop - 启动服务${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# Check if server is already running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠  服务器已在运行 (端口 3001)${NC}"
else
  echo -e "${BLUE}▶ 启动服务器...${NC}"
  nohup npx tsx server.ts > logs/server.log 2>&1 &
  echo $! > /tmp/openclaw-drop-server.pid
  sleep 2
  
  if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ 服务器启动成功${NC}"
  else
    echo -e "${RED}✗ 服务器启动失败，请检查 logs/server.log${NC}"
  fi
fi

echo ""

# Kill existing cloudflared
pkill -f cloudflared 2>/dev/null
sleep 1

echo -e "${BLUE}▶ 启动 Cloudflare Tunnel...${NC}"
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run openclaw-drop > logs/tunnel.log 2>&1 &
echo $! > /tmp/openclaw-drop-tunnel.pid

sleep 3

# Check tunnel
if ps -p $(cat /tmp/openclaw-drop-tunnel.pid 2>/dev/null) >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Tunnel 启动成功${NC}"
else
  echo -e "${RED}✗ Tunnel 启动失败，请检查 logs/tunnel.log${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}🌐 访问地址: https://drop.jhonsteve.com${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "按回车键退出..."
read
