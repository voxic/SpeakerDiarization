// app/api/recordings/[id]/reprocess/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const recordingId = new ObjectId(params.id);

    // Check if recording exists
    const recording = await db.collection('recordings').findOne({
      _id: recordingId
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Create new processing job
    // Preserve language and speaker count parameters from recording if they exist
    const job = {
      recordingId,
      jobType: 'full' as const,
      status: 'queued' as const,
      progress: 0,
      errorMessage: null,
      language: recording.language || null, // Preserve language from recording
      minSpeakers: recording.minSpeakers || null, // Preserve min_speakers from recording
      maxSpeakers: recording.maxSpeakers || null, // Preserve max_speakers from recording
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

    const result = await db.collection('processingJobs').insertOne(job);

    // Update recording status
    await db.collection('recordings').updateOne(
      { _id: recordingId },
      { 
        $set: { 
          status: 'processing',
          progress: 0,
          errorMessage: null
        } 
      }
    );

    return NextResponse.json({
      success: true,
      jobId: result.insertedId.toString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

