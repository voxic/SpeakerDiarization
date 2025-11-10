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

def worker_loop():
    """Main worker loop - polls MongoDB for jobs"""
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongo:27017/speaker_db")
    hf_token = os.getenv("HF_TOKEN")
    
    if not hf_token:
        raise ValueError("HF_TOKEN environment variable is required")
    
    print("Initializing audio processor...")
    processor = AudioProcessor(mongodb_uri, hf_token)
    print("Audio processor initialized. Starting worker loop...")
    
    client = MongoClient(mongodb_uri)
    db = client['speaker_db']
    
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

