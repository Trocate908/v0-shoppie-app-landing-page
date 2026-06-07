"use client"

// Compatibility shim — all callers now go through use-push (native VAPID).
export { usePush as useFcm } from "@/hooks/use-push"
