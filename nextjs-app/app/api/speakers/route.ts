// app/api/speakers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { saveFile } from '@/lib/storage';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const speakers = await db.collection('knownSpeakers')
      .find({})
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(speakers);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const audioFile = formData.get('audio_file') as File;

    if (!name || !audioFile) {
      return NextResponse.json(
        { error: 'Name and audio file are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Check if speaker already exists
    const existing = await db.collection('knownSpeakers').findOne({ name });
    if (existing) {
      return NextResponse.json(
        { error: 'Speaker with this name already exists' },
        { status: 400 }
      );
    }

    // Save audio file
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const ext = extname(audioFile.name).toLowerCase();
    const uuid = randomUUID();
    const filename = `${uuid}${ext}`;
    const sampleAudioPath = await saveFile(buffer, filename, 'speakers');

    // Create speaker document
    const speaker = {
      name,
      description: description || null,
      sampleAudioPath,
      embeddingPath: '', // Will be set after processing
      embedding: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('knownSpeakers').insertOne(speaker);

    return NextResponse.json({
      ...speaker,
      _id: result.insertedId.toString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

