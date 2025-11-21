'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDuration } from '@/lib/utils'

interface MeetingRecording {
  _id: string
  originalFilename: string
  status: string
  progress: number
  durationSeconds: number
  createdAt: string
}

interface Meeting {
  _id: string
  name: string
  scheduledAt: string
  fileCount?: number
  createdAt: string
  recordings: MeetingRecording[]
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/meetings?limit=50')
      const data = await res.json()
      setMeetings(data.meetings || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching meetings:', error)
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Meetings</h1>
          <p className="text-sm text-mongodb-text-muted mt-1">Every upload groups its recordings inside a meeting.</p>
        </div>
        <Link 
          href="/recordings/upload"
          className="bg-primary-blue text-white px-4 py-2 rounded-lg hover:bg-primary-blue-hover transition-colors"
        >
          Create Meeting
        </Link>
      </div>

      {loading ? (
        <div className="text-center p-8 text-white">Loading...</div>
      ) : meetings.length === 0 ? (
        <div className="bg-card-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-700 mb-4">No meetings yet.</p>
          <Link href="/recordings/upload" className="text-link-blue font-medium">
            Upload recordings to create your first meeting →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {meetings.map((meeting) => (
            <div key={meeting._id} className="bg-card-white rounded-lg shadow p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{meeting.name}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(meeting.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Files</p>
                    <p className="text-lg font-semibold text-gray-900">{meeting.fileCount ?? meeting.recordings?.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Created</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(meeting.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {meeting.recordings.length === 0 ? (
                <p className="text-sm text-gray-500">No recordings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-table-header">
                      <tr>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Filename</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Progress</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Duration</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meeting.recordings.map((recording) => (
                        <tr key={recording._id} className="border-t">
                          <td className="py-2 px-3 text-gray-900">{recording.originalFilename}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              recording.status === 'completed' ? 'bg-green-100 text-green-800' :
                              recording.status === 'processing' ? 'bg-status-blue-bg text-status-blue' :
                              recording.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {recording.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-700">{recording.progress}%</td>
                          <td className="py-2 px-3 text-gray-700">{formatDuration(recording.durationSeconds)}</td>
                          <td className="py-2 px-3">
                            <Link 
                              href={`/recordings/${recording._id}`}
                              className="text-link-blue hover:underline font-medium"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

