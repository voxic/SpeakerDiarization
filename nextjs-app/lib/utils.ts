// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function extractStartTimeFromFilename(filename: string): Date {
  // Pattern: YYYY-MM-DD_HH-MM-SS.ext
  // Example: 2025-11-10_14-33-23.mp3
  const pattern = /(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/;
  const match = filename.match(pattern);
  
  if (!match) {
    throw new Error(
      `Invalid filename format: ${filename}. Expected: YYYY-MM-DD_HH-MM-SS.ext`
    );
  }
  
  // Convert: "2025-11-10_14-33-23" -> "2025-11-10 14:33:23"
  const dateTime = match[1].split('_');
  const datePart = dateTime[0]; // "2025-11-10"
  const timePart = dateTime[1].replace(/-/g, ':'); // "14:33:23"
  const timestampStr = `${datePart} ${timePart}`;
  return new Date(timestampStr);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

