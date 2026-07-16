import { apiRequest } from '../api/client';

type Props = Record<string, string | number | boolean | null>;
interface QueuedEvent {
  name: string;
  props?: Props;
  sessionId: string;
  occurredAt: string;
}

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 25;

/** Stable per-tab session id for anonymous correlation. */
function sessionId(): string {
  const KEY = 'academy_analytics_sid';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  try {
    await apiRequest('/analytics/events', {
      method: 'POST',
      body: { events: batch },
    });
  } catch {
    // Analytics is best-effort — drop on failure rather than retry forever.
  }
  if (queue.length > 0) scheduleFlush();
}

function scheduleFlush(): void {
  if (timer) return;
  timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
}

/** Buffer a client analytics event; flushed in batches. Never throws. */
export function track(name: string, props?: Props): void {
  queue.push({ name, props, sessionId: sessionId(), occurredAt: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) void flush();
  else scheduleFlush();
}

// Best-effort flush when the tab is hidden or closed.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
