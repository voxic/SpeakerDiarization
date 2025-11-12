// lib/mongodb.ts
import { MongoClient, Db } from 'mongodb';

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

function getMongoClient(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env');
  }

  const uri: string = process.env.MONGODB_URI;

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable to preserve the connection
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, create a new client for each request
    if (!clientPromise) {
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function connectToDatabase(): Promise<{ 
  client: MongoClient; 
  db: Db 
}> {
  const client = await getMongoClient();
  const db = client.db('speaker_db');
  return { client, db };
}

/**
 * Check MongoDB connection health
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export async function checkMongoConnection(): Promise<boolean> {
  try {
    const { client, db } = await connectToDatabase();
    // Ping the database to verify connection
    await db.admin().ping();
    return true;
  } catch (error) {
    console.error('MongoDB connection check failed:', error);
    return false;
  }
}

