import { NextResponse } from "next/server"

/**
 * Serves the Firebase Messaging service worker at /firebase-messaging-sw.js
 * with public env values inlined. We use a Next.js route (instead of a
 * static file in /public) so the config can be configured via env vars.
 *
 * This file is a service worker, so it MUST be served with the right
 * Content-Type and Service-Worker-Allowed header for the wider scope.
 */
export const runtime = "edge"
export const revalidate = 3600

export async function GET() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  }

  const body = `// ShoppieApp — Firebase Cloud Messaging service worker
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(cfg)});

const messaging = firebase.messaging();

// When a message arrives while the page is in the background.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "ShoppieApp";
  const body  = (payload.notification && payload.notification.body)  || "You have a new update";
  const image = (payload.notification && payload.notification.image) || undefined;
  const link  = (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.link) || "/";
  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    image,
    tag: (payload.data && payload.data.tag) || undefined,
    data: { link },
    vibrate: [120, 60, 120],
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if ("focus" in c) {
          c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
`

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}
