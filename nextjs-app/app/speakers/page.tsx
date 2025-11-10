'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Speaker {
  _id: string
  name: string
  description?: string
  createdAt: string
}

export default function SpeakersPage() {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', audioFile: null as File | null })

  useEffect(() => {
    fetchSpeakers()
  }, [])

  const fetchSpeakers = async () => {
    try {
      const res = await fetch('/api/speakers')
      const data = await res.json()
      setSpeakers(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching speakers:', error)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.audioFile) {
      alert('Name and audio file are required')
      return
    }

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('name', formData.name)
      uploadFormData.append('description', formData.description)
      uploadFormData.append('audio_file', formData.audioFile)

      const res = await fetch('/api/speakers', {
        method: 'POST',
        body: uploadFormData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add speaker')
      }

      setShowAddForm(false)
      setFormData({ name: '', description: '', audioFile: null })
      fetchSpeakers()
    } catch (error: any) {
      alert(error.message || 'Failed to add speaker')
    }
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Known Speakers</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showAddForm ? 'Cancel' : 'Add Speaker'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Speaker</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Audio Sample *</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setFormData({ ...formData, audioFile: e.target.files?.[0] || null })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Speaker
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center p-8">Loading...</div>
      ) : speakers.length === 0 ? (
        <div className="text-center p-8 text-gray-500">No speakers added yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {speakers.map((speaker) => (
            <div key={speaker._id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">{speaker.name}</h3>
              {speaker.description && (
                <p className="text-gray-600 text-sm mb-4">{speaker.description}</p>
              )}
              <p className="text-xs text-gray-400">
                Added: {new Date(speaker.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

