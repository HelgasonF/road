"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "./client";

const REFRESH_DEBOUNCE_MS = 400;

interface LiveRefreshOptions {
  enabled?: boolean;
  tables: readonly string[];
}

/**
 * Re-renders the server components when rows another user changed arrive
 * through Supabase Realtime, or when the page becomes visible again (for
 * example after returning from WhatsApp), which also covers a dropped socket.
 */
export function useLiveRefresh({ enabled = true, tables }: LiveRefreshOptions) {
  const router = useRouter();
  const tableKey = tables.join(",");

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    const supabase = createClient();
    // supabase.channel() returns an existing channel with the same topic, and
    // removeChannel() finishes asynchronously; a unique topic per mount keeps a
    // quick remount (or StrictMode) from reusing a channel that is still leaving.
    const channel = supabase.channel(`live-refresh:${tableKey}:${crypto.randomUUID()}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }
    channel.subscribe();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [enabled, router, tableKey]);
}
