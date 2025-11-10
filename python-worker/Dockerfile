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
    python3 -c "import re; f=open('libavcodec/x86/mathops.h','r'); c=f.read(); f.close(); c=re.sub(r'__asm__\s+volatile\s*\([^)]*shr[^)]*\);', '(void)0; /* Disabled: incompatible with newer assembler */', c, flags=re.MULTILINE|re.DOTALL); f=open('libavcodec/x86/mathops.h','w'); f.write(c); f.close()" && \
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

