# Speaker Diarization & Transcription System - Design Document

**Version:** 1.0  
**Date:** November 10, 2025  
**Author:** System Design

---

## 1. Executive Summary

This document outlines the design for a self-hosted speaker diarization and transcription system that processes multi-speaker audio recordings. The system will separate speakers, identify them against known voice profiles, transcribe speech, and provide a web interface for managing recordings and reviewing results.

### Key Features
- Multi-speaker audio file upload and processing
- Real-time progress tracking
- Speaker diarization and identification
- Speech-to-text transcription with timestamps
- Web UI for playback and speaker tagging
- Automatic timestamp extraction from filenames (format: `YYYY-MM-DD_HH-MM-SS.ext`)
- Audio segment playback by speaker
- Docker-based deployment

### Technology Stack
- **Frontend/Backend:** Next.js (React with API Routes)
- **Database:** MongoDB (Native Driver)
- **ML Models:** Faster-Whisper, pyannote.audio
- **Processing:** CPU-optimized (no GPU required)
- **Queue:** BullMQ (Redis-backed) or MongoDB-based queue

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│          (Upload, Monitor Progress, Review, Tag)            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Application                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Frontend (React)                                    │   │
│  │  - Pages & Components                                │   │
│  │  - Real-time updates via WebSocket/Server-Sent Events│   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API Routes (Next.js)                                │   │
│  │  - /api/recordings                                   │   │
│  │  - /api/speakers                                     │   │
│  │  - /api/segments                                     │   │
│  │  - /api/ws (WebSocket)                               │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│    MongoDB       │      │  Python Worker   │
│                  │      │  Service         │
│  - recordings    │      │                  │
│  - speakers      │◄─────┤  - Diarization   │
│  - segments      │      │  - Identification│
│  - jobs          │      │  - Transcription │
│  - tags          │      │                  │
└──────────────────┘      └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  File Storage    │
                          │  (Docker Volume) │
                          │                  │
                          │  - Audio files   │
                          │  - Segments      │
                          │  - Speaker       │
                          │    profiles      │
                          └──────────────────┘
```

### 2.2 Component Overview

#### 2.2.1 Next.js Application
- **Technology:** Next.js 14+ (React, TypeScript)
- **Responsibilities:**
  - Server-side rendering (SSR) for pages
  - API routes for REST endpoints
  - WebSocket/SSE for real-time updates
  - File upload handling
  - Database operations (MongoDB native driver)
  - Job queue management
  - Authentication/Authorization
  - Static asset serving

#### 2.2.2 Python Worker Service
- **Technology:** Python with BullMQ/custom queue processor
- **Responsibilities:**
  - Audio processing pipeline
  - Speaker diarization (pyannote.audio)
  - Speaker identification
  - Speech-to-text (faster-whisper)
  - Audio segment extraction
  - Progress reporting to MongoDB
  - CPU-optimized processing

#### 2.2.3 MongoDB Database
- **Technology:** MongoDB 7+
- **Responsibilities:**
  - Store recording metadata
  - Store transcriptions and segments
  - Store speaker profiles
  - Store processing jobs and status
  - Job queue (change streams for monitoring)
  - User authentication data

#### 2.2.4 File Storage
- **Technology:** Local filesystem (Docker volume)
- **Responsibilities:**
  - Original audio files
  - Extracted speaker segments
  - Speaker profile samples

---

## 3. Data Models

### 3.1 MongoDB Collections

#### 3.1.1 Recordings Collection

```javascript
{
  _id: ObjectId("..."),
  filename: "2025-11-10_14-33-23.mp3",
  originalFilename: "2025-11-10_14-33-23.mp3",
  filePath: "/storage/recordings/uuid.mp3",
  fileSize: 15728640, // bytes
  durationSeconds: 1800.5,
  startTime: ISODate("2025-11-10T14:33:23.000Z"),
  status: "completed", // pending, processing, completed, failed
  progress: 100, // 0-100
  errorMessage: null,
  createdAt: ISODate("2025-11-10T15:00:00.000Z"),
  updatedAt: ISODate("2025-11-10T15:30:00.000Z")
}

// Indexes
db.recordings.createIndex({ status: 1 })
db.recordings.createIndex({ startTime: -1 })
db.recordings.createIndex({ createdAt: -1 })
```

#### 3.1.2 Known Speakers Collection

```javascript
{
  _id: ObjectId("..."),
  name: "Alice Johnson",
  description: "Team lead for project X",
  sampleAudioPath: "/storage/speakers/alice_sample.wav",
  embeddingPath: "/storage/speakers/alice_embedding.npy",
  embedding: [], // Optional: store embedding directly as array
  createdAt: ISODate("2025-11-10T12:00:00.000Z"),
  updatedAt: ISODate("2025-11-10T12:00:00.000Z")
}

// Indexes
db.knownSpeakers.createIndex({ name: 1 }, { unique: true })
```

#### 3.1.3 Speaker Segments Collection

```javascript
{
  _id: ObjectId("..."),
  recordingId: ObjectId("..."),
  speakerLabel: "SPEAKER_00", // From diarization
  identifiedSpeakerId: ObjectId("..."), // Reference to knownSpeakers
  confidenceScore: 0.8756,
  startTime: ISODate("2025-11-10T14:33:12.500Z"), // Absolute time
  endTime: ISODate("2025-11-10T14:34:45.200Z"),   // Absolute time
  durationSeconds: 92.7,
  segmentAudioPath: "/storage/segments/recording_uuid_segment_0.wav",
  transcription: "Welcome everyone to today's meeting...",
  transcriptionSegments: [ // Finer-grained word-level timestamps
    {
      startOffset: 0.0,    // Offset from segment start
      endOffset: 1.2,
      text: "Welcome",
      confidence: 0.95
    },
    {
      startOffset: 1.2,
      endOffset: 2.5,
      text: "everyone",
      confidence: 0.93
    }
  ],
  createdAt: ISODate("2025-11-10T15:15:00.000Z")
}

// Indexes
db.speakerSegments.createIndex({ recordingId: 1 })
db.speakerSegments.createIndex({ recordingId: 1, startTime: 1 })
db.speakerSegments.createIndex({ identifiedSpeakerId: 1 })
db.speakerSegments.createIndex({ startTime: 1, endTime: 1 })
```

#### 3.1.4 Processing Jobs Collection

```javascript
{
  _id: ObjectId("..."),
  recordingId: ObjectId("..."),
  jobType: "diarization", // diarization, identification, transcription, full
  status: "running", // queued, running, completed, failed
  progress: 45, // 0-100
  errorMessage: null,
  steps: [
    {
      name: "diarization",
      status: "completed",
      progress: 100,
      startedAt: ISODate("2025-11-10T15:00:00.000Z"),
      completedAt: ISODate("2025-11-10T15:05:00.000Z")
    },
    {
      name: "identification",
      status: "running",
      progress: 45,
      startedAt: ISODate("2025-11-10T15:05:00.000Z"),
      completedAt: null
    }
  ],
  startedAt: ISODate("2025-11-10T15:00:00.000Z"),
  completedAt: null,
  createdAt: ISODate("2025-11-10T15:00:00.000Z")
}

// Indexes
db.processingJobs.createIndex({ recordingId: 1 })
db.processingJobs.createIndex({ status: 1 })
db.processingJobs.createIndex({ createdAt: -1 })
```

#### 3.1.5 Speaker Tags Collection

```javascript
{
  _id: ObjectId("..."),
  recordingId: ObjectId("..."),
  speakerLabel: "SPEAKER_00",
  userAssignedName: "John from Marketing",
  createdAt: ISODate("2025-11-10T16:00:00.000Z")
}

// Indexes
db.speakerTags.createIndex({ recordingId: 1, speakerLabel: 1 }, { unique: true })
```

### 3.2 TypeScript Interfaces (Next.js)

```typescript
// types/recording.ts
export interface Recording {
  _id: string;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  durationSeconds: number;
  startTime: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnownSpeaker {
  _id: string;
  name: string;
  description?: string;
  sampleAudioPath: string;
  embeddingPath: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionSegment {
  startOffset: number;
  endOffset: number;
  text: string;
  confidence: number;
}

export interface SpeakerSegment {
  _id: string;
  recordingId: string;
  speakerLabel: string;
  identifiedSpeakerId?: string;
  confidenceScore: number;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  segmentAudioPath: string;
  transcription: string;
  transcriptionSegments: TranscriptionSegment[];
  createdAt: Date;
}

export interface JobStep {
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProcessingJob {
  _id: string;
  recordingId: string;
  jobType: 'diarization' | 'identification' | 'transcription' | 'full';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  steps: JobStep[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface SpeakerTag {
  _id: string;
  recordingId: string;
  speakerLabel: string;
  userAssignedName: string;
  createdAt: Date;
}
```

---

## 4. API Design

### 4.1 Next.js API Routes

All API routes are located in `/app/api/` directory following Next.js 14+ App Router conventions.

#### 4.1.1 Recording Management

```typescript
// app/api/recordings/upload/route.ts
POST /api/recordings/upload
- Upload one or multiple audio files
- Extracts timestamp from filename
- Creates recording entries and queues processing jobs
- Request: multipart/form-data
- Response: Array of recording objects with job IDs

// app/api/recordings/route.ts
GET /api/recordings
- List all recordings with pagination and filtering
- Query params: status, start_date, end_date, limit, offset
- Response: Paginated list of recordings

// app/api/recordings/[id]/route.ts
GET /api/recordings/{id}
- Get detailed recording information
- Response: Recording object with segments and transcriptions

DELETE /api/recordings/{id}
- Delete recording and all associated data
- Response: Success message

// app/api/recordings/[id]/reprocess/route.ts
POST /api/recordings/{id}/reprocess
- Reprocess a failed or completed recording
- Response: New job ID
```

#### 4.1.2 Speaker Management

```typescript
// app/api/speakers/route.ts
GET /api/speakers
- List all known speakers
- Response: Array of speaker objects

POST /api/speakers
- Add a new known speaker with voice sample
- Request: multipart/form-data (name, description, audio_file)
- Response: Speaker object

// app/api/speakers/[id]/route.ts
GET /api/speakers/{id}
- Get speaker details
- Response: Speaker object

PUT /api/speakers/{id}
- Update speaker information
- Request: JSON (name, description)
- Response: Updated speaker object

DELETE /api/speakers/{id}
- Delete known speaker
- Response: Success message
```

#### 4.1.3 Speaker Segments

```typescript
// app/api/recordings/[recordingId]/segments/route.ts
GET /api/recordings/{recordingId}/segments
- Get all speaker segments for a recording
- Query params: speakerLabel, identifiedSpeakerId
- Response: Array of speaker segment objects

// app/api/segments/[id]/audio/route.ts
GET /api/segments/{id}/audio
- Stream audio for a specific segment
- Response: Audio file stream (WAV/MP3)

// app/api/segments/[id]/tag/route.ts
POST /api/segments/{id}/tag
- Assign a user-defined name to a speaker in a recording
- Request: JSON { "name": "John Doe" }
- Response: Updated segment object
```

#### 4.1.4 Transcriptions

```typescript
// app/api/recordings/[id]/transcription/route.ts
GET /api/recordings/{id}/transcription
- Get full transcription with timestamps
- Query params: format (json, txt, srt, vtt)
- Response: Transcription in requested format

// app/api/segments/[id]/transcription/route.ts
GET /api/segments/{id}/transcription
- Get transcription for specific segment
- Response: Transcription object
```

#### 4.1.5 Jobs & Progress

```typescript
// app/api/jobs/[id]/route.ts
GET /api/jobs/{id}
- Get job status and progress
- Response: Job object

// app/api/recordings/[id]/jobs/route.ts
GET /api/recordings/{id}/jobs
- Get all jobs for a recording
- Response: Array of job objects
```

### 4.2 Real-time Updates

#### 4.2.1 Server-Sent Events (SSE)

```typescript
// app/api/jobs/[id]/stream/route.ts
GET /api/jobs/{id}/stream
- Server-sent events for real-time job progress
- Events:
  - job:started - Job has started processing
  - job:progress - Progress update
  - job:completed - Job completed successfully
  - job:failed - Job failed with error
```

#### 4.2.2 MongoDB Change Streams (Alternative)

```typescript
// Listen to changes in processingJobs collection
const changeStream = db.collection('processingJobs').watch();

changeStream.on('change', (change) => {
  // Emit to connected clients via SSE or WebSocket
  if (change.operationType === 'update') {
    notifyClients(change.documentKey._id, change.updateDescription);
  }
});
```

### 4.3 Example API Route Implementation

```typescript
// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { extractStartTimeFromFilename } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { db } = await connectToDatabase();
  
  const query: any = {};
  if (status) query.status = status;

  const recordings = await db
    .collection('recordings')
    .find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  const total = await db.collection('recordings').countDocuments(query);

  return NextResponse.json({
    recordings,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll('files');
  
  // Process files...
  // Create recording documents...
  // Queue processing jobs...
  
  return NextResponse.json({ success: true, recordings: [] });
}

// lib/utils.ts - Helper function
export function extractStartTimeFromFilename(filename: string): Date {
  // Pattern: YYYY-MM-DD_HH-MM-SS.ext
  // Example: 2025-11-10_14-33-23.mp3
  const pattern = /(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/;
  const match = filename.match(pattern);
  
  if (!match) {
    throw new Error(
      `Invalid filename format: ${filename}. Expected: YYYY-MM-DD_HH-MM-SS.ext`
    );
  }
  
  // Convert: "2025-11-10_14-33-23" -> "2025-11-10 14:33:23"
  const timestampStr = match[1].replace('_', ' ').replace(/-/g, ':', 2);
  return new Date(timestampStr);
}
```

---

## 5. Processing Pipeline

### 5.1 Workflow

```
1. File Upload (Next.js API)
   ↓
2. Extract Timestamp from Filename
   ↓
3. Create Job Document in MongoDB
   ↓
4. Python Worker Picks Up Job
   ↓
5. Speaker Diarization (pyannote.audio - CPU)
   - Detect who spoke when
   - Create speaker segments
   - Update progress: 0-30%
   ↓
6. Speaker Identification
   - Extract embeddings for each segment
   - Match against known speakers
   - Update progress: 30-50%
   ↓
7. Audio Segmentation
   - Extract audio for each speaker segment
   - Save individual segment files
   - Update progress: 50-60%
   ↓
8. Transcription (faster-whisper - CPU)
   - Transcribe each speaker segment
   - Create word-level timestamps
   - Update progress: 60-100%
   ↓
9. Store Results in MongoDB
   - Save segments and transcriptions
   - Update recording status
```

### 5.2 CPU Optimization Strategies

#### 5.2.1 Model Selection for CPU

```python
# Whisper model sizes and CPU performance
WHISPER_MODELS = {
    'tiny': {
        'size': '75 MB',
        'speed': '~10x realtime on CPU',
        'accuracy': 'Low',
        'recommended': 'Quick processing, acceptable quality'
    },
    'base': {
        'size': '145 MB',
        'speed': '~7x realtime on CPU',
        'accuracy': 'Medium',
        'recommended': 'Default - good balance'
    },
    'small': {
        'size': '488 MB',
        'speed': '~4x realtime on CPU',
        'accuracy': 'Good',
        'recommended': 'Better accuracy, slower'
    },
    'medium': {
        'size': '1.5 GB',
        'speed': '~2x realtime on CPU',
        'accuracy': 'Very good',
        'recommended': 'High quality, requires patience'
    }
}

# Recommended configuration for CPU
WHISPER_CONFIG = {
    'model_size': 'base',  # or 'tiny' for faster processing
    'compute_type': 'int8',  # Quantization for CPU
    'cpu_threads': 4,  # Adjust based on available cores
    'num_workers': 1  # Process one at a time on CPU
}
```

#### 5.2.2 Faster-Whisper Optimizations

```python
from faster_whisper import WhisperModel

# Optimized for CPU
model = WhisperModel(
    "base",  # or "tiny" for faster
    device="cpu",
    compute_type="int8",  # Use int8 quantization
    cpu_threads=4,  # Use multiple CPU threads
    num_workers=1  # Single worker on CPU
)

# Process with optimizations
segments, info = model.transcribe(
    audio_path,
    beam_size=1,  # Faster beam search
    best_of=1,  # Reduce candidates
    temperature=0,  # Deterministic output
    vad_filter=True,  # Voice activity detection
    vad_parameters={
        "threshold": 0.5,
        "min_speech_duration_ms": 250,
        "min_silence_duration_ms": 100
    }
)
```

#### 5.2.3 pyannote.audio CPU Configuration

```python
from pyannote.audio import Pipeline
import torch

# Force CPU usage
torch.set_num_threads(4)  # Use 4 CPU threads

# Load pipeline with CPU
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=HF_TOKEN
)

# Move to CPU explicitly
pipeline.to(torch.device("cpu"))

# Run with CPU
diarization = pipeline(
    audio_file,
    num_speakers=None,  # Auto-detect
    min_speakers=2,
    max_speakers=10
)
```

### 5.3 Timestamp Calculation

```python
# Filename format: "2025-11-10_14-33-23.mp3"
# Pattern: YYYY-MM-DD_HH-MM-SS.ext
import re
from datetime import datetime, timedelta

FILENAME_PATTERN = r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})"

def extract_start_time(filename: str) -> datetime:
    """Extract start time from filename"""
    match = re.search(FILENAME_PATTERN, filename)
    if match:
        # Replace underscores and dashes to match datetime format
        timestamp_str = match.group(1).replace('_', ' ').replace('-', ':', 2)
        # timestamp_str is now: "2025-11-10 14:33:23"
        return datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
    raise ValueError(f"Invalid filename format: {filename}")

def calculate_absolute_time(
    recording_start: datetime, 
    segment_offset_seconds: float
) -> datetime:
    """Calculate absolute timestamp for a segment"""
    return recording_start + timedelta(seconds=segment_offset_seconds)

# Example:
# File: "2025-11-10_14-33-23.mp3"
# Recording start: 2025-11-10 14:33:23
# Segment at 45.5 seconds: 2025-11-10 14:34:08.500
start_time = extract_start_time("2025-11-10_14-33-23.mp3")
segment_time = calculate_absolute_time(start_time, 45.5)
# Result: 2025-11-10 14:34:08.500000
```

### 5.4 Python Worker Implementation

```python
# worker/processor.py
import time
from pathlib import Path
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
import torch
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline
import numpy as np
import re

class AudioProcessor:
    # Filename pattern for timestamp extraction
    FILENAME_PATTERN = r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})"
    
    def __init__(self, mongodb_uri: str, hf_token: str):
        self.client = MongoClient(mongodb_uri)
        self.db = self.client['speaker_db']
        
        # Force CPU
        torch.set_num_threads(4)
        
        # Initialize models
        self.diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token
        )
        self.diarization_pipeline.to(torch.device("cpu"))
        
        self.whisper = WhisperModel(
            "base",  # Change to "tiny" for faster processing
            device="cpu",
            compute_type="int8",
            cpu_threads=4
        )
    
    def extract_start_time(self, filename: str) -> datetime:
        """Extract start time from filename format: YYYY-MM-DD_HH-MM-SS.ext"""
        match = re.search(self.FILENAME_PATTERN, filename)
        if match:
            # Convert: "2025-11-10_14-33-23" -> "2025-11-10 14:33:23"
            timestamp_str = match.group(1).replace('_', ' ').replace('-', ':', 2)
            return datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
        raise ValueError(f"Invalid filename format: {filename}. Expected: YYYY-MM-DD_HH-MM-SS.ext")
    
    def update_job_progress(
        self, 
        job_id: str, 
        progress: int, 
        status: str = "running"
    ):
        """Update job progress in MongoDB"""
        self.db.processingJobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "progress": progress,
                    "status": status,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
    
    def process_recording(self, job_id: str):
        """Main processing function"""
        try:
            # Get job details
            job = self.db.processingJobs.find_one({"_id": ObjectId(job_id)})
            recording = self.db.recordings.find_one(
                {"_id": ObjectId(job['recordingId'])}
            )
            
            # Extract start time from filename
            recording_start = self.extract_start_time(recording['filename'])
            
            # Update recording with start time if not already set
            if 'startTime' not in recording or recording['startTime'] is None:
                self.db.recordings.update_one(
                    {"_id": recording['_id']},
                    {"$set": {"startTime": recording_start}}
                )
                recording['startTime'] = recording_start
            
            # Update status
            self.update_job_progress(job_id, 0, "running")
            
            # Step 1: Diarization (0-30%)
            print("Starting diarization...")
            diarization = self.diarization_pipeline(recording['filePath'])
            self.update_job_progress(job_id, 30)
            
            # Step 2: Identification (30-50%)
            print("Identifying speakers...")
            segments = self.identify_speakers(
                recording, 
                diarization
            )
            self.update_job_progress(job_id, 50)
            
            # Step 3: Extract segments (50-60%)
            print("Extracting audio segments...")
            self.extract_audio_segments(recording, segments)
            self.update_job_progress(job_id, 60)
            
            # Step 4: Transcription (60-100%)
            print("Transcribing segments...")
            self.transcribe_segments(
                recording, 
                segments, 
                job_id, 
                start_progress=60, 
                end_progress=100
            )
            
            # Update final status
            self.update_job_progress(job_id, 100, "completed")
            self.db.recordings.update_one(
                {"_id": recording['_id']},
                {"$set": {"status": "completed", "progress": 100}}
            )
            
        except Exception as e:
            print(f"Error processing job {job_id}: {str(e)}")
            self.update_job_progress(job_id, 0, "failed")
            self.db.processingJobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"errorMessage": str(e)}}
            )
            raise
    
    def transcribe_segments(
        self, 
        recording, 
        segments, 
        job_id, 
        start_progress=60, 
        end_progress=100
    ):
        """Transcribe all segments with progress updates"""
        total_segments = len(segments)
        progress_range = end_progress - start_progress
        
        for idx, segment in enumerate(segments):
            # Transcribe segment
            result, info = self.whisper.transcribe(
                segment['segmentAudioPath'],
                beam_size=1,
                best_of=1,
                vad_filter=True
            )
            
            # Collect transcription
            transcription_segments = []
            full_text = []
            
            for seg in result:
                transcription_segments.append({
                    "startOffset": seg.start,
                    "endOffset": seg.end,
                    "text": seg.text.strip(),
                    "confidence": 0.0  # faster-whisper doesn't provide confidence
                })
                full_text.append(seg.text.strip())
            
            # Update segment in MongoDB
            self.db.speakerSegments.update_one(
                {"_id": segment['_id']},
                {
                    "$set": {
                        "transcription": " ".join(full_text),
                        "transcriptionSegments": transcription_segments
                    }
                }
            )
            
            # Update progress
            current_progress = start_progress + int(
                (idx + 1) / total_segments * progress_range
            )
            self.update_job_progress(job_id, current_progress)
    
    def identify_speakers(self, recording, diarization):
        """Identify speakers and create segment documents"""
        segments = []
        recording_start = recording['startTime']
        
        for turn, _, speaker_label in diarization.itertracks(yield_label=True):
            # Calculate absolute timestamps
            start_time = recording_start + timedelta(seconds=turn.start)
            end_time = recording_start + timedelta(seconds=turn.end)
            
            segment = {
                "recordingId": recording['_id'],
                "speakerLabel": speaker_label,
                "startTime": start_time,
                "endTime": end_time,
                "durationSeconds": turn.end - turn.start,
                "createdAt": datetime.utcnow()
            }
            
            # Insert into MongoDB
            result = self.db.speakerSegments.insert_one(segment)
            segment['_id'] = result.inserted_id
            segments.append(segment)
        
        return segments
    
    def extract_audio_segments(self, recording, segments):
        """Extract audio files for each segment"""
        import soundfile as sf
        import librosa
        
        # Load full audio
        audio, sr = librosa.load(recording['filePath'], sr=16000)
        
        for segment in segments:
            # Calculate sample positions
            recording_start = recording['startTime']
            offset_seconds = (
                segment['startTime'] - recording_start
            ).total_seconds()
            
            start_sample = int(offset_seconds * sr)
            end_sample = int(
                start_sample + segment['durationSeconds'] * sr
            )
            
            # Extract segment
            segment_audio = audio[start_sample:end_sample]
            
            # Save segment
            segment_path = (
                f"/storage/segments/"
                f"{recording['_id']}_{segment['_id']}.wav"
            )
            sf.write(segment_path, segment_audio, sr)
            
            # Update MongoDB
            self.db.speakerSegments.update_one(
                {"_id": segment['_id']},
                {"$set": {"segmentAudioPath": segment_path}}
            )
            segment['segmentAudioPath'] = segment_path

# Job queue worker
def worker_loop():
    """Main worker loop - polls MongoDB for jobs"""
    processor = AudioProcessor(
        mongodb_uri="mongodb://mongo:27017",
        hf_token=os.getenv("HF_TOKEN")
    )
    
    while True:
        # Find pending job
        job = processor.db.processingJobs.find_one_and_update(
            {"status": "queued"},
            {"$set": {"status": "running", "startedAt": datetime.utcnow()}},
            sort=[("createdAt", 1)]  # FIFO
        )
        
        if job:
            print(f"Processing job: {job['_id']}")
            processor.process_recording(str(job['_id']))
        else:
            # No jobs, wait a bit
            time.sleep(5)

if __name__ == "__main__":
    worker_loop()
```

---

## 6. User Interface Design

### 6.1 Page Structure

#### 6.1.1 Dashboard / Upload Page
- **Components:**
  - File upload area (drag & drop)
  - Active jobs list with progress bars
  - Recent recordings list
  - Statistics (total recordings, processing time, etc.)

#### 6.1.2 Recordings List Page
- **Components:**
  - Searchable/filterable table
  - Columns: Filename, Start Time, Duration, Status, Actions
  - Filters: Date range, status
  - Bulk actions

#### 6.1.3 Recording Detail Page
- **Components:**
  - Audio player with waveform visualization
  - Timeline with speaker segments color-coded
  - Speaker list with filtering
  - Transcription viewer (scrollable, timestamped)
  - Segment playback controls
  - Speaker tagging interface

#### 6.1.4 Known Speakers Management Page
- **Components:**
  - List of known speakers
  - Add new speaker form
  - Speaker profile (name, sample audio, recordings where identified)
  - Edit/delete actions

### 6.2 UI Mockup - Recording Detail Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Recording: 2025-11-10_14-33-23.mp3                    [↓ Export]│
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Audio Player                                           │    │
│  │  [▶] ━━━━━━━━━━━━━●─────────────  13:45 / 45:30       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Timeline View:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 14:33:00    14:48:00    15:03:00    15:18:00    15:33:00│   │
│  │ ████████░░░░████████████░░░░░░██████████░░░░████████    │   │
│  │ Alice   Bob Alice       Bob    Alice    Bob Alice       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────┬───────────────────────────────────────┐│
│  │ Speakers           │ Transcription                         ││
│  ├────────────────────┼───────────────────────────────────────┤│
│  │ ☑ Alice (15 seg)   │ [14:33:12] Alice: Welcome everyone   ││
│  │   [🎤 Play all]    │ to today's meeting. Let's start...   ││
│  │                    │                                       ││
│  │ ☑ Bob (12 seg)     │ [14:34:45] Bob: Thanks Alice. I'd    ││
│  │   [🎤 Play all]    │ like to discuss the project timeline ││
│  │                    │                                       ││
│  │ ☐ SPEAKER_02       │ [14:36:20] Alice: That sounds good.  ││
│  │   [Tag as...]      │ What are the main milestones?        ││
│  │   [🎤 Play all]    │                                       ││
│  │                    │ [14:36:45] Bob: We have three main   ││
│  │ + Add filter       │ phases. First, the design phase...   ││
│  └────────────────────┴───────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Key Interactions

1. **Upload Flow:**
   - User drags files to upload area
   - Files appear in queue with validation status
   - Submit uploads all files
   - Redirect to dashboard with active jobs

2. **Monitoring Progress:**
   - Real-time progress bars via WebSocket
   - Click job to see detailed logs
   - Notifications on completion/failure

3. **Reviewing Transcription:**
   - Click recording to view details
   - Scroll through transcription synchronized with audio
   - Click timestamp to jump to that point
   - Filter by speaker to see only their segments

4. **Tagging Speakers:**
   - Click "Tag as..." on unknown speaker
   - Modal appears with known speakers + "Add new"
   - Select or create new speaker
   - All segments automatically updated

5. **Playing Speaker Segments:**
   - Click "Play all" to hear concatenated audio from one speaker
   - Click individual segment to play just that part
   - Visual indicator shows currently playing segment

---

## 7. Docker Deployment

### 7.1 Docker Compose Structure

```yaml
version: '3.8'

services:
  # Next.js Application (Frontend + API)
  nextjs:
    build:
      context: ./nextjs-app
      dockerfile: Dockerfile
    container_name: speaker-nextjs
    ports:
      - "3001:3001"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/speaker_db
      - STORAGE_PATH=/app/storage
      - NODE_ENV=production
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=http://localhost:3001
    volumes:
      - audio-storage:/app/storage
    depends_on:
      - mongo
    networks:
      - speaker-net
    restart: unless-stopped

  # Python Worker for Audio Processing
  worker:
    build:
      context: ./python-worker
      dockerfile: Dockerfile
    container_name: speaker-worker
    environment:
      - MONGODB_URI=mongodb://mongo:27017/speaker_db
      - STORAGE_PATH=/app/storage
      - HF_TOKEN=${HUGGINGFACE_TOKEN}
      - OMP_NUM_THREADS=4
      - MKL_NUM_THREADS=4
    volumes:
      - audio-storage:/app/storage
      - models-cache:/root/.cache
    depends_on:
      - mongo
    networks:
      - speaker-net
    restart: unless-stopped
    # CPU limits (optional)
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G

  # MongoDB Database
  mongo:
    image: mongo:7
    container_name: speaker-mongo
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=speaker_db
    volumes:
      - mongo-data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro
    networks:
      - speaker-net
    restart: unless-stopped

  # Mongo Express (Optional - for database management)
  mongo-express:
    image: mongo-express:latest
    container_name: speaker-mongo-express
    ports:
      - "8081:8081"
    environment:
      - ME_CONFIG_MONGODB_URL=mongodb://mongo:27017/
      - ME_CONFIG_BASICAUTH_USERNAME=admin
      - ME_CONFIG_BASICAUTH_PASSWORD=password
    depends_on:
      - mongo
    networks:
      - speaker-net
    restart: unless-stopped
    profiles:
      - debug

networks:
  speaker-net:
    driver: bridge

volumes:
  mongo-data:
  audio-storage:
  models-cache:
```

### 7.2 Directory Structure

```
speaker-diarization-system/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── mongo-init.js
│
├── nextjs-app/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── public/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── api/
│   │   │   ├── recordings/
│   │   │   │   ├── route.ts
│   │   │   │   ├── upload/route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── segments/route.ts
│   │   │   │       └── transcription/route.ts
│   │   │   ├── speakers/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── segments/
│   │   │   │   └── [id]/
│   │   │   │       ├── audio/route.ts
│   │   │   │       └── tag/route.ts
│   │   │   └── jobs/
│   │   │       └── [id]/
│   │   │           ├── route.ts
│   │   │           └── stream/route.ts
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── recordings/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── speakers/
│   │       └── page.tsx
│   ├── components/
│   │   ├── FileUpload.tsx
│   │   ├── ProgressTracker.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── TranscriptionViewer.tsx
│   │   ├── SpeakerList.tsx
│   │   └── Timeline.tsx
│   ├── lib/
│   │   ├── mongodb.ts
│   │   ├── storage.ts
│   │   └── utils.ts
│   └── types/
│       ├── recording.ts
│       ├── speaker.ts
│       └── job.ts
│
├── python-worker/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── worker.py
│   ├── processor.py
│   ├── models.py
│   └── utils.py
│
└── docs/
    └── API.md
```

### 7.3 Next.js Dockerfile

```dockerfile
# nextjs-app/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create storage directory
RUN mkdir -p /app/storage/recordings /app/storage/segments /app/storage/speakers
RUN chown -R nextjs:nodejs /app/storage

USER nextjs

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 7.4 Python Worker Dockerfile

```dockerfile
# python-worker/Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

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
```

### 7.5 Python Worker Requirements

```txt
# python-worker/requirements.txt
pymongo==4.6.0
torch==2.1.2
torchaudio==2.1.2
pyannote.audio==3.1.1
faster-whisper==1.0.0
soundfile==0.12.1
librosa==0.10.1
numpy==1.24.3
python-dotenv==1.0.0
```

### 7.6 Next.js Package.json

```json
{
  "name": "speaker-diarization-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "^18",
    "react-dom": "^18",
    "mongodb": "^6.3.0",
    "next-auth": "^4.24.5",
    "@tanstack/react-query": "^5.17.19",
    "wavesurfer.js": "^7.6.0",
    "date-fns": "^3.0.6",
    "clsx": "^2.1.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "eslint": "^8",
    "eslint-config-next": "14.1.0"
  }
}
```

### 7.7 MongoDB Initialization Script

```javascript
// mongo-init.js
db = db.getSiblingDB('speaker_db');

// Create collections
db.createCollection('recordings');
db.createCollection('knownSpeakers');
db.createCollection('speakerSegments');
db.createCollection('processingJobs');
db.createCollection('speakerTags');

// Create indexes
db.recordings.createIndex({ status: 1 });
db.recordings.createIndex({ startTime: -1 });
db.recordings.createIndex({ createdAt: -1 });

db.knownSpeakers.createIndex({ name: 1 }, { unique: true });

db.speakerSegments.createIndex({ recordingId: 1 });
db.speakerSegments.createIndex({ recordingId: 1, startTime: 1 });
db.speakerSegments.createIndex({ identifiedSpeakerId: 1 });
db.speakerSegments.createIndex({ startTime: 1, endTime: 1 });

db.processingJobs.createIndex({ recordingId: 1 });
db.processingJobs.createIndex({ status: 1 });
db.processingJobs.createIndex({ createdAt: -1 });

db.speakerTags.createIndex(
  { recordingId: 1, speakerLabel: 1 }, 
  { unique: true }
);

print('Database initialized successfully');
```

### 7.8 Environment Variables (.env)

```bash
# .env
# HuggingFace Token (required for pyannote.audio)
HUGGINGFACE_TOKEN=your_hf_token_here

# MongoDB
MONGODB_URI=mongodb://mongo:27017/speaker_db

# NextAuth (for authentication)
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3001

# Storage
STORAGE_PATH=/app/storage

# Node Environment
NODE_ENV=production
```

### 7.9 MongoDB Connection Library

```typescript
// lib/mongodb.ts
import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env');
}

const uri: string = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, create a new client for each request
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<{ 
  client: MongoClient; 
  db: Db 
}> {
  const client = await clientPromise;
  const db = client.db('speaker_db');
  return { client, db };
}

export default clientPromise;
```

---

## 8. Performance Considerations

### 8.1 Processing Time Estimates (CPU-only)

| Task | Time per Minute of Audio | Notes |
|------|--------------------------|-------|
| Diarization | ~30-45 seconds | CPU with 4 threads |
| Identification | ~5-10 seconds | CPU processing |
| Transcription (tiny) | ~6-10 seconds | Fastest, lower accuracy |
| Transcription (base) | ~10-15 seconds | Recommended default |
| Transcription (small) | ~20-30 seconds | Better accuracy |
| Transcription (medium) | ~40-60 seconds | High quality |
| **Total (tiny model)** | **~45-65 seconds** | Fast processing |
| **Total (base model)** | **~50-75 seconds** | **Recommended** |
| **Total (small model)** | **~60-90 seconds** | High quality |

**Example:** 
- A 60-minute recording with base model: ~50-75 minutes to process
- A 60-minute recording with tiny model: ~45-65 minutes to process

### 8.2 CPU Optimization Strategies

#### 8.2.1 Model Quantization
```python
# Use INT8 quantization for faster inference
WhisperModel(
    "base",
    device="cpu",
    compute_type="int8",  # 2-4x faster than float32
    cpu_threads=4
)
```

#### 8.2.2 Thread Configuration
```bash
# Environment variables for CPU optimization
export OMP_NUM_THREADS=4
export MKL_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=4
```

#### 8.2.3 Batch Processing Strategy
- Process segments in parallel when multiple cores available
- Use queue system to handle multiple uploads efficiently
- Prioritize shorter recordings for faster user feedback

#### 8.2.4 Model Caching
```python
# Cache models in memory to avoid reloading
class ModelCache:
    _whisper_model = None
    _diarization_pipeline = None
    
    @classmethod
    def get_whisper(cls):
        if cls._whisper_model is None:
            cls._whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        return cls._whisper_model
```

### 8.3 Storage Optimization

#### 8.3.1 Audio Format Selection
```python
# Storage size comparison per hour of audio
AUDIO_FORMATS = {
    'wav': '~600 MB/hour (uncompressed)',
    'mp3_128': '~57 MB/hour (compressed)',
    'mp3_64': '~29 MB/hour (compressed)',
    'opus': '~24 MB/hour (highly compressed)'
}

# Recommended: Store segments as MP3 or Opus
```

#### 8.3.2 Cleanup Policies
- Auto-delete recordings older than X days
- Compress or archive processed segments
- Delete temporary files after processing

### 8.4 Scalability

#### 8.4.1 Horizontal Scaling
```yaml
# Scale worker instances
docker-compose up -d --scale worker=3

# Each worker processes one recording at a time
# 3 workers = 3 concurrent recordings
```

#### 8.4.2 Resource Allocation
- **4 CPU cores**: 1-2 workers
- **8 CPU cores**: 2-4 workers  
- **16 CPU cores**: 4-8 workers
- **RAM**: 4-8 GB per worker

#### 8.4.3 Queue Management
- FIFO queue for fairness
- Priority queue for urgent recordings
- Monitor queue depth and add workers as needed

### 8.5 Expected Throughput

| Workers | CPU Cores | Concurrent Recordings | Hourly Throughput (base) |
|---------|-----------|----------------------|--------------------------|
| 1 | 4 | 1 | ~45-60 minutes of audio |
| 2 | 8 | 2 | ~90-120 minutes of audio |
| 4 | 16 | 4 | ~180-240 minutes of audio |

### 8.6 Performance Monitoring

```javascript
// Track processing metrics in MongoDB
{
  recordingId: ObjectId("..."),
  processingMetrics: {
    diarizationTime: 180.5,  // seconds
    identificationTime: 45.2,
    transcriptionTime: 520.8,
    totalTime: 746.5,
    cpuUsage: 85.3,  // percentage
    memoryUsage: 3.2  // GB
  }
}
```

---

## 9. Security Considerations

### 9.1 Authentication & Authorization
- Implement JWT-based authentication
- Role-based access control (admin, user)
- API key authentication for programmatic access

### 9.2 Data Privacy
- Encrypt audio files at rest
- Secure WebSocket connections (WSS)
- HTTPS for all API communications
- Data retention policies

### 9.3 Input Validation
- File type validation (audio only)
- File size limits
- Filename sanitization
- SQL injection prevention

### 9.4 Rate Limiting
- Upload rate limits per user
- API request rate limits
- Worker job limits

---

## 10. Testing Strategy

### 10.1 Unit Tests
- API endpoint testing
- Database operations
- Processing pipeline components
- Timestamp calculation logic

### 10.2 Integration Tests
- End-to-end processing workflow
- WebSocket communication
- File upload and storage
- Database transactions

### 10.3 Performance Tests
- Load testing with multiple simultaneous uploads
- Large file handling
- Long recording processing
- Concurrent user sessions

### 10.4 Test Data
- Sample audio files with known content
- Multi-speaker test recordings
- Edge cases (background noise, overlapping speech)

---

## 11. Deployment & Operations

### 11.1 Deployment Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd speaker-diarization-system

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings, especially HUGGINGFACE_TOKEN

# 3. Build and start services
docker-compose build
docker-compose up -d

# 4. Verify services are running
docker-compose ps

# 5. Check logs
docker-compose logs -f

# 6. Access application
# Frontend/Web UI: http://localhost:3001
# MongoDB: mongodb://localhost:27017
# Mongo Express (optional): http://localhost:8081
```

### 11.2 Monitoring

- **Logs:** 
  ```bash
  # Next.js logs
  docker-compose logs -f nextjs
  
  # Worker logs
  docker-compose logs -f worker
  
  # MongoDB logs
  docker-compose logs -f mongo
  ```

- **Metrics to Monitor:**
  - Processing queue length (jobs with status="queued")
  - Job completion rate
  - Processing time per recording
  - API response times
  - Storage usage
  - CPU/Memory usage per worker
  - Failed job rate

- **MongoDB Queries for Monitoring:**
  ```javascript
  // Check queue length
  db.processingJobs.countDocuments({ status: "queued" })
  
  // Check active jobs
  db.processingJobs.find({ status: "running" })
  
  // Average processing time
  db.processingJobs.aggregate([
    { $match: { status: "completed" } },
    { $project: { 
        duration: { 
          $subtract: ["$completedAt", "$startedAt"] 
        }
      }
    },
    { $group: { 
        _id: null, 
        avgDuration: { $avg: "$duration" }
      }
    }
  ])
  
  // Storage usage
  db.recordings.aggregate([
    { $group: { 
        _id: null, 
        totalSize: { $sum: "$fileSize" }
      }
    }
  ])
  ```

### 11.3 Backup & Recovery

- **MongoDB Backup:**
  ```bash
  # Create backup
  docker-compose exec mongo mongodump \
    --db=speaker_db \
    --out=/data/backup/$(date +%Y%m%d)
  
  # Copy backup out of container
  docker cp speaker-mongo:/data/backup ./backups/
  
  # Restore from backup
  docker-compose exec mongo mongorestore \
    --db=speaker_db \
    /data/backup/20251110/speaker_db
  ```

- **Audio Files Backup:**
  ```bash
  # Backup audio storage volume
  docker run --rm \
    -v speaker-diarization-system_audio-storage:/data \
    -v $(pwd)/backups:/backup \
    alpine tar czf /backup/audio-backup-$(date +%Y%m%d).tar.gz -C /data .
  
  # Restore audio storage
  docker run --rm \
    -v speaker-diarization-system_audio-storage:/data \
    -v $(pwd)/backups:/backup \
    alpine tar xzf /backup/audio-backup-20251110.tar.gz -C /data
  ```

### 11.4 Maintenance

- **Model Updates:**
  ```bash
  # Update to newer Whisper model
  # Edit python-worker/processor.py, change model size
  # Rebuild and restart worker
  docker-compose build worker
  docker-compose restart worker
  ```

- **Database Maintenance:**
  ```javascript
  // Cleanup old recordings (older than 90 days)
  db.recordings.deleteMany({
    createdAt: { 
      $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) 
    }
  })
  
  // Rebuild indexes
  db.recordings.reIndex()
  db.speakerSegments.reIndex()
  ```

- **Storage Cleanup:**
  ```bash
  # Create cleanup script
  docker-compose exec worker python cleanup.py --days=90
  ```

---

## 12. Future Enhancements

### 12.1 Phase 2 Features
- Real-time processing (streaming audio)
- Multi-language support
- Export formats (PDF, DOCX, subtitles)
- Search across transcriptions
- Speaker similarity clustering

### 12.2 Phase 3 Features
- Mobile app (iOS/Android)
- Integration with calendar systems
- Automatic meeting summaries
- Sentiment analysis
- Topic extraction and tagging

### 12.3 Advanced Features
- Live transcription during meetings
- Integration with video conferencing platforms
- AI-powered meeting insights
- Custom model training for specific domains
- Multi-channel audio support

---

## 13. Appendix

### 13.1 Technology Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend/Backend | Next.js 14 | React framework with API routes |
| Database | MongoDB 7 | Document database |
| ML - Diarization | pyannote.audio | Speaker separation |
| ML - Transcription | faster-whisper | Speech-to-text |
| Audio Processing | librosa, soundfile | Audio manipulation |
| Container | Docker | Deployment |
| Orchestration | Docker Compose | Multi-container management |
| Processing | CPU-optimized | INT8 quantization |

### 13.2 Dependencies

**Next.js Application (package.json):**
```json
{
  "dependencies": {
    "next": "14.1.0",
    "react": "^18",
    "react-dom": "^18",
    "mongodb": "^6.3.0",
    "next-auth": "^4.24.5",
    "@tanstack/react-query": "^5.17.19",
    "wavesurfer.js": "^7.6.0",
    "date-fns": "^3.0.6"
  }
}
```

**Python Worker (requirements.txt):**
```txt
pymongo==4.6.0
torch==2.1.2
torchaudio==2.1.2
pyannote.audio==3.1.1
faster-whisper==1.0.0
soundfile==0.12.1
librosa==0.10.1
numpy==1.24.3
python-dotenv==1.0.0
```

### 13.3 Useful Commands

```bash
# View logs
docker-compose logs -f nextjs
docker-compose logs -f worker
docker-compose logs -f mongo

# Restart services
docker-compose restart nextjs
docker-compose restart worker

# Scale workers for multiple concurrent processing
docker-compose up -d --scale worker=3

# Access MongoDB shell
docker-compose exec mongo mongosh speaker_db

# View MongoDB collections
docker-compose exec mongo mongosh speaker_db --eval "db.getCollectionNames()"

# Check queue status
docker-compose exec mongo mongosh speaker_db --eval \
  "db.processingJobs.countDocuments({status: 'queued'})"

# Database backup
docker-compose exec mongo mongodump \
  --db=speaker_db --out=/data/backup/$(date +%Y%m%d)

# Clean up old recordings (90+ days)
docker-compose exec mongo mongosh speaker_db --eval \
  "db.recordings.deleteMany({createdAt: {\$lt: new Date(Date.now() - 90*24*60*60*1000)}})"

# Check storage usage
du -sh /var/lib/docker/volumes/speaker-diarization-system_audio-storage

# View worker resource usage
docker stats speaker-worker

# Rebuild and restart after code changes
docker-compose up -d --build nextjs worker

# Test upload via API
curl -X POST http://localhost:3001/api/recordings/upload \
  -F "files=@2025-11-10_14-33-23.mp3"
```

### 13.4 HuggingFace Token Setup

To use pyannote.audio models, you need a HuggingFace token:

1. Create account at https://huggingface.co
2. Go to Settings → Access Tokens
3. Create a new token
4. Accept model terms:
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/embedding
5. Add token to `.env` file as `HUGGINGFACE_TOKEN`

### 13.5 CPU Performance Tuning

For optimal CPU performance:

```bash
# Set CPU thread count based on available cores
# In docker-compose.yml, adjust:
environment:
  - OMP_NUM_THREADS=4  # Adjust based on your CPU
  - MKL_NUM_THREADS=4

# Resource limits per worker
deploy:
  resources:
    limits:
      cpus: '4'      # 4 cores per worker
      memory: 8G     # 8GB RAM per worker
    reservations:
      cpus: '2'      # Minimum 2 cores
      memory: 4G     # Minimum 4GB RAM
```

**CPU Recommendations:**
- **Minimum:** 4 cores, 8GB RAM (1 worker, tiny/base model)
- **Recommended:** 8 cores, 16GB RAM (2 workers, base model)
- **Optimal:** 16+ cores, 32GB RAM (4+ workers, small/medium models)

Processing times scale roughly linearly with CPU cores when running multiple workers.

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-10 | Initial | Initial design document |

