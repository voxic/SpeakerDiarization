// app/api/speakers/[id]/route.ts
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
    const speaker = await db.collection('knownSpeakers').findOne({
      _id: new ObjectId(params.id)
    });

    if (!speaker) {
      return NextResponse.json(
        { error: 'Speaker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(speaker);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description } = body;

    const { db } = await connectToDatabase();
    
    const update: any = { updatedAt: new Date() };
    if (name) update.name = name;
    if (description !== undefined) update.description = description;

    const result = await db.collection('knownSpeakers').findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Speaker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
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
    const speakerId = new ObjectId(params.id);

    // Get speaker to delete files
    const speaker = await db.collection('knownSpeakers').findOne({
      _id: speakerId
    });

    if (speaker) {
      if (speaker.sampleAudioPath) {
        await deleteFile(speaker.sampleAudioPath);
      }
      if (speaker.embeddingPath) {
        await deleteFile(speaker.embeddingPath);
      }
    }

    // Delete from database
    await db.collection('knownSpeakers').deleteOne({ _id: speakerId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

