// app/api/recordings/[id]/audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname } from 'path';

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

    if (!recording.filePath || !existsSync(recording.filePath)) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      );
    }

    const audioBuffer = await readFile(recording.filePath);
    
    // Determine content type based on file extension
    const ext = extname(recording.filePath || recording.filename || '').toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
    };
    const contentType = contentTypeMap[ext] || 'audio/mpeg';
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

