"use client";
import { useEffect, useRef, useState } from "react";

export function useSse<T = any>(url: string | null): { events: T[]; connected: boolean } {
  const [events, setEvents] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    ref.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setEvents((arr) => [...arr, parsed]);
      } catch {/* ignore malformed */}
    };
    return () => {
      es.close();
      ref.current = null;
      setConnected(false);
    };
  }, [url]);

  return { events, connected };
}
