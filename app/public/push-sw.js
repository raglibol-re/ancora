// Push notifications, imported into the service worker Workbox generates (vite.config.ts).
// The server sends { title, body, url, tag }; tapping a notification opens or focuses ancora at
// that page.

self.addEventListener("push", (event) => {
	let notice = {
		title: "ancora",
		body: "Something needs your attention.",
		url: "/app",
		tag: "ancora",
	};
	try {
		notice = { ...notice, ...event.data.json() };
	} catch {
		// A push without a readable payload still says something happened.
	}
	event.waitUntil(
		self.registration.showNotification(notice.title, {
			body: notice.body,
			tag: notice.tag,
			icon: "/brand/apple-touch-icon-180.png",
			badge: "/brand/favicon-32.png",
			data: { url: notice.url },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url ?? "/app", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			const open = windows.find((client) => client.url.startsWith(self.location.origin));
			if (open) {
				open.navigate(url);
				return open.focus();
			}
			return self.clients.openWindow(url);
		}),
	);
});
