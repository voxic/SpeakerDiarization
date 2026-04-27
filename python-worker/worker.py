# worker.py
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from processor import AudioProcessor
from pymongo import MongoClient
from bson import ObjectId

# Load environment variables
load_dotenv()

def check_mongodb_connection(mongodb_uri: str, max_retries: int = 5, retry_delay: int = 5):
    """Check MongoDB connection with retries"""
    print(f"Checking MongoDB connection to {mongodb_uri}...")
    for attempt in range(1, max_retries + 1):
        try:
            client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
            # Ping the database to verify connection
            client.admin.command('ping')
            print("✓ MongoDB connection successful!")
            return client
        except Exception as e:
            if attempt < max_retries:
                print(f"✗ MongoDB connection attempt {attempt}/{max_retries} failed: {e}")
                print(f"  Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"✗ MongoDB connection failed after {max_retries} attempts: {e}")
                raise ConnectionError(f"Failed to connect to MongoDB after {max_retries} attempts: {e}")
    return None

def worker_loop():
    """Main worker loop - polls MongoDB for jobs"""
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongo:27017/speaker_db")
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    
    if not elevenlabs_api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is required")
    
    # Check MongoDB connection before proceeding
    client = check_mongodb_connection(mongodb_uri)
    db = client['speaker_db']
    
    # Get language from environment variable (optional, defaults to None for auto-detect)
    elevenlabs_language = os.getenv('ELEVENLABS_LANGUAGE', None)
    
    print("Initializing audio processor...")
    processor = AudioProcessor(mongodb_uri, elevenlabs_api_key, language=elevenlabs_language)
    print("Audio processor initialized. Starting worker loop...")
    
    while True:
        try:
            # Find pending job
            job = db.processingJobs.find_one_and_update(
                {"status": "queued"},
                {"$set": {"status": "running", "startedAt": datetime.utcnow()}},
                sort=[("createdAt", 1)]  # FIFO
            )
            
            if job:
                print(f"Processing job: {job['_id']}")
                try:
                    processor.process_recording(str(job['_id']))
                    print(f"Job {job['_id']} completed successfully")
                except Exception as e:
                    print(f"Error processing job {job['_id']}: {str(e)}")
                    import traceback
                    traceback.print_exc()
            else:
                # No jobs, wait a bit
                time.sleep(5)
        except KeyboardInterrupt:
            print("Worker interrupted. Shutting down...")
            break
        except Exception as e:
            print(f"Error in worker loop: {str(e)}")
            import traceback
            traceback.print_exc()
            time.sleep(5)

if __name__ == "__main__":
    worker_loop()
