import "server-only"

type IoRoom = { emit(event: string, data: unknown): void }
type IoInstance = { to(room: string): IoRoom }

function getIo(): IoInstance | null {
  return (global as unknown as { _io?: IoInstance })._io ?? null
}

export function emitToUser(userId: string, event: string, data: unknown) {
  const io = getIo()
  if (!io) return
  io.to(`user:${userId}`).emit(event, data)
}

export function emitToAll(event: string, data: unknown) {
  const io = getIo()
  if (!io) return
  io.to("broadcast").emit(event, data)
}
