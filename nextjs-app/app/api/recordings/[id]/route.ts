// app/api/recordings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { deleteFile } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const recording = await db.collection('recordings').findOne({
      _id: new ObjectId(params.id)
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Get segments
    const segments = await db.collection('speakerSegments')
      .find({ recordingId: new ObjectId(params.id) })
      .sort({ startTime: 1 })
      .toArray();

    // Get jobs
    const jobs = await db.collection('processingJobs')
      .find({ recordingId: new ObjectId(params.id) })
      .sort({ createdAt: -1 })
      .toArray();

    // Get speaker tags
    const speakerTags = await db.collection('speakerTags')
      .find({ recordingId: new ObjectId(params.id) })
      .toArray();

    return NextResponse.json({
      ...recording,
      segments,
      jobs,
      speakerTags
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const recordingId = new ObjectId(params.id);

    // Get recording to delete file
    const recording = await db.collection('recordings').findOne({
      _id: recordingId
    });

    if (recording) {
      // Delete audio file
      await deleteFile(recording.filePath);

      // Delete segment files
      const segments = await db.collection('speakerSegments')
        .find({ recordingId })
        .toArray();
      
      for (const segment of segments) {
        if (segment.segmentAudioPath) {
          await deleteFile(segment.segmentAudioPath);
        }
      }
    }

    // Delete from database
    await db.collection('recordings').deleteOne({ _id: recordingId });
    await db.collection('speakerSegments').deleteMany({ recordingId });
    await db.collection('processingJobs').deleteMany({ recordingId });
    await db.collection('speakerTags').deleteMany({ recordingId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

