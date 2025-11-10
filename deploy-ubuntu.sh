#!/bin/bash

# Ubuntu VM Deployment Script for Speaker Diarization System
# This script prepares an Ubuntu 24.04 VM with all prerequisites

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_error "Please do not run this script as root. It will use sudo when needed."
    exit 1
fi

# Check if running on Ubuntu
if [ ! -f /etc/os-release ]; then
    log_error "Cannot detect OS. This script is designed for Ubuntu 24.04."
    exit 1
fi

. /etc/os-release
if [ "$ID" != "ubuntu" ]; then
    log_warn "This script is designed for Ubuntu. Detected: $ID"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log_info "Starting Ubuntu VM preparation for Speaker Diarization System..."
log_info "Detected OS: $PRETTY_NAME"

# Step 1: Update System Packages
log_info "Step 1/7: Updating system packages..."
sudo apt update
sudo apt upgrade -y
log_info "System packages updated successfully"

# Step 2: Install Docker Engine
log_info "Step 2/7: Installing Docker Engine..."

# Check if Docker is already installed
if command -v docker &> /dev/null; then
    log_warn "Docker appears to be already installed. Skipping Docker installation."
    docker --version
else
    # Install prerequisites
    log_info "Installing prerequisites..."
    sudo apt install -y ca-certificates curl

    # Add Docker's official GPG key
    log_info "Adding Docker's official GPG key..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    log_info "Adding Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    log_info "Installing Docker Engine..."
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    log_info "Docker Engine installed successfully"
fi

# Step 3: Install Docker Compose (standalone)
log_info "Step 3/7: Installing Docker Compose (standalone)..."

if command -v docker-compose &> /dev/null; then
    log_warn "Docker Compose (standalone) appears to be already installed. Skipping..."
    docker-compose --version
else
    log_info "Downloading latest Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log_info "Docker Compose installed successfully"
fi

# Step 4: Add User to Docker Group
log_info "Step 4/7: Adding user to docker group..."
if groups | grep -q docker; then
    log_warn "User is already in the docker group. Skipping..."
else
    sudo usermod -aG docker $USER
    log_info "User added to docker group. You may need to log out and log back in for changes to take effect."
    log_warn "Alternatively, you can run: newgrp docker"
fi

# Step 5: Enable and Start Docker Service
log_info "Step 5/7: Enabling and starting Docker service..."
sudo systemctl enable docker
sudo systemctl start docker
log_info "Docker service enabled and started"

# Step 6: Configure Firewall
log_info "Step 6/7: Configuring firewall..."
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        log_info "UFW is active. Configuring firewall rules..."
        sudo ufw allow 3000/tcp comment "Next.js web UI"
        sudo ufw allow 27017/tcp comment "MongoDB"
        sudo ufw allow 8081/tcp comment "Mongo Express"
        log_info "Firewall rules configured"
    else
        log_warn "UFW is installed but not active. Skipping firewall configuration."
    fi
else
    log_warn "UFW is not installed. Skipping firewall configuration."
fi

# Step 7: Install Git
log_info "Step 7/7: Installing Git..."
if command -v git &> /dev/null; then
    log_warn "Git is already installed. Skipping..."
    git --version
else
    sudo apt install -y git
    log_info "Git installed successfully"
fi

# Verification
log_info "Verifying installations..."

echo
log_info "=== Verification Results ==="

if command -v docker &> /dev/null; then
    log_info "✓ Docker: $(docker --version)"
else
    log_error "✗ Docker: Not found"
fi

if command -v docker-compose &> /dev/null; then
    log_info "✓ Docker Compose (standalone): $(docker-compose --version)"
else
    log_error "✗ Docker Compose (standalone): Not found"
fi

if docker compose version &> /dev/null; then
    log_info "✓ Docker Compose (plugin): $(docker compose version)"
else
    log_warn "✗ Docker Compose (plugin): Not found"
fi

if command -v git &> /dev/null; then
    log_info "✓ Git: $(git --version)"
else
    log_error "✗ Git: Not found"
fi

# Check Docker service status
if sudo systemctl is-active --quiet docker; then
    log_info "✓ Docker service: Running"
else
    log_error "✗ Docker service: Not running"
fi

if sudo systemctl is-enabled --quiet docker; then
    log_info "✓ Docker service: Enabled on boot"
else
    log_warn "✗ Docker service: Not enabled on boot"
fi

echo
log_info "=== Deployment Complete ==="
echo
log_info "Next steps:"
echo "  1. If you were added to the docker group, log out and log back in"
echo "     (or run: newgrp docker)"
echo "  2. Clone or copy your speaker diarization project"
echo "  3. Create .env file with your HUGGINGFACE_TOKEN"
echo "  4. Run: docker-compose build && docker-compose up -d"
echo
log_info "For detailed instructions, see QUICKSTART.md"
echo

