// app/api/recordings/[recordingId]/segments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const speakerLabel = searchParams.get('speakerLabel');
    const identifiedSpeakerId = searchParams.get('identifiedSpeakerId');

    const { db } = await connectToDatabase();
    const query: any = { recordingId: new ObjectId(params.id) };

    if (speakerLabel) {
      query.speakerLabel = speakerLabel;
    }
    if (identifiedSpeakerId) {
      query.identifiedSpeakerId = new ObjectId(identifiedSpeakerId);
    }

    const segments = await db.collection('speakerSegments')
      .find(query)
      .sort({ startTime: 1 })
      .toArray();

    return NextResponse.json(segments);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

