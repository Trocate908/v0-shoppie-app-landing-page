"use client"

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging"

/**
 * Firebase Web SDK config.
 * The non-secret values come from your Firebase Web App registration.
 * Values starting with NEXT_PUBLIC_ are intentionally exposed to the browser
 * (this is the standard, documented pattern for Firebase Web).
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let cachedApp: FirebaseApp | null = null
let cachedMessaging: Messaging | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null
  if (cachedApp) return cachedApp
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.warn("[FCM] Firebase web config missing — set NEXT_PUBLIC_FIREBASE_* env vars")
    return null
  }
  cachedApp = getApps()[0] ?? initializeApp(firebaseConfig)
  return cachedApp
}

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null
  if (cachedMessaging) return cachedMessaging
  const supported = await isSupported().catch(() => false)
  if (!supported) {
    console.warn("[FCM] Browser does not support Firebase Messaging")
    return null
  }
  const app = getFirebaseApp()
  if (!app) return null
  cachedMessaging = getMessaging(app)
  return cachedMessaging
}

/**
 * Request permission and retrieve an FCM registration token.
 * The service worker for FCM lives at /firebase-messaging-sw.js
 * (served by app/firebase-messaging-sw.js/route.ts so env vars are baked in).
 */
export async function requestFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") return null
  if (!("Notification" in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return null

  const messaging = await getMessagingInstance()
  if (!messaging) return null

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn("[FCM] Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY")
    return null
  }

  // Register the FCM service worker explicitly so we control the scope.
  let swReg: ServiceWorkerRegistration | undefined
  if ("serviceWorker" in navigator) {
    try {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      })
    } catch (err) {
      console.error("[FCM] Failed to register messaging service worker:", err)
    }
  }

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    })
    return token || null
  } catch (err) {
    console.error("[FCM] getToken error:", err)
    return null
  }
}

/**
 * Subscribe to foreground push messages (when the app is open & focused).
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(
  cb: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void,
): Promise<() => void> {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  const unsub = onMessage(messaging, (payload) => {
    cb({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data,
    })
  })
  return unsub
}
