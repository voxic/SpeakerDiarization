// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { checkMongoConnection } from '@/lib/mongodb';

export async function GET() {
  try {
    const mongoConnected = await checkMongoConnection();
    
    if (!mongoConnected) {
      return NextResponse.json(
        { 
          status: 'unhealthy', 
          mongodb: 'disconnected',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      mongodb: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        mongodb: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

