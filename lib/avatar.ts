/**
 * Avatar gradients derived from the first character of a name, so a shop keeps
 * a stable colour identity. Shared between the conversation list and the chat
 * header so the same person is the same colour everywhere.
 */
export const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-600",
  "from-teal-500 to-cyan-600",
  "from-orange-500 to-red-500",
]

export function avatarGradient(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx]
}
