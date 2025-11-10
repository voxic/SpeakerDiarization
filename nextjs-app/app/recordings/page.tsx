'use client'

import { useState, useEffect } from 'react'
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
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    fetchRecordings()
  }, [statusFilter])

  const fetchRecordings = async () => {
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
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Recordings</h1>
        <Link 
          href="/recordings/upload"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Upload Recording
        </Link>
      </div>

      <div className="mb-4">
        <label className="mr-2">Filter by status:</label>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-1"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center p-8">Loading...</div>
      ) : recordings.length === 0 ? (
        <div className="text-center p-8 text-gray-500">No recordings found</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Filename</th>
                <th className="px-4 py-3 text-left">Start Time</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((recording) => (
                <tr key={recording._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{recording.originalFilename}</td>
                  <td className="px-4 py-3">
                    {recording.startTime 
                      ? new Date(recording.startTime).toLocaleString()
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-sm ${
                      recording.status === 'completed' ? 'bg-green-100 text-green-800' :
                      recording.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      recording.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {recording.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${recording.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{recording.progress}%</span>
                  </td>
                  <td className="px-4 py-3">{formatDuration(recording.durationSeconds)}</td>
                  <td className="px-4 py-3">{formatFileSize(recording.fileSize)}</td>
                  <td className="px-4 py-3">
                    <Link 
                      href={`/recordings/${recording._id}`}
                      className="text-blue-500 hover:underline mr-3"
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

