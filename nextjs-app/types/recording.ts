// types/recording.ts
export interface Recording {
  _id: string;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  durationSeconds: number;
  startTime: Date;
  language?: string | null; // Language code for transcription (null = auto-detect)
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
  language?: string | null; // Language code for transcription (null = auto-detect)
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

