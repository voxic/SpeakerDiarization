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
  createdAt: string
}

export default function Dashboard() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecordings()
    const interval = setInterval(fetchRecordings, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchRecordings = async () => {
    try {
      const res = await fetch('/api/recordings?limit=10')
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
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <Link 
          href="/recordings/upload"
          className="bg-primary-blue text-white px-4 py-2 rounded-lg hover:bg-primary-blue-hover transition-colors"
        >
          Upload Recording
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Total Recordings</h3>
          <p className="text-3xl font-bold text-gray-900">{recordings.length}</p>
        </div>
        <div className="bg-card-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Processing</h3>
          <p className="text-3xl font-bold text-gray-900">
            {recordings.filter(r => r.status === 'processing').length}
          </p>
        </div>
        <div className="bg-card-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Completed</h3>
          <p className="text-3xl font-bold text-gray-900">
            {recordings.filter(r => r.status === 'completed').length}
          </p>
        </div>
      </div>

      <div className="bg-card-white rounded-lg shadow overflow-hidden">
        <h2 className="text-xl font-semibold p-4 border-b text-gray-800">Recent Recordings</h2>
        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading...</div>
        ) : recordings.length === 0 ? (
          <div className="p-8 text-center text-mongodb-text-muted">No recordings yet</div>
        ) : (
          <table className="w-full">
            <thead className="bg-table-header">
              <tr>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Filename</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Progress</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Duration</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Size</th>
                <th className="px-4 py-3 text-left text-gray-700 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((recording) => (
                <tr key={recording._id} className="border-t">
                  <td className="px-4 py-3 text-gray-900">{recording.originalFilename}</td>
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
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
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
                      className="text-link-blue hover:underline font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

