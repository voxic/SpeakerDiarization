// app/api/recordings/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { extractStartTimeFromFilename } from '@/lib/utils';
import { saveFile } from '@/lib/storage';
import { randomUUID } from 'crypto';
import { extname } from 'path';

interface UploadedRecording {
  _id: string;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  durationSeconds: number;
  startTime: Date;
  language: string | null;
  minSpeakers: number | null;
  maxSpeakers: number | null;
  meetingId: ObjectId | null;
  meetingName: string | null;
  meetingScheduledAt: Date;
  status: 'pending' | 'processing';
  progress: number;
  errorMessage: null;
  createdAt: Date;
  updatedAt: Date;
}

export async function POST(request: NextRequest) {
  let meetingId: ObjectId | null = null;
  const recordings: UploadedRecording[] = [];
  let dbInstance: any = null;
  const cleanupMeeting = async () => {
    if (meetingId && recordings.length === 0 && dbInstance) {
      await dbInstance.collection('meetings').deleteOne({ _id: meetingId });
      meetingId = null;
    }
  };

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const language = formData.get('language') as string | null; // Language code or null/empty for auto-detect
    const minSpeakersStr = formData.get('minSpeakers') as string | null;
    const maxSpeakersStr = formData.get('maxSpeakers') as string | null;
    const meetingName = (formData.get('meetingName') as string | null)?.trim();
    const meetingDateTime = formData.get('meetingDateTime') as string | null;

    if (!meetingName) {
      return NextResponse.json(
        { error: 'Meeting name is required' },
        { status: 400 }
      );
    }

    if (!meetingDateTime) {
      return NextResponse.json(
        { error: 'Meeting date and time is required' },
        { status: 400 }
      );
    }

    const scheduledAt = new Date(meetingDateTime);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { error: 'Invalid meeting date and time' },
        { status: 400 }
      );
    }
    
    // Parse speaker counts
    let minSpeakers: number | null = null;
    let maxSpeakers: number | null = null;
    
    if (minSpeakersStr && minSpeakersStr.trim() !== '') {
      const parsed = parseInt(minSpeakersStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        minSpeakers = parsed;
      }
    }
    
    if (maxSpeakersStr && maxSpeakersStr.trim() !== '') {
      const parsed = parseInt(maxSpeakersStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        maxSpeakers = parsed;
      }
    }
    
    // Validate: max_speakers should be >= min_speakers if both are set
    if (minSpeakers !== null && maxSpeakers !== null && maxSpeakers < minSpeakers) {
      return NextResponse.json(
        { error: 'Maximum speakers must be greater than or equal to minimum speakers' },
        { status: 400 }
      );
    }
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    dbInstance = db;

    const meetingResult = await db.collection('meetings').insertOne({
      name: meetingName,
      scheduledAt,
      fileCount: files.length,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    meetingId = meetingResult.insertedId;

    for (const file of files) {
      // Validate file type
      const ext = extname(file.name).toLowerCase();
      const allowedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
      if (!allowedExtensions.includes(ext)) {
        continue; // Skip invalid files
      }

      // Read file buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Extract timestamp from filename
      let startTime: Date;
      try {
        startTime = extractStartTimeFromFilename(file.name);
      } catch (error) {
        await cleanupMeeting();
        return NextResponse.json(
          { error: `Invalid filename format: ${file.name}. Expected: YYYY-MM-DD_HH-MM-SS.ext` },
          { status: 400 }
        );
      }

      // Generate unique filename
      const uuid = randomUUID();
      const savedFilename = `${uuid}${ext}`;
      const filePath = await saveFile(buffer, savedFilename, 'recordings');

      // Create recording document
      const recording: Omit<UploadedRecording, '_id'> = {
        filename: savedFilename,
        originalFilename: file.name,
        filePath,
        fileSize: buffer.length,
        durationSeconds: 0, // Will be updated after processing
        startTime,
        language: language && language.trim() !== '' ? language : null, // Store language or null for auto-detect
        minSpeakers: minSpeakers, // Store min_speakers or null
        maxSpeakers: maxSpeakers, // Store max_speakers or null
        meetingId,
        meetingName,
        meetingScheduledAt: scheduledAt,
        status: 'pending' as const,
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('recordings').insertOne(recording);
      const recordingId = result.insertedId;

      // Create processing job
      const job = {
        recordingId,
        jobType: 'full' as const,
        status: 'queued' as const,
        progress: 0,
        errorMessage: null,
        language: language && language.trim() !== '' ? language : null, // Store language in job as well
        minSpeakers: minSpeakers, // Store min_speakers in job
        maxSpeakers: maxSpeakers, // Store max_speakers in job
        steps: [
          {
            name: 'diarization',
            status: 'queued' as const,
            progress: 0
          },
          {
            name: 'identification',
            status: 'queued' as const,
            progress: 0
          },
          {
            name: 'transcription',
            status: 'queued' as const,
            progress: 0
          }
        ],
        createdAt: new Date()
      };

      await db.collection('processingJobs').insertOne(job);

      // Update recording status
      await db.collection('recordings').updateOne(
        { _id: recordingId },
        { $set: { status: 'processing' } }
      );

      recordings.push({
        ...recording,
        _id: recordingId.toString()
      });
    }

    if (recordings.length === 0) {
      await cleanupMeeting();
      return NextResponse.json(
        { error: 'No valid files provided' },
        { status: 400 }
      );
    }

    if (meetingId) {
      await db.collection('meetings').updateOne(
        { _id: meetingId },
        { $set: { fileCount: recordings.length, updatedAt: new Date() } }
      );
    }

    return NextResponse.json({
      success: true,
      meetingId: meetingId?.toString(),
      recordings
    });
  } catch (error: any) {
    if (meetingId && recordings.length === 0 && dbInstance) {
      await dbInstance.collection('meetings').deleteOne({ _id: meetingId });
    }
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

