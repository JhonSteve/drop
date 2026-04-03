#!/bin/bash

# Drop Management Script
# Provides start/stop/restart/status for server and Cloudflare Tunnel

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# PID files
SERVER_PID_FILE="/tmp/drop-server.pid"
TUNNEL_PID_FILE="/tmp/drop-tunnel.pid"

# Log directory and files
LOG_DIR="$SCRIPT_DIR/logs"
SERVER_LOG="$LOG_DIR/server.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Port to check
PORT=3001

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# ============================================================
# Helper Functions
# ============================================================

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_header() {
    echo -e "\n${CYAN}════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════${NC}"
}

# ============================================================
# Process Management Functions
# ============================================================

is_process_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return 0
        fi
    fi
    return 1
}

get_server_pid() {
    is_process_running "$SERVER_PID_FILE"
}

get_tunnel_pid() {
    is_process_running "$TUNNEL_PID_FILE"
}

kill_process() {
    local pid_file="$1"
    local process_name="$2"
    local timeout=10
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    
    if [ -n "$pid" ]; then
        if kill -0 "$pid" 2>/dev/null; then
            print_info "Stopping $process_name (PID: $pid)..."
            kill "$pid" 2>/dev/null
            
            # Wait for process to terminate
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt $timeout ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                print_warning "Force stopping $process_name..."
                kill -9 "$pid" 2>/dev/null
                sleep 1
            fi
            
            # Remove PID file
            rm -f "$pid_file"
            print_success "$process_name stopped"
            return 0
        else
            # Process not running, just remove stale PID file
            rm -f "$pid_file"
            print_warning "$process_name PID file stale, removed"
            return 0
        fi
    else
        print_warning "$process_name not running (no PID file)"
        return 1
    fi
}

# ============================================================
# Port Check
# ============================================================

check_port_available() {
    if lsof -Pi ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port is in use
    fi
    return 0  # Port is available
}

wait_for_port() {
    local timeout=30
    local count=0
    
    while [ $count -lt $timeout ]; do
        if lsof -Pi ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    return 1
}

# ============================================================
# Health Check
# ============================================================

health_check() {
    local timeout=30
    local count=0
    
    print_info "Running health check..."
    
    while [ $count -lt $timeout ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null | grep -q "200\|301\|302"; then
            print_success "Server is healthy (responding on port $PORT)"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    print_error "Server health check failed (timeout after ${timeout}s)"
    return 1
}

# ============================================================
# Start Functions
# ============================================================

start_server() {
    local pid=$(get_server_pid)
    
    if [ -n "$pid" ]; then
        print_warning "Server already running (PID: $pid)"
        return 0
    fi
    
    # Check if port is available
    if ! check_port_available; then
        print_error "Port $PORT is already in use"
        print_info "Checking if it's our server..."
        
        # Try to identify what's using the port
        local port_pid=$(lsof -ti ":$PORT" 2>/dev/null | head -1)
        if [ -n "$port_pid" ]; then
            print_info "Process $port_pid is using port $PORT"
        fi
        return 1
    fi
    
    print_info "Starting Drop server..."
    
    # Set environment
    export NODE_ENV=production
    export PORT=$PORT
    
    # Start server in background
    nohup npx tsx server.ts >> "$SERVER_LOG" 2>&1 &
    local new_pid=$!
    echo "$new_pid" > "$SERVER_PID_FILE"
    
    # Wait for port to be listening
    if wait_for_port; then
        print_success "Server started (PID: $new_pid, Port: $PORT)"
        print_info "Log file: $SERVER_LOG"
        return 0
    else
        print_error "Server failed to start (port not listening)"
        rm -f "$SERVER_PID_FILE"
        return 1
    fi
}

start_tunnel() {
    local pid=$(get_tunnel_pid)
    
    if [ -n "$pid" ]; then
        print_warning "Tunnel already running (PID: $pid)"
        return 0
    fi
    
    print_info "Starting Cloudflare Tunnel..."
    
    # Set environment to bypass proxy
    export NO_PROXY=cloudflare.com,cfargotunnel.com,cloudflareresolve.com,localhost,127.0.0.1
    export no_proxy=$NO_PROXY
    export HTTP_PROXY=
    export HTTPS_PROXY=
    export http_proxy=
    export https_proxy=
    
    # Start tunnel in background
    nohup cloudflared tunnel --config ~/.cloudflared/config.yml run drop >> "$TUNNEL_LOG" 2>&1 &
    local new_pid=$!
    echo "$new_pid" > "$TUNNEL_PID_FILE"
    
    print_success "Tunnel started (PID: $new_pid)"
    print_info "Log file: $TUNNEL_LOG"
    return 0
}

start_all() {
    print_header "Starting Drop Services"
    
    local server_ok=0
    local tunnel_ok=0
    
    # Start server
    if start_server; then
        server_ok=1
    fi
    
    # Small delay between services
    sleep 1
    
    # Start tunnel
    if start_tunnel; then
        tunnel_ok=1
    fi
    
    # Summary
    echo ""
    if [ $server_ok -eq 1 ] && [ $tunnel_ok -eq 1 ]; then
        # Run health check on server
        health_check
        
        print_success "All services started successfully!"
        echo ""
        print_info "Local:   http://localhost:$PORT"
        print_info "Public:  https://drop.jhonsteve.com"
        echo ""
    elif [ $server_ok -eq 1 ]; then
        print_warning "Server started, but tunnel failed"
    elif [ $tunnel_ok -eq 1 ]; then
        print_warning "Tunnel started, but server failed"
    else
        print_error "Failed to start services"
        return 1
    fi
    
    return 0
}

# ============================================================
# Stop Functions
# ============================================================

stop_server() {
    kill_process "$SERVER_PID_FILE" "Server"
}

stop_tunnel() {
    kill_process "$TUNNEL_PID_FILE" "Tunnel"
}

stop_all() {
    print_header "Stopping Drop Services"
    
    stop_server
    stop_tunnel
    
    echo ""
    print_success "All services stopped"
}

# ============================================================
# Restart Functions
# ============================================================

restart_all() {
    print_header "Restarting Drop Services"
    
    stop_all
    sleep 2
    start_all
}

# ============================================================
# Status Functions
# ============================================================

show_status() {
    print_header "Drop Status"
    
    # Server status
    local server_pid=$(get_server_pid)
    if [ -n "$server_pid" ]; then
        print_success "Server: Running (PID: $server_pid)"
        
        # Check if port is responding
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null | grep -q "200\|301\|302"; then
            print_success "Server: Responding on port $PORT"
        else
            print_warning "Server: Not responding on port $PORT"
        fi
    else
        print_error "Server: Not running"
    fi
    
    # Tunnel status
    local tunnel_pid=$(get_tunnel_pid)
    if [ -n "$tunnel_pid" ]; then
        print_success "Tunnel: Running (PID: $tunnel_pid)"
    else
        print_error "Tunnel: Not running"
    fi
    
    # Port check
    echo ""
    print_info "Port $PORT status:"
    if lsof -Pi ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
        local port_pid=$(lsof -ti ":$PORT" 2>/dev/null | head -1)
        print_warning "Port $PORT is in use by PID: $port_pid"
    else
        print_success "Port $PORT is available"
    fi
    
    # Log files
    echo ""
    print_info "Log files:"
    if [ -f "$SERVER_LOG" ]; then
        local server_log_size=$(du -h "$SERVER_LOG" | cut -f1)
        print_info "  Server: $SERVER_LOG ($server_log_size)"
    fi
    if [ -f "$TUNNEL_LOG" ]; then
        local tunnel_log_size=$(du -h "$TUNNEL_LOG" | cut -f1)
        print_info "  Tunnel: $TUNNEL_LOG ($tunnel_log_size)"
    fi
    
    echo ""
}

# ============================================================
# Usage
# ============================================================

show_usage() {
    echo -e "${CYAN}Drop Management Script${NC}"
    echo ""
    echo -e "Usage: ${GREEN}./manage.sh${NC} ${YELLOW}<command>${NC}"
    echo ""
    echo -e "Commands:"
    echo -e "  ${GREEN}start${NC}     Start server and Cloudflare Tunnel"
    echo -e "  ${GREEN}stop${NC}      Stop server and Cloudflare Tunnel"
    echo -e "  ${GREEN}restart${NC}   Restart both services"
    echo -e "  ${GREEN}status${NC}    Show running status"
    echo -e "  ${GREEN}help${NC}      Show this help message"
    echo ""
    echo -e "Examples:"
    echo -e "  ${BLUE}./manage.sh start${NC}     # Start all services"
    echo -e "  ${BLUE}./manage.sh status${NC}    # Check what's running"
    echo -e "  ${BLUE}./manage.sh stop${NC}      # Stop everything"
    echo ""
    echo -e "Files:"
    echo -e "  PID files: ${YELLOW}/tmp/drop-*.pid${NC}"
    echo -e "  Log files: ${YELLOW}$LOG_DIR/*.log${NC}"
    echo ""
}

# ============================================================
# Main
# ============================================================

case "$1" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_all
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_usage
        ;;
    "")
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
