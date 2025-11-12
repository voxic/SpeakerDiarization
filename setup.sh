#!/bin/bash

# Setup script to install system dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        log_error "Cannot detect Linux distribution"
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    log_error "Unsupported OS: $OSTYPE"
    exit 1
fi

log_info "Detected OS: $OS"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_error "Please do not run this script as root. It will use sudo when needed."
    exit 1
fi

# Install dependencies based on OS
if [ "$OS" == "ubuntu" ] || [ "$OS" == "debian" ]; then
    log_info "Installing dependencies for Ubuntu/Debian..."
    
    sudo apt update
    sudo apt install -y \
        python3.11 \
        python3-pip \
        python3-venv \
        nodejs \
        npm \
        docker.io \
        ffmpeg \
        build-essential \
        git
    
    # Add user to docker group if not already
    if ! groups | grep -q docker; then
        log_info "Adding user to docker group..."
        sudo usermod -aG docker $USER
        log_warn "You may need to log out and log back in for docker group changes to take effect"
    fi
    
    # Start and enable Docker
    sudo systemctl enable docker
    sudo systemctl start docker
    
elif [ "$OS" == "macos" ]; then
    log_info "Installing dependencies for macOS..."
    
    if ! command -v brew &> /dev/null; then
        log_error "Homebrew is required. Install from https://brew.sh"
        exit 1
    fi
    
    brew install node python@3.11 docker ffmpeg
    
    # Start Docker Desktop (if installed)
    if [ -d "/Applications/Docker.app" ]; then
        log_info "Docker Desktop found. Please start it manually if not running."
    fi
    
else
    log_warn "OS $OS not fully supported. Please install dependencies manually:"
    log_warn "  - Node.js 20+"
    log_warn "  - Python 3.11+"
    log_warn "  - Docker"
    log_warn "  - FFmpeg 4.x"
    exit 1
fi

# Verify installations
log_info "Verifying installations..."

echo
log_info "=== Verification Results ==="

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_info "✓ Node.js: $NODE_VERSION"
else
    log_error "✗ Node.js: Not found"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_info "✓ npm: $NPM_VERSION"
else
    log_error "✗ npm: Not found"
fi

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    log_info "✓ Python: $PYTHON_VERSION"
else
    log_error "✗ Python: Not found"
fi

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_info "✓ Docker: $DOCKER_VERSION"
else
    log_error "✗ Docker: Not found"
fi

if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    log_info "✓ FFmpeg: $FFMPEG_VERSION"
else
    log_error "✗ FFmpeg: Not found"
fi

echo
log_info "=== Setup Complete ==="
echo
log_info "Next steps:"
echo "  1. Copy .env.example to .env"
echo "  2. Edit .env and add your HUGGINGFACE_TOKEN"
echo "  3. Run ./start.sh to start all services"
echo

