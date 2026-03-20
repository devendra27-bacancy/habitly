/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js");

const swUrl = new URL(self.location.href);
const firebaseConfig = {
  apiKey: swUrl.searchParams.get("apiKey") || "",
  authDomain: swUrl.searchParams.get("authDomain") || "",
  projectId: swUrl.searchParams.get("projectId") || "",
  storageBucket: swUrl.searchParams.get("storageBucket") || "",
  messagingSenderId: swUrl.searchParams.get("messagingSenderId") || "",
  appId: swUrl.searchParams.get("appId") || "",
};

const hasConfig = Object.values(firebaseConfig).every(Boolean);

if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
  firebase.messaging();
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetUrl = new URL(data.link || "/", self.location.origin);
  if (data.focusDate) {
    targetUrl.searchParams.set("focusDate", data.focusDate);
  }
  if (data.focusSlotTime) {
    targetUrl.searchParams.set("focusSlotTime", data.focusSlotTime);
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl.toString());
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl.toString());
      }

      return undefined;
    }),
  );
});
