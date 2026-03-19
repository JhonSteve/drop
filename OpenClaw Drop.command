#!/bin/bash
cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear

# Check if running
SERVER_RUNNING=false
TUNNEL_RUNNING=false

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  SERVER_RUNNING=true
fi

if pgrep -f "cloudflared.*openclaw-drop" >/dev/null 2>&1; then
  TUNNEL_RUNNING=true
fi

if [ "$SERVER_RUNNING" = true ] || [ "$TUNNEL_RUNNING" = true ]; then
  # Running - show stop option
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${YELLOW}   OpenClaw Drop 正在运行${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  访问: ${GREEN}https://drop.jhonsteve.com${NC}"
  echo ""
  echo -e "  输入 ${GREEN}1${NC} 停止服务"
  echo -e "  输入 ${GREEN}2${NC} 重启服务"
  echo -e "  输入 ${GREEN}3${NC} 退出"
  echo ""
  read -p "请选择 [1/2/3]: " choice
  
  case $choice in
    1)
      # Stop
      pkill -f cloudflared 2>/dev/null
      lsof -ti :3001 | xargs kill 2>/dev/null
      sleep 1
      lsof -ti :3001 | xargs kill -9 2>/dev/null
      rm -f /tmp/openclaw-drop-*.pid
      clear
      echo -e "${GREEN}✓ 所有服务已停止${NC}"
      ;;
    2)
      # Restart
      pkill -f cloudflared 2>/dev/null
      lsof -ti :3001 | xargs kill 2>/dev/null
      sleep 1
      lsof -ti :3001 | xargs kill -9 2>/dev/null
      rm -f /tmp/openclaw-drop-*.pid
      sleep 1
      # Fall through to start
      ;;
    3)
      exit 0
      ;;
    *)
      exit 0
      ;;
  esac
fi

# If we got here (either was stopped, or chose restart), start services
if [ "$choice" != "1" ]; then
  clear
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${BLUE}   🚀 OpenClaw Drop - 启动服务${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo ""
  
  echo -e "${BLUE}▶ 启动服务器...${NC}"
  nohup npx tsx server.ts > logs/server.log 2>&1 &
  echo $! > /tmp/openclaw-drop-server.pid
  sleep 2
  
  if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ 服务器启动成功${NC}"
  else
    echo -e "${RED}✗ 服务器启动失败${NC}"
  fi
  
  echo ""
  echo -e "${BLUE}▶ 启动 Cloudflare Tunnel...${NC}"
  nohup cloudflared tunnel --config ~/.cloudflared/config.yml run openclaw-drop > logs/tunnel.log 2>&1 &
  echo $! > /tmp/openclaw-drop-tunnel.pid
  sleep 3
  
  if ps -p $(cat /tmp/openclaw-drop-tunnel.pid 2>/dev/null) >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Tunnel 启动成功${NC}"
  else
    echo -e "${RED}✗ Tunnel 启动失败${NC}"
  fi
  
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}🌐 访问地址: https://drop.jhonsteve.com${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
fi

echo ""
echo "按回车键退出..."
read
