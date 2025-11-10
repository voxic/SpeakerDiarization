import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-white">Speaker Diarization System</h1>
        <div className="space-y-4">
          <Link 
            href="/dashboard" 
            className="block p-4 border border-mongodb-border rounded-lg bg-card-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
            <p className="text-gray-600">Upload and monitor recordings</p>
          </Link>
          <Link 
            href="/recordings" 
            className="block p-4 border border-mongodb-border rounded-lg bg-card-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-2xl font-semibold text-gray-900">Recordings</h2>
            <p className="text-gray-600">View all recordings</p>
          </Link>
          <Link 
            href="/speakers" 
            className="block p-4 border border-mongodb-border rounded-lg bg-card-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-2xl font-semibold text-gray-900">Speakers</h2>
            <p className="text-gray-600">Manage known speakers</p>
          </Link>
        </div>
      </div>
    </main>
  )
}

