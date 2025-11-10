// lib/storage.ts
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

export async function ensureDirectory(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

export async function saveFile(
  buffer: Buffer,
  filename: string,
  subdirectory: string = 'recordings'
): Promise<string> {
  const dir = join(STORAGE_PATH, subdirectory);
  await ensureDirectory(dir);
  
  const filePath = join(dir, filename);
  await writeFile(filePath, buffer);
  
  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

export function getStoragePath(): string {
  return STORAGE_PATH;
}

