'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Peer from 'simple-peer'
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, Users, PhoneOff, Copy, Check,
  Send, X
} from 'lucide-react'
import { getSocket, disconnectSocket } from '@/lib/socket'

interface PeerData {
  peerId: string
  peer: Peer.Instance
  stream?: MediaStream
  userName: string
}

interface ChatMessage {
  userName: string
  message: string
  timestamp: number
  isSelf: boolean
}

interface Participant {
  socketId: string
  userName: string
}

function VideoTile({ stream, userName, muted = false, isLocal = false }: {
  stream?: MediaStream
  userName: string
  muted?: boolean
  isLocal?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative bg-gray-800 rounded-2xl overflow-hidden aspect-video flex items-center justify-center group">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-gray-300 text-sm">{userName}</span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1 text-sm text-white font-medium">
        {userName} {isLocal && '(You)'}
      </div>
    </div>
  )
}

function ControlButton({ onClick, icon, label, active = false, highlight = false }: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  active?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[64px] ${
        highlight
          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
          : active
          ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

export default function MeetingRoom() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomId = params.id as string
  const userName = searchParams.get('name') || 'Guest'

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<PeerData[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isCopied, setIsCopied] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [joinTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState('00:00')

  const peersRef = useRef<PeerData[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - joinTime) / 1000)
      const m = Math.floor(secs / 60).toString().padStart(2, '0')
      const s = (secs % 60).toString().padStart(2, '0')
      setElapsed(`${m}:${s}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [joinTime])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createPeer = useCallback((userToSignal: string, callerId: string, stream: MediaStream, callerName: string): Peer.Instance => {
    const socket = getSocket()
    const peer = new Peer({ initiator: true, trickle: false, stream })
    peer.on('signal', signal => {
      socket.emit('sending-signal', { userToSignal, callerId, signal, callerName })
    })
    return peer
  }, [])

  const addPeer = useCallback((incomingSignal: Peer.SignalData, callerId: string, stream: MediaStream): Peer.Instance => {
    const socket = getSocket()
    const peer = new Peer({ initiator: false, trickle: false, stream })
    peer.on('signal', signal => {
      socket.emit('returning-signal', { callerId, signal })
    })
    peer.signal(incomingSignal)
    return peer
  }, [])

  useEffect(() => {
    const init = async () => {
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStreamRef.current = stream
        setLocalStream(stream)
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setPermissionError('Camera and microphone access was denied. Please allow access and refresh the page.')
          } else {
            setPermissionError(`Could not access media devices: ${err.message}`)
          }
        }
      }

      const socket = getSocket()
      socket.emit('join-room', { roomId, userName })

      socket.on('all-users', (users: { socketId: string; userName: string }[]) => {
        setParticipants(users)
        if (!stream) return
        const newPeers: PeerData[] = []
        users.forEach(({ socketId, userName: peerName }) => {
          const peer = createPeer(socketId, socket.id ?? '', stream!, userName)
          const pd: PeerData = { peerId: socketId, peer, userName: peerName }
          peersRef.current.push(pd)
          newPeers.push(pd)
          peer.on('stream', (remoteStream: MediaStream) => {
            setPeers(prev => prev.map(p => p.peerId === socketId ? { ...p, stream: remoteStream } : p))
          })
        })
        setPeers(newPeers)
      })

      socket.on('user-joined', ({ socketId, userName: peerName }: { socketId: string; userName: string }) => {
        setParticipants(prev => [...prev, { socketId, userName: peerName }])
        if (!stream) return
        const peer = createPeer(socketId, socket.id ?? '', stream!, userName)
        const pd: PeerData = { peerId: socketId, peer, userName: peerName }
        peersRef.current.push(pd)
        setPeers(prev => [...prev, pd])
        peer.on('stream', (remoteStream: MediaStream) => {
          setPeers(prev => prev.map(p => p.peerId === socketId ? { ...p, stream: remoteStream } : p))
        })
      })

      socket.on('user-signal', ({ signal, callerId, callerName }: { signal: Peer.SignalData; callerId: string; callerName: string }) => {
        const existing = peersRef.current.find(p => p.peerId === callerId)
        if (existing) {
          existing.peer.signal(signal)
        } else {
          if (!stream) return
          const peer = addPeer(signal, callerId, stream!)
          const pd: PeerData = { peerId: callerId, peer, userName: callerName }
          peersRef.current.push(pd)
          setPeers(prev => [...prev, pd])
          peer.on('stream', (remoteStream: MediaStream) => {
            setPeers(prev => prev.map(p => p.peerId === callerId ? { ...p, stream: remoteStream } : p))
          })
        }
      })

      socket.on('received-returned-signal', ({ signal, id }: { signal: Peer.SignalData; id: string }) => {
        const pd = peersRef.current.find(p => p.peerId === id)
        if (pd) pd.peer.signal(signal)
      })

      socket.on('user-left', (socketId: string) => {
        const pd = peersRef.current.find(p => p.peerId === socketId)
        if (pd) pd.peer.destroy()
        peersRef.current = peersRef.current.filter(p => p.peerId !== socketId)
        setPeers(prev => prev.filter(p => p.peerId !== socketId))
        setParticipants(prev => prev.filter(p => p.socketId !== socketId))
      })

      socket.on('chat-message', ({ message, userName: senderName, timestamp }: { message: string; userName: string; timestamp: number }) => {
        setMessages(prev => [...prev, { message, userName: senderName, timestamp, isSelf: false }])
      })
    }

    init()

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      peersRef.current.forEach(pd => pd.peer.destroy())
      disconnectSocket()
    }
  }, [roomId, userName, createPeer, addPeer])

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
      setIsMuted(prev => !prev)
    }
  }

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
      setIsCameraOff(prev => !prev)
    }
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
      setIsScreenSharing(false)
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        peersRef.current.forEach(({ peer }) => {
          try {
            const pc = (peer as unknown as { _pc: RTCPeerConnection })._pc
            const sender = pc?.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'video')
            if (sender && videoTrack) sender.replaceTrack(videoTrack)
          } catch { /* ignore track replacement errors */ }
        })
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        setIsScreenSharing(true)
        const screenTrack = screenStream.getVideoTracks()[0]
        peersRef.current.forEach(({ peer }) => {
          try {
            const pc = (peer as unknown as { _pc: RTCPeerConnection })._pc
            const sender = pc?.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'video')
            if (sender) sender.replaceTrack(screenTrack)
          } catch { /* ignore track replacement errors */ }
        })
        screenTrack.onended = () => {
          setIsScreenSharing(false)
          screenStreamRef.current = null
        }
      } catch { /* user cancelled or permission denied */ }
    }
  }

  const sendMessage = () => {
    if (!chatInput.trim()) return
    const socket = getSocket()
    socket.emit('chat-message', { roomId, message: chatInput, userName })
    setMessages(prev => [...prev, { message: chatInput, userName, timestamp: Date.now(), isSelf: true }])
    setChatInput('')
  }

  const copyMeetingId = () => {
    navigator.clipboard.writeText(roomId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const leaveMeeting = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    disconnectSocket()
    router.push('/')
  }

  const totalCount = peers.length + 1
  const gridClass = totalCount === 1 ? 'grid-cols-1' : totalCount === 2 ? 'grid-cols-2' : totalCount <= 4 ? 'grid-cols-2' : 'grid-cols-3'
  const allParticipants = [{ socketId: 'self', userName }, ...participants]

  if (permissionError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-900 border border-red-800 rounded-2xl p-8 max-w-md text-center">
          <VideoOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-3">Camera/Mic Access Required</h2>
          <p className="text-gray-400 mb-6">{permissionError}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <div className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Zimy2</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-300 text-sm font-mono">{roomId}</span>
          <button onClick={copyMeetingId} className="text-gray-500 hover:text-gray-300 transition-colors">
            {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm font-mono">{elapsed}</span>
          <span className="text-gray-500 text-sm">{totalCount} participant{totalCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className={`grid ${gridClass} gap-3 h-full`}>
            <VideoTile stream={localStream ?? undefined} userName={userName} muted isLocal />
            {peers.map(pd => (
              <VideoTile key={pd.peerId} stream={pd.stream} userName={pd.userName} />
            ))}
          </div>
        </div>

        {(isChatOpen || isParticipantsOpen) && (
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => { setIsChatOpen(true); setIsParticipantsOpen(false) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${isChatOpen ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Chat
              </button>
              <button
                onClick={() => { setIsParticipantsOpen(true); setIsChatOpen(false) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${isParticipantsOpen ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                People ({allParticipants.length})
              </button>
              <button
                onClick={() => { setIsChatOpen(false); setIsParticipantsOpen(false) }}
                className="px-3 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isChatOpen && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-gray-600 text-sm text-center mt-8">No messages yet. Say hi!</p>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-gray-500 mb-1">{msg.userName}</span>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.isSelf ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
                        {msg.message}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
                <div className="p-4 border-t border-gray-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder="Send a message..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!chatInput.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white p-2 rounded-xl transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {isParticipantsOpen && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {allParticipants.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-200">
                      {p.userName} {p.socketId === 'self' && <span className="text-gray-500">(You)</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-20 bg-gray-900/80 backdrop-blur border-t border-gray-800 flex items-center justify-center gap-3 px-6 flex-shrink-0">
        <ControlButton
          onClick={toggleMute}
          icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          label={isMuted ? 'Unmute' : 'Mute'}
          active={isMuted}
        />
        <ControlButton
          onClick={toggleCamera}
          icon={isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          label={isCameraOff ? 'Start Video' : 'Stop Video'}
          active={isCameraOff}
        />
        <ControlButton
          onClick={toggleScreenShare}
          icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          active={isScreenSharing}
          highlight={isScreenSharing}
        />
        <ControlButton
          onClick={() => { setIsChatOpen(o => !o); setIsParticipantsOpen(false) }}
          icon={<MessageSquare className="w-5 h-5" />}
          label="Chat"
          active={isChatOpen}
        />
        <ControlButton
          onClick={() => { setIsParticipantsOpen(o => !o); setIsChatOpen(false) }}
          icon={<Users className="w-5 h-5" />}
          label="People"
          active={isParticipantsOpen}
        />
        <div className="w-px h-10 bg-gray-700 mx-2" />
        <button
          onClick={leaveMeeting}
          className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200"
        >
          <PhoneOff className="w-5 h-5" />
          Leave
        </button>
      </div>
    </div>
  )
}
