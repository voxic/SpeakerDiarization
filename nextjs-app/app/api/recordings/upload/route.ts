// app/api/recordings/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { extractStartTimeFromFilename } from '@/lib/utils';
import { saveFile } from '@/lib/storage';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const language = formData.get('language') as string | null; // Language code or null/empty for auto-detect
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const recordings = [];

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
      const recording = {
        filename: savedFilename,
        originalFilename: file.name,
        filePath,
        fileSize: buffer.length,
        durationSeconds: 0, // Will be updated after processing
        startTime,
        language: language && language.trim() !== '' ? language : null, // Store language or null for auto-detect
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

    return NextResponse.json({
      success: true,
      recordings
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

