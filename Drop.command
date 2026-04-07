#!/bin/bash
cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear

wait_for_port_3001_free() {
  for _ in $(seq 1 10); do
    if ! lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_server_3001() {
  for _ in $(seq 1 20); do
    server_pid=$(lsof -Pi :3001 -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$server_pid" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_tunnel_process() {
  for _ in $(seq 1 15); do
    tunnel_pid=$(cat /tmp/drop-tunnel.pid 2>/dev/null)
    if [ -n "$tunnel_pid" ] && ps -p "$tunnel_pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

print_server_start_diagnostics() {
  echo -e "${YELLOW}--- server.log 最后 40 行 ---${NC}"
  if [ -f logs/server.log ]; then
    tail -n 40 logs/server.log
  else
    echo "logs/server.log 不存在"
  fi

  echo -e "${YELLOW}--- tsx server.ts 进程检查 ---${NC}"
  server_processes=$(ps aux | grep "tsx server.ts" | grep -v grep)
  if [ -n "$server_processes" ]; then
    printf '%s\n' "$server_processes"
  else
    echo "未发现 tsx server.ts 进程"
  fi
}

# Check if running
SERVER_RUNNING=false
TUNNEL_RUNNING=false

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  SERVER_RUNNING=true
fi

if pgrep -f "cloudflared.*drop" >/dev/null 2>&1; then
  TUNNEL_RUNNING=true
fi

if [ "$SERVER_RUNNING" = true ] || [ "$TUNNEL_RUNNING" = true ]; then
  # Running - show stop option
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${YELLOW}   Drop 正在运行${NC}"
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
      rm -f /tmp/drop-*.pid
      wait_for_port_3001_free
      clear
      echo -e "${GREEN}✓ 所有服务已停止${NC}"
      ;;
    2)
      # Restart
      pkill -f cloudflared 2>/dev/null
      lsof -ti :3001 | xargs kill 2>/dev/null
      sleep 1
      lsof -ti :3001 | xargs kill -9 2>/dev/null
      rm -f /tmp/drop-*.pid
      echo -e "${BLUE}▶ 等待端口 3001 释放...${NC}"
      if wait_for_port_3001_free; then
        echo -e "${GREEN}✓ 端口 3001 已释放${NC}"
      else
        echo -e "${YELLOW}⚠  端口 3001 仍被占用，将继续尝试启动${NC}"
      fi
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
  echo -e "${BLUE}   🚀 Drop - 启动服务${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo ""
  mkdir -p logs

  existing_server_pid=$(lsof -Pi :3001 -sTCP:LISTEN -t 2>/dev/null)
  
  if [ -n "$existing_server_pid" ]; then
    echo -e "${YELLOW}⚠  服务器已在运行 (PID: $existing_server_pid)${NC}"
    echo -e "${GREEN}✓ 服务器启动成功${NC}"
  else
    echo -e "${BLUE}▶ 启动服务器...${NC}"
    NODE_ENV=production nohup npx tsx server.ts > logs/server.log 2>&1 &
    echo $! > /tmp/drop-server.pid

    if wait_for_server_3001; then
      echo -e "${GREEN}✓ 服务器启动成功${NC}"
    else
      echo -e "${RED}✗ 服务器启动失败（20秒超时）${NC}"
      print_server_start_diagnostics
    fi
  fi
  
  echo ""
  echo -e "${BLUE}▶ 启动 Cloudflare Tunnel...${NC}"
  nohup cloudflared tunnel --config ~/.cloudflared/config.yml run drop > logs/tunnel.log 2>&1 &
  echo $! > /tmp/drop-tunnel.pid

  if wait_for_tunnel_process; then
    echo -e "${GREEN}✓ Tunnel 启动成功${NC}"
  else
    echo -e "${RED}✗ Tunnel 启动失败（15秒超时）${NC}"
    echo -e "${YELLOW}请检查 logs/tunnel.log 获取更多信息${NC}"
  fi
  
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}🌐 访问地址: https://drop.jhonsteve.com${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
fi

echo ""
echo "按回车键退出..."
read
