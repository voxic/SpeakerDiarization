# worker/processor.py
import time
import os
import sys
import warnings
from contextlib import redirect_stderr
from io import StringIO, BytesIO
from pathlib import Path
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
import numpy as np
import re
import soundfile as sf
import librosa
from elevenlabs.client import ElevenLabs

# Suppress librosa and soundfile warnings about duration estimation
warnings.filterwarnings('ignore', message='.*Estimating duration from bitrate.*')
warnings.filterwarnings('ignore', category=UserWarning, module='librosa')
warnings.filterwarnings('ignore', category=UserWarning, module='soundfile')
# Set environment variable to suppress soundfile warnings
os.environ['SOUNDFILE_VERBOSE'] = '0'

class AudioProcessor:
    # Filename pattern for timestamp extraction
    FILENAME_PATTERN = r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})"

    def __init__(self, mongodb_uri: str, elevenlabs_api_key: str, language: str = None):
        print(f"Connecting to MongoDB at {mongodb_uri}...", flush=True)
        self.client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        self.db = self.client['speaker_db']
        
        # Verify MongoDB connection
        try:
            self.client.admin.command('ping')
            print("✓ MongoDB connection verified in AudioProcessor", flush=True)
        except Exception as e:
            raise ConnectionError(f"Failed to connect to MongoDB in AudioProcessor: {e}")
        
        if not elevenlabs_api_key:
            raise ValueError("ElevenLabs API key is required")
        
        # Initialize ElevenLabs client
        print(f"Initializing ElevenLabs client...", flush=True)
        self.elevenlabs = ElevenLabs(api_key=elevenlabs_api_key)
        print("✓ ElevenLabs client initialized", flush=True)
        
        # Get language from environment variable if not provided
        if language is None:
            language = os.getenv('ELEVENLABS_LANGUAGE', None)
        
        # Store language for transcription (None = auto-detect)
        # ElevenLabs uses language codes like "eng", "es", "fr", etc.
        self.language = language
        if self.language:
            print(f"Transcription language locked to: {self.language}", flush=True)
        else:
            print("Transcription language: auto-detect", flush=True)
    
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
            print(f"\n{'='*60}", flush=True)
            print(f"Starting processing for job: {job_id}", flush=True)
            print(f"{'='*60}\n", flush=True)
            
            job = self.db.processingJobs.find_one({"_id": ObjectId(job_id)})
            if not job:
                print(f"Job {job_id} not found", flush=True)
                return
            
            recording = self.db.recordings.find_one(
                {"_id": ObjectId(job['recordingId'])}
            )
            if not recording:
                print(f"Recording not found for job {job_id}", flush=True)
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
            
            # Get language from job, recording, or fall back to instance default (from env var)
            # Priority: job.language > recording.language > self.language (env var)
            transcription_language = None
            if job.get('language'):
                transcription_language = job['language']
            elif recording.get('language'):
                transcription_language = recording['language']
            else:
                transcription_language = self.language  # Falls back to env var or None
            
            # Convert language code if needed (ElevenLabs uses "eng" for English, etc.)
            # Map common codes: "en" -> "eng", "es" -> "es", etc.
            if transcription_language:
                language_map = {
                    "en": "eng",
                    "es": "es",
                    "fr": "fr",
                    "de": "de",
                    "it": "it",
                    "pt": "pt",
                    "ru": "ru",
                    "ja": "ja",
                    "zh": "zh",
                    "ar": "ar"
                }
                transcription_language = language_map.get(transcription_language.lower(), transcription_language.lower())
                print(f"Transcription language: {transcription_language} (from {'job' if job.get('language') else 'recording' if recording.get('language') else 'environment'})", flush=True)
            else:
                print("Transcription language: auto-detect", flush=True)
            
            # Get maxSpeakers from job or recording (for num_speakers API parameter)
            # Priority: job.maxSpeakers > recording.maxSpeakers
            max_speakers = None
            if job.get('maxSpeakers') is not None:
                max_speakers = job['maxSpeakers']
            elif recording.get('maxSpeakers') is not None:
                max_speakers = recording['maxSpeakers']
            
            if max_speakers is not None:
                # Ensure it's within valid range (1-32 per API spec)
                max_speakers = max(1, min(32, int(max_speakers)))
                print(f"Speaker count hint: max {max_speakers} speakers", flush=True)
            else:
                print("Speaker count: auto-detect", flush=True)
            
            # Update status
            self.update_job_progress(job_id, 0, "running", recording_id)
            self.db.processingJobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"startedAt": datetime.utcnow()}}
            )
            
            # Step 1: Diarization & Transcription (0-70%)
            # ElevenLabs API handles both diarization and transcription in one call
            print("=" * 60, flush=True)
            print("STEP 1: Starting diarization and transcription with ElevenLabs...", flush=True)
            print(f"Audio file: {recording['filePath']}", flush=True)
            self.update_job_step(job_id, "diarization", "running", 0)
            self.update_job_progress(job_id, 5, "running", recording_id)
            
            # Read audio file
            print("Reading audio file...", flush=True)
            with open(recording['filePath'], 'rb') as f:
                audio_bytes = f.read()
            
            audio_data = BytesIO(audio_bytes)
            # Reset position to start (important for BytesIO)
            audio_data.seek(0)
            
            # Call ElevenLabs API
            print("Calling ElevenLabs Speech-to-Text API (this may take a while)...", flush=True)
            self.update_job_progress(job_id, 10, "running", recording_id)
            
            # Build transcription parameters according to ElevenLabs API spec:
            # https://elevenlabs.io/docs/api-reference/speech-to-text/convert
            transcription_params = {
                "file": audio_data,
                "model_id": "scribe_v2",  # Required: scribe_v1 or scribe_v2
                "tag_audio_events": True,  # Tag audio events like (laughter), (footsteps), etc.
                "diarize": True,  # Enable speaker diarization
                "timestamps_granularity": "word",  # word-level timestamps (default, but explicit)
            }
            
            # Optional: language code (ISO-639-1 or ISO-639-3)
            if transcription_language:
                transcription_params["language_code"] = transcription_language
            
            # Optional: num_speakers - The maximum amount of speakers (1-32)
            # Can help with diarization accuracy when known
            if max_speakers is not None:
                transcription_params["num_speakers"] = max_speakers
            
            transcription_result = self.elevenlabs.speech_to_text.convert(**transcription_params)
            
            print("✓ ElevenLabs API call completed", flush=True)
            self.update_job_progress(job_id, 40, "running", recording_id)
            
            # Parse transcription result
            print("Parsing transcription results...", flush=True)
            segments = self.parse_elevenlabs_transcription(
                transcription_result,
                recording,
                recording_start
            )
            
            print(f"✓ Parsed {len(segments)} speaker segments", flush=True)
            self.update_job_step(job_id, "diarization", "completed", 100)
            self.update_job_step(job_id, "transcription", "completed", 100)
            self.update_job_progress(job_id, 70, "running", recording_id)
            
            # Step 2: Identification (70-75%)
            print("=" * 60, flush=True)
            print("STEP 2: Creating segment documents...", flush=True)
            self.update_job_step(job_id, "identification", "running", 0)
            # Segments are already created in parse_elevenlabs_transcription
            print(f"✓ Created {len(segments)} segment documents in database", flush=True)
            self.update_job_step(job_id, "identification", "completed", 100)
            self.update_job_progress(job_id, 75, "running", recording_id)
            
            # Step 3: Extract segments (75-100%)
            print("=" * 60, flush=True)
            print("STEP 3: Extracting audio segments...", flush=True)
            self.extract_audio_segments(recording, segments)
            print(f"✓ Extracted {len(segments)} audio segment files", flush=True)
            self.update_job_progress(job_id, 100, "running", recording_id)
            
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
            
            print("=" * 60, flush=True)
            print(f"✓✓✓ JOB COMPLETED SUCCESSFULLY ✓✓✓", flush=True)
            print(f"Job ID: {job_id}", flush=True)
            print(f"Recording ID: {recording['_id']}", flush=True)
            print(f"Total segments processed: {len(segments)}", flush=True)
            print("=" * 60, flush=True)
            
        except Exception as e:
            print(f"Error processing job {job_id}: {str(e)}", flush=True)
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
    
    def parse_elevenlabs_transcription(self, transcription_result, recording, recording_start):
        """
        Parse ElevenLabs transcription result and create segment documents.
        
        According to ElevenLabs API spec, the response can be:
        1. Single-channel: SpeechToTextChunkResponseModel with words directly
        2. Multi-channel: MultichannelSpeechToTextResponseModel with transcripts array
        
        Each word has: text, start, end, type, speaker_id, logprob, characters
        """
        segments = []
        
        # Handle multi-channel response (has 'transcripts' array)
        transcripts = []
        if hasattr(transcription_result, 'transcripts'):
            transcripts = transcription_result.transcripts
        elif isinstance(transcription_result, dict) and 'transcripts' in transcription_result:
            transcripts = transcription_result['transcripts']
        
        if transcripts:
            # Multi-channel audio: process each channel's transcript
            print(f"Multi-channel audio detected: {len(transcripts)} channels", flush=True)
            for idx, transcript in enumerate(transcripts):
                print(f"Processing channel {idx}...", flush=True)
                words = self._extract_words_from_transcript(transcript)
                if words:
                    channel_segments = self._create_segments_from_words(
                        words, recording, recording_start
                    )
                    segments.extend(channel_segments)
        else:
            # Single-channel: extract words directly from response
            words = self._extract_words_from_transcript(transcription_result)
            
            if not words:
                print("Warning: No words found in transcription result. Response structure:", flush=True)
                print(f"Type: {type(transcription_result)}", flush=True)
                if hasattr(transcription_result, '__dict__'):
                    print(f"Attributes: {transcription_result.__dict__.keys()}", flush=True)
                elif isinstance(transcription_result, dict):
                    print(f"Keys: {transcription_result.keys()}", flush=True)
                return segments
            
            segments = self._create_segments_from_words(words, recording, recording_start)
        
        return segments
    
    def _extract_words_from_transcript(self, transcript):
        """Extract words array from a transcript object (handles both dict and object formats)"""
        words = []
        
        if hasattr(transcript, 'words'):
            words = transcript.words
        elif isinstance(transcript, dict) and 'words' in transcript:
            words = transcript['words']
        else:
            # Try to access as attribute or dict key
            try:
                if hasattr(transcript, '__dict__'):
                    words = getattr(transcript, 'words', [])
                elif isinstance(transcript, dict):
                    words = transcript.get('words', [])
            except:
                pass
        
        return words
    
    def _create_segments_from_words(self, words, recording, recording_start):
        """Create segment documents from words array"""
        segments = []
        
        # Group words by speaker and create segments
        # Group consecutive words from the same speaker into segments
        current_speaker = None
        current_words = []
        current_start = None
        current_logprobs = []  # Track logprobs for confidence calculation
        
        for word in words:
            # Extract word data (handle both dict and object formats)
            # According to API spec: text, start, end, type, speaker_id, logprob, characters
            if isinstance(word, dict):
                speaker_id = word.get('speaker_id') or word.get('speaker')
                start = word.get('start')
                end = word.get('end')
                text = word.get('text') or word.get('word', '')
                word_type = word.get('type', 'word')  # 'word', 'spacing', or 'audio_event'
                logprob = word.get('logprob')  # Log probability (confidence)
            else:
                speaker_id = getattr(word, 'speaker_id', None) or getattr(word, 'speaker', None)
                start = getattr(word, 'start', None)
                end = getattr(word, 'end', None)
                text = getattr(word, 'text', None) or getattr(word, 'word', '')
                word_type = getattr(word, 'type', 'word')
                logprob = getattr(word, 'logprob', None)
            
            # Skip if missing required data
            if speaker_id is None or start is None:
                continue
            
            # Skip spacing-only words (they don't contribute to text)
            if word_type == 'spacing':
                continue
            
            # If speaker changed or gap is too large (>2 seconds), create a new segment
            if (current_speaker != speaker_id or 
                (current_start is not None and start - current_start > 2.0)):
                
                # Save previous segment if exists
                if current_speaker is not None and current_words:
                    segment_text = ' '.join([
                        w.get('text', '') if isinstance(w, dict) 
                        else getattr(w, 'text', '') or getattr(w, 'word', '') 
                        for w in current_words
                    ])
                    if segment_text.strip():
                        last_word = current_words[-1]
                        last_end = last_word.get('end') if isinstance(last_word, dict) else getattr(last_word, 'end', None)
                        segment_end = last_end if last_end else current_start + 1.0
                        
                        # Calculate average confidence from logprobs
                        # logprob is in range [-infinity, 0], higher (closer to 0) = more confident
                        avg_logprob = None
                        if current_logprobs:
                            # Filter out None values
                            valid_logprobs = [lp for lp in current_logprobs if lp is not None]
                            if valid_logprobs:
                                avg_logprob = sum(valid_logprobs) / len(valid_logprobs)
                        
                        segment = self._create_segment_document(
                            recording,
                            current_speaker,
                            recording_start,
                            current_start,
                            segment_end,
                            segment_text,
                            avg_logprob
                        )
                        segments.append(segment)
                
                # Start new segment
                current_speaker = speaker_id
                current_start = start
                current_words = [word]
                current_logprobs = [logprob] if logprob is not None else []
            else:
                # Continue current segment
                current_words.append(word)
                if logprob is not None:
                    current_logprobs.append(logprob)
        
        # Save final segment
        if current_speaker is not None and current_words:
            segment_text = ' '.join([
                w.get('text', '') if isinstance(w, dict) 
                else getattr(w, 'text', '') or getattr(w, 'word', '') 
                for w in current_words
            ])
            if segment_text.strip():
                last_word = current_words[-1]
                last_end = last_word.get('end') if isinstance(last_word, dict) else getattr(last_word, 'end', None)
                segment_end = last_end if last_end else (current_start + 1.0 if current_start else 0)
                
                # Calculate average confidence from logprobs
                avg_logprob = None
                if current_logprobs:
                    valid_logprobs = [lp for lp in current_logprobs if lp is not None]
                    if valid_logprobs:
                        avg_logprob = sum(valid_logprobs) / len(valid_logprobs)
                
                segment = self._create_segment_document(
                    recording,
                    current_speaker,
                    recording_start,
                    current_start,
                    segment_end,
                    segment_text,
                    avg_logprob
                )
                segments.append(segment)
        
        return segments
    
    
    def _create_segment_document(self, recording, speaker_label, recording_start, start_seconds, end_seconds, text, avg_logprob=None):
        """
        Create a segment document and insert into MongoDB.
        
        Args:
            avg_logprob: Average log probability from ElevenLabs API.
                        logprob is in range [-infinity, 0], higher (closer to 0) = more confident.
                        Convert to confidence score: confidence = exp(logprob) or normalize to 0-1 range.
        """
        start_time = recording_start + timedelta(seconds=start_seconds)
        end_time = recording_start + timedelta(seconds=end_seconds)
        
        # Convert logprob to confidence score (0-1 range)
        # logprob range: [-infinity, 0], where 0 = highest confidence
        # We'll normalize: confidence = (logprob + 10) / 10, clamped to [0, 1]
        # This assumes logprobs are typically in range [-10, 0]
        if avg_logprob is not None:
            # Normalize logprob to 0-1 range
            # Typical logprobs are between -10 and 0, so we'll use that range
            confidence_score = max(0.0, min(1.0, (avg_logprob + 10) / 10))
            transcription_confidence = confidence_score
        else:
            # Default confidence if logprob not available
            confidence_score = 0.0
            transcription_confidence = 0.95
        
        # Create a single transcription segment for the entire text
        # (ElevenLabs provides word-level timing, but we group by speaker segments)
        duration = end_seconds - start_seconds
        transcription_segments = [{
            "startOffset": 0.0,
            "endOffset": duration,
            "text": text,
            "confidence": transcription_confidence
        }]
        
        segment = {
            "recordingId": recording['_id'],
            "speakerLabel": str(speaker_label),
            "startTime": start_time,
            "endTime": end_time,
            "durationSeconds": end_seconds - start_seconds,
            "confidenceScore": confidence_score,
            "segmentAudioPath": "",  # Will be set after extraction
            "transcription": text,
            "transcriptionSegments": transcription_segments,
            "createdAt": datetime.utcnow()
        }
        
        # Insert into MongoDB
        result = self.db.speakerSegments.insert_one(segment)
        segment['_id'] = result.inserted_id
        
        return segment
    
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
