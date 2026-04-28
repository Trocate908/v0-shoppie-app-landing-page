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

// Activate immediately on update so new SW logic takes effect.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function showRichNotification(data) {
  const title = data.title || "ShoppieApp";
  const body  = data.body  || "You have a new update";
  const image = data.image || undefined;
  const link  = data.link  || "/";
  const tag   = data.tag   || ("shoppie-" + Date.now());

  return self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    image,
    tag,
    // requireInteraction keeps the notification visible until the user
    // dismisses or clicks it — same as Facebook's web push.
    requireInteraction: true,
    // renotify ensures a new sound + vibration even if the same tag is reused.
    renotify: true,
    silent: false,
    // Strong, attention-grabbing pattern.
    vibrate: [200, 100, 200, 100, 200],
    timestamp: Date.now(),
    data: { link, ...data },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  });
}

// Background data-only messages from FCM (we send everything as \`data\` now).
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  // If for any reason the server still sent a \`notification\` payload, merge it.
  if (payload.notification) {
    if (!data.title) data.title = payload.notification.title;
    if (!data.body)  data.body  = payload.notification.body;
    if (!data.image) data.image = payload.notification.image;
  }
  showRichNotification(data);
});

// Defensive fallback: some browsers fire the raw \`push\` event instead of
// going through Firebase's onBackgroundMessage. Catch both.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { data: { title: "ShoppieApp", body: event.data.text() } };
  }
  const data = (payload && (payload.data || payload)) || {};
  if (payload && payload.notification) {
    if (!data.title) data.title = payload.notification.title;
    if (!data.body)  data.body  = payload.notification.body;
    if (!data.image) data.image = payload.notification.image;
  }
  // Don't double-show: Firebase's onBackgroundMessage handles FCM messages
  // already. We only show here if this push wasn't an FCM-shaped payload
  // (i.e. has no \`from\` field that FCM injects).
  if (payload && payload.from) return;
  event.waitUntil(showRichNotification(data));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const target = (event.notification.data && event.notification.data.link) || "/";
  const targetUrl = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Prefer an existing tab on our origin — focus it and navigate.
      for (const c of clientList) {
        try {
          const url = new URL(c.url);
          if (url.origin === self.location.origin && "focus" in c) {
            c.navigate(targetUrl).catch(() => {});
            return c.focus();
          }
        } catch {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
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
