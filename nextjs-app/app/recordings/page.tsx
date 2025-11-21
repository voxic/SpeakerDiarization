'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatDuration, formatFileSize } from '@/lib/utils'

interface Recording {
  _id: string
  filename: string
  originalFilename: string
  status: string
  progress: number
  durationSeconds: number
  fileSize: number
  startTime: string
  createdAt: string
  meetingName?: string
  meetingScheduledAt?: string
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchRecordings = useCallback(async () => {
    try {
      const url = statusFilter 
        ? `/api/recordings?status=${statusFilter}&limit=100`
        : '/api/recordings?limit=100'
      const res = await fetch(url)
      const data = await res.json()
      setRecordings(data.recordings || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recordings:', error)
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  return (
    <div className="container mx-auto p-8">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Recordings</h1>
        <div className="flex gap-3">
          <Link 
            href="/meetings"
            className="bg-card-white text-gray-900 px-4 py-2 rounded-lg border border-mongodb-border hover:bg-gray-50 transition-colors"
          >
            View Meetings
          </Link>
          <Link 
            href="/recordings/upload"
            className="bg-primary-blue text-white px-4 py-2 rounded-lg hover:bg-primary-blue-hover transition-colors"
          >
            Upload Recording
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <label className="mr-2 text-white">Filter by status:</label>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-mongodb-border rounded-lg px-3 py-1 bg-card-white text-gray-900"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center p-8 text-white">Loading...</div>
      ) : recordings.length === 0 ? (
        <div className="text-center p-8 text-mongodb-text-muted">No recordings found</div>
      ) : (
        <div className="bg-card-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-table-header">
              <tr>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Filename</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Meeting</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Start Time</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Progress</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Duration</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Size</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((recording) => (
                <tr key={recording._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{recording.originalFilename}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {recording.meetingName ? (
                      <div>
                        <p className="font-medium text-gray-900">{recording.meetingName}</p>
                        {recording.meetingScheduledAt && (
                          <p className="text-xs text-gray-500">
                            {new Date(recording.meetingScheduledAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {recording.startTime 
                      ? new Date(recording.startTime).toLocaleString()
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                      recording.status === 'completed' ? 'bg-green-100 text-green-800' :
                      recording.status === 'processing' ? 'bg-status-blue-bg text-status-blue' :
                      recording.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {recording.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mb-1">
                      <div 
                        className="bg-primary-blue h-2 rounded-full transition-all" 
                        style={{ width: `${recording.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{recording.progress}%</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDuration(recording.durationSeconds)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatFileSize(recording.fileSize)}</td>
                  <td className="px-4 py-3">
                    <Link 
                      href={`/recordings/${recording._id}`}
                      className="text-link-blue hover:underline mr-3 font-medium"
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
  )
}

