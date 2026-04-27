# Quick Start Guide

## Ubuntu 24.04 VM Preparation

If you're setting up on a fresh Ubuntu 24.04 VM, you can use the automated deployment script:

### Automated Setup (Recommended)

```bash
# Download and run the deployment script
./deploy-ubuntu.sh
```

The script will automatically:
- Update system packages
- Install Docker Engine and Docker Compose
- Configure firewall rules
- Install Git
- Verify all installations

**Note:** After running the script, if you were added to the docker group, you'll need to log out and log back in (or run `newgrp docker`) for the changes to take effect.

### Manual Setup

If you prefer to set up manually, follow these steps:

### 1. Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Docker Engine

```bash
# Install prerequisites
sudo apt install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3. Install Docker Compose (standalone)

If you need the standalone Docker Compose (in addition to the plugin):

```bash
# Download latest Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Add User to Docker Group

```bash
# Add your user to the docker group (replace $USER with your username if needed)
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
# Or use: newgrp docker
```

### 5. Verify Installation

```bash
# Verify Docker is running
sudo systemctl status docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Test Docker installation
docker --version
docker compose version
```

### 6. Configure Firewall (if enabled)

If UFW is enabled, allow necessary ports:

```bash
sudo ufw allow 3001/tcp  # Next.js web UI
sudo ufw allow 27017/tcp # MongoDB (if accessing externally)
```

### 7. Install Git (if not already installed)

```bash
sudo apt install -y git
```

## Prerequisites

1. **Docker and Docker Compose** installed (see Ubuntu 24.04 VM Preparation above)
2. **ElevenLabs Account** with API key

## Setup Steps

### 1. Get ElevenLabs API Key

1. Create account at https://elevenlabs.io
2. Go to Settings → API Keys
3. Create a new API key
4. Copy the API key (you'll need it for the `.env` file)

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your ElevenLabs API key:
```
ELEVENLABS_API_KEY=your_api_key_here
```

Optional language override (add as needed):
```
ELEVENLABS_LANGUAGE=eng  # English (leave empty for auto-detect)
```

**Common language codes:**
- `eng` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `ja` - Japanese
- `zh` - Chinese
- `ar` - Arabic

See `README.md` for more details on language configuration.

### 3. Build and Start

```bash
# Build all services
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access the Application

- **Web UI**: http://localhost:3001
- **MongoDB**: mongodb://localhost:27017

## First Upload

1. Go to http://localhost:3001
2. Click "Upload Recording"
3. Upload an audio file with filename format: `YYYY-MM-DD_HH-MM-SS.ext`
   - Example: `2025-11-10_14-33-23.mp3`
4. Wait for processing to complete (processing is done via ElevenLabs API)
5. View results in the recordings list

## Troubleshooting

### Worker not processing jobs

Check worker logs:
```bash
docker-compose logs -f worker
```

Common issues:
- Missing or invalid ElevenLabs API key
- Insufficient disk space
- Network connectivity issues (API calls require internet)
- API quota/rate limits exceeded

### MongoDB connection issues

Check MongoDB logs:
```bash
docker-compose logs -f mongo
```

Verify connection:
```bash
docker-compose exec mongo mongosh speaker_db
```

### Next.js build errors

Rebuild the Next.js service:
```bash
docker-compose build nextjs
docker-compose up -d nextjs
```

### API Errors

If you see ElevenLabs API errors:
- Verify your API key is correct
- Check your ElevenLabs account quota/limits
- Ensure internet connectivity is available
- Review API error messages in worker logs

## Stopping Services

```bash
docker-compose down
```

To also remove volumes (deletes all data):
```bash
docker-compose down -v
```
