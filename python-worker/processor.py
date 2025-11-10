# worker/processor.py
import time
import os
import sys
import warnings
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
import torch
from faster_whisper import WhisperModel
import numpy as np
import re
import soundfile as sf
import librosa

# Suppress librosa and soundfile warnings about duration estimation
warnings.filterwarnings('ignore', message='.*Estimating duration from bitrate.*')
warnings.filterwarnings('ignore', category=UserWarning, module='librosa')
warnings.filterwarnings('ignore', category=UserWarning, module='soundfile')
# Suppress warnings from pyannote audio processing
warnings.filterwarnings('ignore', message='.*duration.*', category=UserWarning)
# Suppress pyannote deprecation warnings
warnings.filterwarnings('ignore', message='.*torchaudio.*deprecated.*', category=UserWarning)
warnings.filterwarnings('ignore', message='.*torchaudio._backend.*', category=UserWarning)
warnings.filterwarnings('ignore', message='.*torchaudio.backend.common.*', category=UserWarning)
warnings.filterwarnings('ignore', message='.*speechbrain.pretrained.*deprecated.*', category=UserWarning)
warnings.filterwarnings('ignore', message='.*Module.*speechbrain.*was deprecated.*', category=UserWarning)
# Suppress all UserWarnings from pyannote modules
warnings.filterwarnings('ignore', category=UserWarning, module='pyannote')

# Set environment variable to suppress soundfile warnings
os.environ['SOUNDFILE_VERBOSE'] = '0'

# Import huggingface_hub for authentication
try:
    from huggingface_hub import login
    import huggingface_hub
    HUGGINGFACE_HUB_AVAILABLE = True
except ImportError:
    HUGGINGFACE_HUB_AVAILABLE = False
    print("WARNING: huggingface_hub not available, authentication may fail")

# Import pyannote after setting up authentication
from pyannote.audio import Pipeline

class AudioProcessor:
    # Filename pattern for timestamp extraction
    FILENAME_PATTERN = r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})"
    
    def __init__(self, mongodb_uri: str, hf_token: str):
        self.client = MongoClient(mongodb_uri)
        self.db = self.client['speaker_db']
        
        if not hf_token:
            raise ValueError("HuggingFace token is required")
        
        # Set HuggingFace token as environment variable for huggingface_hub
        # This must be done BEFORE any huggingface_hub operations
        os.environ["HF_TOKEN"] = hf_token
        os.environ["HUGGINGFACE_HUB_TOKEN"] = hf_token
        
        # Authenticate with HuggingFace Hub before loading models
        print(f"Authenticating with HuggingFace (token: {hf_token[:10]}...)...")
        if HUGGINGFACE_HUB_AVAILABLE:
            try:
                # Login to HuggingFace Hub - this sets the token globally
                login(token=hf_token, add_to_git_credential=False)
                print("HuggingFace authentication successful")
            except Exception as e:
                print(f"Warning: HuggingFace login failed: {e}")
                print("Continuing with environment variable authentication...")
        else:
            print("huggingface_hub not available, using environment variables only")
        
        # Force CPU
        torch.set_num_threads(4)
        
        # Initialize models
        print("Loading diarization pipeline...")
        try:
            # Load pipeline with authentication token
            self.diarization_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token
            )
        except Exception as e:
            print(f"Failed to load diarization pipeline: {e}")
            print("\nTroubleshooting steps:")
            print("1. Verify your HuggingFace token is valid")
            print("2. Accept model terms at:")
            print("   - https://huggingface.co/pyannote/segmentation-3.0")
            print("   - https://huggingface.co/pyannote/speaker-diarization-3.1")
            print("   - https://huggingface.co/pyannote/embedding")
            raise
        
        self.diarization_pipeline.to(torch.device("cpu"))
        print("Diarization pipeline loaded")
        
        print("Loading Whisper model...")
        self.whisper = WhisperModel(
            "base",  # Change to "tiny" for faster processing
            device="cpu",
            compute_type="int8",
            cpu_threads=4
        )
        print("Whisper model loaded")
    
    def extract_start_time(self, filename: str) -> datetime:
        """Extract start time from filename format: YYYY-MM-DD_HH-MM-SS.ext"""
        match = re.search(self.FILENAME_PATTERN, filename)
        if match:
            # Convert: "2025-11-10_14-33-23" -> "2025-11-10 14:33:23"
            date_time = match.group(1).split('_')
            date_part = date_time[0]  # "2025-11-10"
            time_part = date_time[1].replace('-', ':')  # "14:33:23"
            timestamp_str = f"{date_part} {time_part}"
            return datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
        raise ValueError(f"Invalid filename format: {filename}. Expected: YYYY-MM-DD_HH-MM-SS.ext")
    
    def update_job_progress(
        self, 
        job_id: str, 
        progress: int, 
        status: str = "running",
        recording_id: ObjectId = None
    ):
        """Update job progress in MongoDB and sync to recording"""
        # Update job
        job_update = {
            "progress": progress,
            "status": status,
            "updatedAt": datetime.utcnow()
        }
        self.db.processingJobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": job_update}
        )
        
        # Also update recording progress to keep UI in sync
        if recording_id:
            self.db.recordings.update_one(
                {"_id": recording_id},
            {
                "$set": {
                    "progress": progress,
                    "status": status,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
    
    def update_job_step(
        self,
        job_id: str,
        step_name: str,
        status: str,
        progress: int = 0
    ):
        """Update a specific step in the job"""
        update_query = {
            f"steps.$[elem].status": status,
            f"steps.$[elem].progress": progress
        }
        
        if status == "running" and progress == 0:
            update_query[f"steps.$[elem].startedAt"] = datetime.utcnow()
        elif status == "completed":
            update_query[f"steps.$[elem].completedAt"] = datetime.utcnow()
            update_query[f"steps.$[elem].progress"] = 100
        
        self.db.processingJobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": update_query
            },
            array_filters=[{"elem.name": step_name}]
        )
    
    def process_recording(self, job_id: str):
        """Main processing function"""
        try:
            # Get job details
            job = self.db.processingJobs.find_one({"_id": ObjectId(job_id)})
            if not job:
                print(f"Job {job_id} not found")
                return
            
            recording = self.db.recordings.find_one(
                {"_id": ObjectId(job['recordingId'])}
            )
            if not recording:
                print(f"Recording not found for job {job_id}")
                return
            
            # Extract start time from filename
            recording_start = self.extract_start_time(recording['originalFilename'])
            
            # Update recording with start time if not already set
            if 'startTime' not in recording or recording['startTime'] is None:
                self.db.recordings.update_one(
                    {"_id": recording['_id']},
                    {"$set": {"startTime": recording_start}}
                )
                recording['startTime'] = recording_start
            
            # Store recording_id for progress updates
            recording_id = recording['_id']
            
            # Update status
            self.update_job_progress(job_id, 0, "running", recording_id)
            self.db.processingJobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"startedAt": datetime.utcnow()}}
            )
            
            # Step 1: Diarization (0-30%)
            print("=" * 60)
            print("STEP 1: Starting diarization...")
            print(f"Audio file: {recording['filePath']}")
            self.update_job_step(job_id, "diarization", "running", 0)
            self.update_job_progress(job_id, 5, "running", recording_id)  # Show initial progress
            
            # Suppress stderr output from soundfile/librosa
            stderr_buffer = StringIO()
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                with redirect_stderr(stderr_buffer):
                    print("Running diarization pipeline (this may take a while)...")
            diarization = self.diarization_pipeline(recording['filePath'])
            
            # Count segments
            segment_list = list(diarization.itertracks())
            num_segments = len(segment_list)
            print(f"✓ Diarization completed! Found {num_segments} speaker segments")
            self.update_job_step(job_id, "diarization", "completed", 100)
            self.update_job_progress(job_id, 30, "running", recording_id)
            
            # Step 2: Identification (30-50%)
            print("=" * 60)
            print("STEP 2: Identifying speakers and creating segments...")
            self.update_job_step(job_id, "identification", "running", 0)
            segments = self.identify_speakers(
                recording, 
                diarization,
                recording_start
            )
            print(f"✓ Created {len(segments)} segment documents in database")
            self.update_job_step(job_id, "identification", "completed", 100)
            self.update_job_progress(job_id, 50, "running", recording_id)
            
            # Step 3: Extract segments (50-60%)
            print("=" * 60)
            print("STEP 3: Extracting audio segments...")
            self.extract_audio_segments(recording, segments)
            print(f"✓ Extracted {len(segments)} audio segment files")
            self.update_job_progress(job_id, 60, "running", recording_id)
            
            # Step 4: Transcription (60-100%)
            print("=" * 60)
            print(f"STEP 4: Transcribing {len(segments)} segments...")
            self.update_job_step(job_id, "transcription", "running", 0)
            self.transcribe_segments(
                recording, 
                segments, 
                job_id, 
                start_progress=60, 
                end_progress=100,
                recording_id=recording_id
            )
            print("✓ Transcription completed for all segments")
            self.update_job_step(job_id, "transcription", "completed", 100)
            
            # Update final status
            self.update_job_progress(job_id, 100, "completed", recording_id)
            self.db.processingJobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"completedAt": datetime.utcnow()}}
            )
            self.db.recordings.update_one(
                {"_id": recording['_id']},
                {"$set": {"status": "completed", "progress": 100}}
            )
            
            print("=" * 60)
            print(f"✓✓✓ JOB COMPLETED SUCCESSFULLY ✓✓✓")
            print(f"Job ID: {job_id}")
            print(f"Recording ID: {recording['_id']}")
            print(f"Total segments processed: {len(segments)}")
            print("=" * 60)
            
        except Exception as e:
            print(f"Error processing job {job_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Try to get recording_id if available
            recording_id = None
            try:
                job = self.db.processingJobs.find_one({"_id": ObjectId(job_id)})
                if job and 'recordingId' in job:
                    recording_id = job['recordingId']
            except:
                pass
            
            self.update_job_progress(job_id, 0, "failed", recording_id)
            self.db.processingJobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {
                    "errorMessage": str(e),
                    "completedAt": datetime.utcnow()
                }}
            )
            if recording_id:
            self.db.recordings.update_one(
                    {"_id": recording_id},
                    {"$set": {"status": "failed", "errorMessage": str(e), "progress": 0}}
            )
            raise
    
    def transcribe_segments(
        self, 
        recording, 
        segments, 
        job_id, 
        start_progress=60, 
        end_progress=100,
        recording_id=None
    ):
        """Transcribe all segments with progress updates"""
        total_segments = len(segments)
        if total_segments == 0:
            return
        
        progress_range = end_progress - start_progress
        
        for idx, segment in enumerate(segments):
            if (idx + 1) % 10 == 0 or idx == 0:
                print(f"  Transcribing segment {idx + 1}/{total_segments}...")
            try:
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
                        "confidence": getattr(seg, 'probability', 0.0) if hasattr(seg, 'probability') else 0.0
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
                self.update_job_progress(job_id, current_progress, "running", recording_id)
            except Exception as e:
                print(f"Error transcribing segment {segment['_id']}: {str(e)}")
                continue
    
    def identify_speakers(self, recording, diarization, recording_start):
        """Identify speakers and create segment documents"""
        segments = []
        
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
                "confidenceScore": 0.0,  # Will be updated during identification
                "segmentAudioPath": "",  # Will be set after extraction
                "transcription": "",
                "transcriptionSegments": [],
                "createdAt": datetime.utcnow()
            }
            
            # Insert into MongoDB
            result = self.db.speakerSegments.insert_one(segment)
            segment['_id'] = result.inserted_id
            segments.append(segment)
        
        return segments
    
    def extract_audio_segments(self, recording, segments):
        """Extract audio files for each segment"""
        # Load full audio with warnings suppressed
        stderr_buffer = StringIO()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with redirect_stderr(stderr_buffer):
        audio, sr = librosa.load(recording['filePath'], sr=16000)
        
        storage_path = os.getenv('STORAGE_PATH', '/app/storage')
        segments_dir = os.path.join(storage_path, 'segments')
        os.makedirs(segments_dir, exist_ok=True)
        
        for segment in segments:
            try:
                # Calculate sample positions
                recording_start = recording['startTime']
                if isinstance(recording_start, str):
                    recording_start = datetime.fromisoformat(recording_start.replace('Z', '+00:00'))
                elif not isinstance(recording_start, datetime):
                    recording_start = datetime.fromisoformat(str(recording_start))
                
                if isinstance(segment['startTime'], str):
                    segment_start = datetime.fromisoformat(segment['startTime'].replace('Z', '+00:00'))
                else:
                    segment_start = segment['startTime']
                
                offset_seconds = (segment_start - recording_start).total_seconds()
                
                start_sample = int(offset_seconds * sr)
                end_sample = int(start_sample + segment['durationSeconds'] * sr)
                
                # Ensure we don't go out of bounds
                start_sample = max(0, min(start_sample, len(audio)))
                end_sample = max(start_sample, min(end_sample, len(audio)))
                
                # Extract segment
                segment_audio = audio[start_sample:end_sample]
                
                # Save segment
                segment_path = os.path.join(
                    segments_dir,
                    f"{recording['_id']}_{segment['_id']}.wav"
                )
                sf.write(segment_path, segment_audio, sr)
                
                # Update MongoDB
                self.db.speakerSegments.update_one(
                    {"_id": segment['_id']},
                    {"$set": {"segmentAudioPath": segment_path}}
                )
                segment['segmentAudioPath'] = segment_path
            except Exception as e:
                print(f"Error extracting segment {segment['_id']}: {str(e)}")
                continue

