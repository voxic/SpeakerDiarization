import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const { db } = await connectToDatabase();

    const meetings = await db
      .collection('meetings')
      .find({})
      .sort({ scheduledAt: -1 })
      .limit(limit)
      .toArray();

    const meetingIds = meetings.map((meeting) => meeting._id);
    const recordingsByMeeting: Record<string, any[]> = {};

    if (meetingIds.length > 0) {
      const recordings = await db
        .collection('recordings')
        .find({ meetingId: { $in: meetingIds } })
        .sort({ createdAt: -1 })
        .toArray();

      recordings.forEach((recording) => {
        if (!recording.meetingId) {
          return;
        }
        const key = recording.meetingId.toString();
        if (!recordingsByMeeting[key]) {
          recordingsByMeeting[key] = [];
        }
        recordingsByMeeting[key].push({
          _id: recording._id.toString(),
          originalFilename: recording.originalFilename,
          status: recording.status,
          progress: recording.progress,
          durationSeconds: recording.durationSeconds,
          createdAt: recording.createdAt,
        });
      });
    }

    return NextResponse.json({
      meetings: meetings.map((meeting) => ({
        ...meeting,
        _id: meeting._id.toString(),
        recordings: recordingsByMeeting[meeting._id.toString()] || [],
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

