// apps/web/src/__create/useDevServerHeartbeat.ts
// Client-only heartbeat to keep the dev server alive without react-idle-timer.

export function useDevServerHeartbeat() {
  if (typeof window === "undefined" || !import.meta.env.DEV) {
    // No-op on the server or in production builds
    return;
  }

  let lastActivity = Date.now();
  const bump = () => { lastActivity = Date.now(); };

  const events = ["mousemove", "keydown", "scroll", "touchstart", "visibilitychange"];
  events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));

  const interval = window.setInterval(() => {
    // If there was activity in the last 60s, send a heartbeat
    if (Date.now() - lastActivity < 60_000) {
      fetch("/api/__create/heartbeat", { method: "POST" }).catch(() => {
        // no-op: best-effort ping
      });
    }
  }, 30_000);

  // Optional cleanup API if your app calls it on unmount
  return () => {
    clearInterval(interval);
    events.forEach((ev) => window.removeEventListener(ev, bump));
  };
}
