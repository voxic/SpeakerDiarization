// app/api/jobs/[id]/stream/route.ts
import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const { db } = await connectToDatabase();
      const jobId = new ObjectId(params.id);

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Poll for updates
      const interval = setInterval(async () => {
        try {
          const job = await db.collection('processingJobs').findOne({ _id: jobId });
          
          if (!job) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Job not found' })}\n\n`));
            clearInterval(interval);
            controller.close();
            return;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            status: job.status,
            progress: job.progress,
            steps: job.steps
          })}\n\n`));

          if (job.status === 'completed' || job.status === 'failed') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: job.status === 'completed' ? 'completed' : 'failed',
              error: job.errorMessage
            })}\n\n`));
            clearInterval(interval);
            controller.close();
          }
        } catch (error: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
          clearInterval(interval);
          controller.close();
        }
      }, 1000); // Poll every second

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

