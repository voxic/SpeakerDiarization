// app/api/recordings/[id]/transcription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const { db } = await connectToDatabase();
    const segments = await db.collection('speakerSegments')
      .find({ recordingId: new ObjectId(params.id) })
      .sort({ startTime: 1 })
      .toArray();

    if (format === 'txt') {
      const text = segments
        .map(seg => `[${seg.startTime.toISOString()}] ${seg.speakerLabel}: ${seg.transcription}`)
        .join('\n\n');
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (format === 'srt') {
      let srt = '';
      let index = 1;
      for (const seg of segments) {
        const start = formatSRTTime(seg.startTime);
        const end = formatSRTTime(seg.endTime);
        srt += `${index}\n${start} --> ${end}\n${seg.transcription}\n\n`;
        index++;
      }
      return new NextResponse(srt, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (format === 'vtt') {
      let vtt = 'WEBVTT\n\n';
      for (const seg of segments) {
        const start = formatVTTTime(seg.startTime);
        const end = formatVTTTime(seg.endTime);
        vtt += `${start} --> ${end}\n${seg.transcription}\n\n`;
      }
      return new NextResponse(vtt, {
        headers: { 'Content-Type': 'text/vtt' }
      });
    }

    return NextResponse.json(segments);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function formatSRTTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

function formatVTTTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

