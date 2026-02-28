const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' }
  })

  const rooms = new Map()
  const users = new Map()

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, userName }) => {
      socket.join(roomId)
      if (!rooms.has(roomId)) rooms.set(roomId, new Set())
      rooms.get(roomId).add(socket.id)
      users.set(socket.id, { name: userName || 'Guest', roomId })

      const existingPeers = [...rooms.get(roomId)].filter(id => id !== socket.id)
      socket.emit('all-users', existingPeers.map(id => ({
        socketId: id,
        userName: users.get(id)?.name || 'Guest'
      })))

      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userName: userName || 'Guest'
      })
    })

    socket.on('sending-signal', ({ userToSignal, callerId, signal, callerName }) => {
      io.to(userToSignal).emit('user-signal', { signal, callerId, callerName })
    })

    socket.on('returning-signal', ({ callerId, signal }) => {
      io.to(callerId).emit('received-returned-signal', { signal, id: socket.id })
    })

    socket.on('chat-message', ({ roomId, message, userName }) => {
      io.to(roomId).emit('chat-message', { message, userName, timestamp: Date.now() })
    })

    socket.on('disconnect', () => {
      const userInfo = users.get(socket.id)
      if (userInfo) {
        const { roomId } = userInfo
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id)
          if (rooms.get(roomId).size === 0) rooms.delete(roomId)
        }
        socket.to(roomId).emit('user-left', socket.id)
        users.delete(socket.id)
      }
    })
  })

  const port = process.env.PORT || 3000
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
