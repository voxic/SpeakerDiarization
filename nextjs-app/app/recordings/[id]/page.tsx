'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDuration } from '@/lib/utils'

interface Recording {
  _id: string
  filename: string
  originalFilename: string
  status: string
  progress: number
  durationSeconds: number
  startTime: string
  segments: SpeakerSegment[]
}

interface SpeakerSegment {
  _id: string
  speakerLabel: string
  identifiedSpeakerId?: string
  startTime: string
  endTime: string
  durationSeconds: number
  transcription: string
  transcriptionSegments: any[]
}

export default function RecordingDetailPage() {
  const params = useParams()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null)

  useEffect(() => {
    fetchRecording()
    const interval = setInterval(fetchRecording, 5000)
    return () => clearInterval(interval)
  }, [params.id])

  const fetchRecording = async () => {
    try {
      const res = await fetch(`/api/recordings/${params.id}`)
      const data = await res.json()
      setRecording(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recording:', error)
      setLoading(false)
    }
  }

  const filteredSegments = recording?.segments.filter(seg => 
    !selectedSpeaker || seg.speakerLabel === selectedSpeaker
  ) || []

  const speakers = recording?.segments.reduce((acc, seg) => {
    if (!acc.includes(seg.speakerLabel)) {
      acc.push(seg.speakerLabel)
    }
    return acc
  }, [] as string[]) || []

  if (loading) {
    return <div className="container mx-auto p-8 text-white">Loading...</div>
  }

  if (!recording) {
    return <div className="container mx-auto p-8 text-white">Recording not found</div>
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link href="/recordings" className="text-link-blue hover:underline font-medium">
          ← Back to Recordings
        </Link>
      </div>

      <div className="bg-card-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">{recording.originalFilename}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className={`font-semibold ${
              recording.status === 'completed' ? 'text-green-600' :
              recording.status === 'processing' ? 'text-status-blue' :
              'text-gray-600'
            }`}>
              {recording.status}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Progress</p>
            <p className="font-semibold text-gray-900">{recording.progress}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="font-semibold text-gray-900">{formatDuration(recording.durationSeconds)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Start Time</p>
            <p className="font-semibold text-gray-900">
              {recording.startTime 
                ? new Date(recording.startTime).toLocaleString()
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {recording.status === 'completed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-card-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Speakers</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedSpeaker(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedSpeaker === null ? 'bg-status-blue-bg text-status-blue font-medium' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  All Speakers
                </button>
                {speakers.map((speaker) => {
                  const count = recording.segments.filter(s => s.speakerLabel === speaker).length
                  return (
                    <button
                      key={speaker}
                      onClick={() => setSelectedSpeaker(speaker)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedSpeaker === speaker ? 'bg-status-blue-bg text-status-blue font-medium' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {speaker} ({count} segments)
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-card-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Transcription</h2>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredSegments.length === 0 ? (
                  <p className="text-gray-500">No segments found</p>
                ) : (
                  filteredSegments.map((segment) => (
                    <div key={segment._id} className="border-b pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-link-blue">
                          {segment.speakerLabel}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(segment.startTime).toLocaleTimeString()} - 
                          {new Date(segment.endTime).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{segment.transcription}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {recording.status === 'processing' && (
        <div className="bg-card-white rounded-lg shadow p-6">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mb-4"></div>
            <p className="text-lg text-gray-900">Processing recording...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
              <div 
                className="bg-primary-blue h-2 rounded-full transition-all" 
                style={{ width: `${recording.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">{recording.progress}%</p>
          </div>
        </div>
      )}
    </div>
  )
}

