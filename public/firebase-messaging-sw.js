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
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "habitly reminder";
    const options = {
      body: payload.notification?.body || "Your next habit is ready.",
      icon: "/apple-touch-icon.png",
      badge: "/favicon-96x96.png",
      data: {
        link: payload.fcmOptions?.link || payload.data?.link || "/",
      },
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.link || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
