# Build Summary

This document summarizes what has been built for the Speaker Diarization & Transcription System.

## Project Structure

```
speaker-diarization-system/
├── docker-compose.yml          # Docker orchestration
├── .env.example                # Environment template
├── mongo-init.js               # MongoDB initialization
├── README.md                   # Main documentation
├── QUICKSTART.md              # Quick start guide
├── .gitignore                 # Git ignore rules
│
├── nextjs-app/                # Next.js frontend/backend
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   ├── globals.css        # Global styles
│   │   ├── dashboard/         # Dashboard page
│   │   ├── recordings/        # Recording pages
│   │   ├── speakers/          # Speaker management
│   │   └── api/               # API routes
│   │       ├── recordings/   # Recording endpoints
│   │       ├── speakers/      # Speaker endpoints
│   │       ├── segments/     # Segment endpoints
│   │       └── jobs/         # Job endpoints
│   ├── lib/
│   │   ├── mongodb.ts        # MongoDB connection
│   │   ├── storage.ts        # File storage utilities
│   │   └── utils.ts          # Helper functions
│   └── types/
│       └── recording.ts      # TypeScript types
│
└── python-worker/            # Python audio processor
    ├── Dockerfile
    ├── requirements.txt
    ├── worker.py             # Worker main loop
    └── processor.py          # Audio processing logic (uses ElevenLabs API)
```

## Components Built

### 1. Next.js Application

**Frontend Pages:**
- Home page (`/`) - Navigation hub
- Dashboard (`/dashboard`) - Overview with recent recordings
- Recordings list (`/recordings`) - All recordings with filters
- Recording detail (`/recordings/[id]`) - Detailed view with transcription
- Upload page (`/recordings/upload`) - File upload interface
- Speakers page (`/speakers`) - Manage known speakers

**API Routes:**
- `GET/POST /api/recordings` - List/create recordings
- `POST /api/recordings/upload` - Upload audio files
- `GET/DELETE /api/recordings/[id]` - Get/delete recording
- `GET /api/recordings/[id]/segments` - Get segments
- `GET /api/recordings/[id]/transcription` - Get transcription (JSON/TXT/SRT/VTT)
- `POST /api/recordings/[id]/reprocess` - Reprocess recording
- `GET/POST /api/speakers` - List/create speakers
- `GET/PUT/DELETE /api/speakers/[id]` - Speaker operations
- `GET /api/segments/[id]/audio` - Stream segment audio
- `POST /api/segments/[id]/tag` - Tag speaker
- `GET /api/jobs/[id]` - Get job status
- `GET /api/jobs/[id]/stream` - SSE stream for progress

**Features:**
- Real-time progress tracking
- File upload with drag & drop
- Transcription viewer with speaker filtering
- Responsive UI with Tailwind CSS
- TypeScript for type safety

### 2. Python Worker Service

**Components:**
- `worker.py` - Main worker loop that polls MongoDB for jobs
- `processor.py` - Audio processing pipeline:
  - Speaker diarization and transcription (ElevenLabs Speech-to-Text API)
  - Audio segment extraction
  - Progress reporting

**Processing Pipeline:**
1. Diarization & Transcription (0-70%) - ElevenLabs API handles both in one call
2. Identification (70-75%) - Create segment documents
3. Segment extraction (75-100%) - Extract audio segments for playback

**Features:**
- Cloud-based processing via ElevenLabs API
- Minimal resource requirements (2GB RAM, 2 CPUs)
- Progress reporting to MongoDB
- Error handling and recovery
- Internet connectivity required for API calls

### 3. MongoDB Database

**Collections:**
- `recordings` - Recording metadata
- `knownSpeakers` - Speaker profiles
- `speakerSegments` - Segments with transcriptions
- `processingJobs` - Job queue and status
- `speakerTags` - User-assigned speaker names

**Indexes:**
- Optimized for common queries
- Status-based filtering
- Time-based sorting
- Unique constraints

### 4. Docker Configuration

**Services:**
- `nextjs` - Next.js application (port 3001)
- `worker` - Python worker service
- `mongo` - MongoDB database (port 27017)

**Volumes:**
- `mongo-data` - Database persistence
- `audio-storage` - Audio files storage

## Key Features Implemented

✅ Multi-speaker audio file upload
✅ Automatic timestamp extraction from filename
✅ Real-time progress tracking via SSE
✅ Speaker diarization and identification (via ElevenLabs)
✅ Speech-to-text transcription with timestamps (via ElevenLabs)
✅ Web UI for playback and speaker tagging
✅ Audio segment playback by speaker
✅ Multiple export formats (JSON, TXT, SRT, VTT)
✅ Docker-based deployment
✅ Cloud-based processing (no local ML models required)

## Technology Stack

- **Frontend/Backend:** Next.js 14 (React, TypeScript)
- **Database:** MongoDB 7
- **Speech Processing:** ElevenLabs Speech-to-Text API
- **Deployment:** Docker & Docker Compose

## Next Steps

1. **First Run:**
   - Set up `.env` file with ElevenLabs API key
   - Build and start services: `docker-compose up -d`
   - Processing is done via cloud API (no model downloads)

2. **Testing:**
   - Upload a test audio file with proper filename format
   - Monitor processing in dashboard
   - Review transcription results

3. **Customization:**
   - Adjust language settings in `.env` file
   - Modify resource limits in `docker-compose.yml` if needed
   - Customize UI styling in `nextjs-app/app/globals.css`

## Performance Notes

- **Processing Speed:** Depends on ElevenLabs API response time (typically faster than local processing)
- **Resource Requirements:** Minimal (2GB RAM, 2 CPUs)
- **Storage:** ~60MB per hour of audio (MP3)
- **Network:** Requires internet connectivity for API calls
- **API Costs:** Subject to ElevenLabs pricing/quotas

## Known Limitations

- Requires internet connectivity for processing
- Subject to ElevenLabs API quotas and rate limits
- Speaker identification requires known speaker profiles (not fully implemented)
- No authentication/authorization (add if needed)
- Single worker by default (scale with `docker-compose up -d --scale worker=3`)

## Support

Refer to:
- `README.md` - Main documentation
- `QUICKSTART.md` - Quick start guide
