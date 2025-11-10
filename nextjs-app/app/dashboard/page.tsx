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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link 
          href="/recordings/upload"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Upload Recording
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Total Recordings</h3>
          <p className="text-3xl font-bold">{recordings.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Processing</h3>
          <p className="text-3xl font-bold">
            {recordings.filter(r => r.status === 'processing').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Completed</h3>
          <p className="text-3xl font-bold">
            {recordings.filter(r => r.status === 'completed').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-xl font-semibold p-4 border-b">Recent Recordings</h2>
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : recordings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recordings yet</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Filename</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((recording) => (
                <tr key={recording._id} className="border-t">
                  <td className="px-4 py-3">{recording.originalFilename}</td>
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
                    <div className="w-full bg-gray-200 rounded-full h-2">
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
                      className="text-blue-500 hover:underline"
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

