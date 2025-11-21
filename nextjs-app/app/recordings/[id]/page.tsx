'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDuration } from '@/lib/utils'

interface SpeakerTag {
  _id: string
  recordingId: string
  speakerLabel: string
  userAssignedName: string
  createdAt: string
}

interface Recording {
  _id: string
  filename: string
  originalFilename: string
  status: string
  progress: number
  durationSeconds: number
  startTime: string
  meetingName?: string
  meetingScheduledAt?: string
  segments: SpeakerSegment[]
  speakerTags?: SpeakerTag[]
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
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({})

  const fetchRecording = useCallback(async () => {
    try {
      const res = await fetch(`/api/recordings/${params.id}`)
      const data = await res.json()
      setRecording(data)
      
      // Build speaker names map from tags
      if (data.speakerTags) {
        const namesMap: Record<string, string> = {}
        data.speakerTags.forEach((tag: SpeakerTag) => {
          namesMap[tag.speakerLabel] = tag.userAssignedName
        })
        setSpeakerNames(namesMap)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recording:', error)
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchRecording()
    const interval = setInterval(fetchRecording, 5000)
    return () => clearInterval(interval)
  }, [fetchRecording])

  const getSpeakerName = (speakerLabel: string): string => {
    return speakerNames[speakerLabel] || speakerLabel
  }

  const handleNameSpeaker = async (speakerLabel: string, name: string) => {
    if (!name.trim()) {
      setEditingSpeaker(null)
      return
    }

    try {
      // Find the first segment with this speaker label to use for tagging
      const segment = recording?.segments.find((seg: SpeakerSegment) => seg.speakerLabel === speakerLabel)
      if (!segment) return

      const res = await fetch(`/api/segments/${segment._id}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (res.ok) {
        // Update local state
        setSpeakerNames({ ...speakerNames, [speakerLabel]: name.trim() })
        setEditingSpeaker(null)
        // Refresh recording to get updated tags
        fetchRecording()
      } else {
        console.error('Failed to save speaker name')
      }
    } catch (error) {
      console.error('Error saving speaker name:', error)
    }
  }

  const filteredSegments = recording?.segments.filter((seg: SpeakerSegment) => 
    !selectedSpeaker || seg.speakerLabel === selectedSpeaker
  ) || []

  const speakers = recording?.segments.reduce((acc: string[], seg: SpeakerSegment) => {
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
        {(recording.meetingName || recording.meetingScheduledAt) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {recording.meetingName && (
              <div>
                <p className="text-sm text-gray-500">Meeting</p>
                <p className="font-semibold text-gray-900">{recording.meetingName}</p>
              </div>
            )}
            {recording.meetingScheduledAt && (
              <div>
                <p className="text-sm text-gray-500">Scheduled</p>
                <p className="font-semibold text-gray-900">
                  {new Date(recording.meetingScheduledAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
        {recording.status === 'completed' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Full Recording</h3>
            <audio 
              controls 
              className="w-full"
              src={`/api/recordings/${params.id}/audio`}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
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
                {speakers.map((speaker: string) => {
                  const count = recording.segments.filter((s: SpeakerSegment) => s.speakerLabel === speaker).length
                  const displayName = getSpeakerName(speaker)
                  const isEditing = editingSpeaker === speaker
                  
                  return (
                    <div key={speaker} className="space-y-1">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            defaultValue={speakerNames[speaker] || ''}
                            placeholder={speaker}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            autoFocus
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                handleNameSpeaker(speaker, (e.target as HTMLInputElement).value)
                              } else if (e.key === 'Escape') {
                                setEditingSpeaker(null)
                              }
                            }}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleNameSpeaker(speaker, e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <button
                            onClick={() => setSelectedSpeaker(speaker)}
                            className={`flex-1 text-left px-3 py-2 rounded-lg transition-colors ${
                              selectedSpeaker === speaker ? 'bg-status-blue-bg text-status-blue font-medium' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <div className="font-medium">{displayName}</div>
                            <div className="text-xs text-gray-500">{speaker} • {count} segments</div>
                          </button>
                          <button
                            onClick={() => setEditingSpeaker(speaker)}
                            className="opacity-0 group-hover:opacity-100 px-2 py-1 text-gray-500 hover:text-primary-blue transition-opacity"
                            title="Edit name"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
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
                  filteredSegments.map((segment: SpeakerSegment) => (
                    <div key={segment._id} className="border-b pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-link-blue">
                          {getSpeakerName(segment.speakerLabel)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(segment.startTime).toLocaleTimeString()} - 
                          {new Date(segment.endTime).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mb-2">
                        <audio 
                          controls 
                          className="w-full h-8"
                          src={`/api/segments/${segment._id}/audio`}
                        >
                          Your browser does not support the audio element.
                        </audio>
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

