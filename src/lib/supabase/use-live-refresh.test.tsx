import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveRefresh } from "./use-live-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type ChangeHandler = () => void;
const handlers: { table: string; handler: ChangeHandler }[] = [];
const channel = {
  on: vi.fn((_event: string, filter: { table: string }, handler: ChangeHandler) => {
    handlers.push({ table: filter.table, handler });
    return channel;
  }),
  subscribe: vi.fn(() => channel),
};
const removeChannel = vi.fn();
const topics: string[] = [];
vi.mock("./client", () => ({
  createClient: () => ({
    channel: vi.fn((topic: string) => {
      topics.push(topic);
      return channel;
    }),
    removeChannel,
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  handlers.length = 0;
  topics.length = 0;
});

describe("useLiveRefresh", () => {
  it("subscribes to every table and refreshes once for a burst of changes", () => {
    renderHook(() => useLiveRefresh({ tables: ["jobs", "job_assignments"] }));

    expect(handlers.map((entry) => entry.table)).toEqual(["jobs", "job_assignments"]);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);

    act(() => {
      handlers[0].handler();
      handlers[1].handler();
      handlers[0].handler();
      vi.advanceTimersByTime(500);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the page becomes visible again", () => {
    renderHook(() => useLiveRefresh({ tables: ["jobs"] }));

    act(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(500);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useLiveRefresh({ tables: ["jobs"] }));
    unmount();

    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it("opens a fresh channel topic on every mount so a remount never reuses a channel still leaving", () => {
    const first = renderHook(() => useLiveRefresh({ tables: ["jobs"] }));
    first.unmount();
    renderHook(() => useLiveRefresh({ tables: ["jobs"] }));

    expect(topics).toHaveLength(2);
    expect(topics[0]).not.toBe(topics[1]);
  });

  it("does nothing when disabled", () => {
    renderHook(() => useLiveRefresh({ enabled: false, tables: ["jobs"] }));

    expect(channel.subscribe).not.toHaveBeenCalled();
  });
});
