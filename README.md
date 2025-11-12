# Speaker Diarization & Transcription System

A self-hosted speaker diarization and transcription system that processes multi-speaker audio recordings, separates speakers, identifies them against known voice profiles, and transcribes speech.

## Features

- Multi-speaker audio file upload and processing
- Real-time progress tracking
- Speaker diarization and identification
- Speech-to-text transcription with timestamps
- Web UI for playback and speaker tagging
- Automatic timestamp extraction from filenames (format: `YYYY-MM-DD_HH-MM-SS.ext`)
- Audio segment playback by speaker
- Docker-based deployment

## Ubuntu 24.04 VM Preparation

If you're setting up on a fresh Ubuntu 24.04 VM, follow these steps:

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
# Add your user to the docker group
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
sudo ufw allow 8081/tcp  # Mongo Express (if accessing externally)
```

### 7. Install Git (if not already installed)

```bash
sudo apt install -y git
```

## Prerequisites

- Docker and Docker Compose (see Ubuntu 24.04 VM Preparation above)
- HuggingFace account with access token (for pyannote.audio models)
- At least 4 CPU cores and 8GB RAM (recommended: 8 cores, 16GB RAM)

## Quick Start

1. **Clone and configure:**
   ```bash
   cp .env.example .env
   # Edit .env and add your HUGGINGFACE_TOKEN
   ```

2. **Get HuggingFace Token:**
   - Create account at https://huggingface.co
   - Go to Settings → Access Tokens
   - Create a new token
   - Accept model terms:
     - https://huggingface.co/pyannote/speaker-diarization-3.1
     - https://huggingface.co/pyannote/embedding
   - Add token to `.env` file

3. **Build and start:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Access the application:**
   - Web UI: http://localhost:3001
   - MongoDB: mongodb://localhost:27017
   - Mongo Express (optional): http://localhost:8081

## Project Structure

```
speaker-diarization-system/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── mongo-init.js
├── nextjs-app/          # Next.js frontend/backend
└── python-worker/       # Audio processing worker
```

## Usage

1. **Upload audio files:**
   - Use filename format: `YYYY-MM-DD_HH-MM-SS.ext` (e.g., `2025-11-10_14-33-23.mp3`)
   - Upload via web UI or API

2. **Monitor processing:**
   - View real-time progress in the dashboard
   - Processing time: ~50-75 seconds per minute of audio (base model)

3. **Review results:**
   - View transcriptions with speaker labels
   - Tag unknown speakers
   - Play individual segments

## API Documentation

See the design document for complete API specifications.

## Performance

- **Processing Speed:** ~50-75 seconds per minute of audio (base Whisper model)
- **CPU Requirements:** 4+ cores recommended
- **Memory:** 8GB+ recommended per worker

## Troubleshooting

- Check logs: `docker-compose logs -f worker`
- Verify HuggingFace token is set correctly
- Ensure sufficient disk space for audio files
- Check MongoDB connection: `docker-compose exec mongo mongosh speaker_db`

## License

See LICENSE file for details.

