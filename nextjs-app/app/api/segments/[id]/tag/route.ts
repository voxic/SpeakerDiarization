// app/api/segments/[id]/tag/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Get segment
    const segment = await db.collection('speakerSegments').findOne({
      _id: new ObjectId(params.id)
    });

    if (!segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Create or update speaker tag
    await db.collection('speakerTags').updateOne(
      {
        recordingId: segment.recordingId,
        speakerLabel: segment.speakerLabel
      },
      {
        $set: {
          userAssignedName: name,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

