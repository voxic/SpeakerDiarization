# python-worker/Dockerfile
FROM python:3.11-slim

# Install system dependencies
# Note: We need FFmpeg 4.x for PyAV 11.x compatibility (required by faster-whisper)
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    yasm \
    nasm \
    libsndfile1 \
    pkg-config \
    build-essential \
    gcc \
    g++ \
    make \
    autoconf \
    automake \
    libtool \
    && rm -rf /var/lib/apt/lists/*

# Install FFmpeg 4.4 from source (compatible with PyAV 11.x)
# This installs both runtime and development files to /usr/local
# Patch inline assembly to fix compatibility with newer assemblers
RUN cd /tmp && \
    wget https://ffmpeg.org/releases/ffmpeg-4.4.tar.xz && \
    tar -xf ffmpeg-4.4.tar.xz && \
    cd ffmpeg-4.4 && \
    # Patch the problematic inline assembly in mathops.h (line 125)
    # Replace the problematic asm statement with a no-op
    python3 << 'EOF'
with open('libavcodec/x86/mathops.h', 'r') as f:
    content = f.read()
# Find and replace the problematic asm statement around line 125
# The pattern matches __asm__ volatile with 'shr' instruction
import re
# Match the asm statement that contains 'shr' - could span multiple lines
pattern = r'__asm__\s+volatile\s*\([^)]*shr[^)]*\);'
replacement = '(void)0; /* Disabled: incompatible with newer assembler */'
content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
with open('libavcodec/x86/mathops.h', 'w') as f:
    f.write(content)
EOF
    && \
    # Use CFLAGS to disable inline assembly processing
    CFLAGS="-O2 -fno-asm" ./configure --prefix=/usr/local \
        --enable-shared \
        --disable-static \
        --disable-debug \
        --disable-doc \
        --enable-pic \
        --disable-asm && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    cd / && \
    rm -rf /tmp/ffmpeg-4.4* && \
    ffmpeg -version

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create storage directory
RUN mkdir -p /app/storage/recordings /app/storage/segments /app/storage/speakers

# Run worker
CMD ["python", "worker.py"]

