const { createServer } = require("http")
const { Server } = require("socket.io")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const hostname = "0.0.0.0"
const port = parseInt(process.env.PORT || "5000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(handle)

  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  // Store globally so lib/socket-server.ts can emit from API routes
  global._io = io

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId
    if (userId && typeof userId === "string") {
      socket.join(`user:${userId}`)
    }

    socket.on("join", (uid) => {
      if (uid && typeof uid === "string") {
        socket.join(`user:${uid}`)
      }
    })

    socket.on("leave", (uid) => {
      if (uid && typeof uid === "string") {
        socket.leave(`user:${uid}`)
      }
    })
  })

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
