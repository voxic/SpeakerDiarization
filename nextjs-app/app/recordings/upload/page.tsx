'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Common language codes for Whisper
const LANGUAGES = [
  { code: '', label: 'Auto-detect (default)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ko', label: 'Korean' },
  { code: 'hi', label: 'Hindi' },
]

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files))
      setError(null)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) {
      setError('Please select at least one file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      
      // Add language if selected (empty string means auto-detect)
      if (language) {
        formData.append('language', language)
      }

      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-white">Upload Recording</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-mongodb-border rounded-lg p-12 text-center bg-card-white hover:border-primary-blue transition"
        >
          <input
            type="file"
            id="file-input"
            multiple
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <div className="text-4xl mb-4">📁</div>
            <p className="text-lg mb-2 text-gray-900">
              Drag and drop audio files here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Filename format: YYYY-MM-DD_HH-MM-SS.ext (e.g., 2025-11-10_14-33-23.mp3)
            </p>
          </label>
        </div>

        {files.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-gray-900">Selected files:</h3>
            <ul className="list-disc list-inside space-y-1">
              {files.map((file, idx) => (
                <li key={idx} className="text-sm text-gray-700">{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-card-white rounded-lg p-4 border border-mongodb-border">
          <label htmlFor="language" className="block text-sm font-medium text-gray-900 mb-2">
            Transcription Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Select a language to lock transcription to that language, or leave as "Auto-detect" to let Whisper automatically detect the language.
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={uploading || files.length === 0}
            className="bg-primary-blue text-white px-6 py-2 rounded-lg hover:bg-primary-blue-hover disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

