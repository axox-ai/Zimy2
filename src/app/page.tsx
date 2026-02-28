'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Users, Shield, Zap, Monitor, MessageSquare } from 'lucide-react'

function generateMeetingId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const part = (len: number) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${part(3)}-${part(4)}-${part(3)}`
}

export default function Home() {
  const router = useRouter()
  const [meetingCode, setMeetingCode] = useState('')
  const [userName, setUserName] = useState('')

  const handleNewMeeting = () => {
    const id = generateMeetingId()
    const name = userName.trim() || 'Guest'
    router.push(`/meeting/${id}?name=${encodeURIComponent(name)}`)
  }

  const handleJoinMeeting = () => {
    if (!meetingCode.trim()) return
    const name = userName.trim() || 'Guest'
    router.push(`/meeting/${meetingCode.trim()}?name=${encodeURIComponent(name)}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Video className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Zimy2
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-gray-400 text-sm">
            <span className="hover:text-white cursor-pointer transition-colors">Features</span>
            <span className="hover:text-white cursor-pointer transition-colors">Security</span>
            <span className="hover:text-white cursor-pointer transition-colors">Pricing</span>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            HD Video Meetings.
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Free for everyone.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Connect with anyone, anywhere. Crystal-clear video, zero lag, and features that 
            make every meeting better than the last.
          </p>
        </div>

        <div className="max-w-xl mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-20">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Your name (optional)</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            
            <button
              onClick={handleNewMeeting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-lg"
            >
              <Video className="w-5 h-5" />
              New Meeting
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter meeting code (e.g. abc-defg-hij)"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                onClick={handleJoinMeeting}
                disabled={!meetingCode.trim()}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition-all duration-200"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: 'Ultra-Low Latency', desc: 'Real-time video and audio with near-zero delay for natural conversations.' },
            { icon: Shield, title: 'End-to-End Encrypted', desc: 'Your meetings are private and secure with enterprise-grade encryption.' },
            { icon: Monitor, title: 'Screen Sharing', desc: 'Share your screen, a window, or a tab with a single click.' },
            { icon: MessageSquare, title: 'In-Meeting Chat', desc: 'Send messages, links, and reactions without interrupting the call.' },
            { icon: Users, title: 'Up to 100 Participants', desc: 'Host large team meetings, webinars, or virtual events with ease.' },
            { icon: Video, title: 'HD Video Quality', desc: '1080p video quality on supported devices and connections.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
              <div className="bg-blue-600/20 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        © 2024 Zimy2. Better meetings for everyone.
      </footer>
    </div>
  )
}
