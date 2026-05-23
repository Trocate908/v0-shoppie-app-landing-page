"use client"

import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"

let _socket: Socket | null = null

function getSocket(): Socket {
  if (!_socket) {
    _socket = io({
      path: "/api/socket",
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })
  }
  return _socket
}

export function useSocket(userId?: string | null) {
  const joined = useRef(false)

  useEffect(() => {
    if (!userId) return

    const socket = getSocket()

    if (!socket.connected) {
      socket.auth = { userId }
      socket.connect()
    }

    if (!joined.current) {
      socket.emit("join", userId)
      joined.current = true
    }

    return () => {
      // Keep socket alive across route navigations — only drop on full unmount
    }
  }, [userId])

  return getSocket()
}
