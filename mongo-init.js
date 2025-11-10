// mongo-init.js
db = db.getSiblingDB('speaker_db');

// Create collections
db.createCollection('recordings');
db.createCollection('knownSpeakers');
db.createCollection('speakerSegments');
db.createCollection('processingJobs');
db.createCollection('speakerTags');

// Create indexes
db.recordings.createIndex({ status: 1 });
db.recordings.createIndex({ startTime: -1 });
db.recordings.createIndex({ createdAt: -1 });

db.knownSpeakers.createIndex({ name: 1 }, { unique: true });

db.speakerSegments.createIndex({ recordingId: 1 });
db.speakerSegments.createIndex({ recordingId: 1, startTime: 1 });
db.speakerSegments.createIndex({ identifiedSpeakerId: 1 });
db.speakerSegments.createIndex({ startTime: 1, endTime: 1 });

db.processingJobs.createIndex({ recordingId: 1 });
db.processingJobs.createIndex({ status: 1 });
db.processingJobs.createIndex({ createdAt: -1 });

db.speakerTags.createIndex(
  { recordingId: 1, speakerLabel: 1 }, 
  { unique: true }
);

print('Database initialized successfully');

