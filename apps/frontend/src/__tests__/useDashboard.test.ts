import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboard } from "../hooks/useDashboard";

const REAL_SET_TIMEOUT = globalThis.setTimeout;

// localStorage 在 jsdom 是同步的, hook 内部用它读 demo 模式
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDashboard state machine", () => {
  it("starts in loading then transitions to success", async () => {
    const { result } = renderHook(() => useDashboard());

    // 首次渲染 → loading
    expect(result.current.state.status).toBe("loading");

    // 结束模拟请求（700ms）后 → success
    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });

    expect(result.current.state.status).toBe("success");
    if (result.current.state.status === "success") {
      expect(result.current.state.stats.length).toBeGreaterThan(0);
      expect(result.current.state.entries.length).toBeGreaterThan(0);
    }
  });

  it("transitions to empty when the data source returns no entries", async () => {
    localStorage.setItem("chenaikit_demo", "empty");
    const { result } = renderHook(() => useDashboard());

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });

    expect(result.current.state.status).toBe("empty");
  });

  it("transitions to error when the simulated fetch fails", async () => {
    localStorage.setItem("chenaikit_demo", "error");
    const { result } = renderHook(() => useDashboard());

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status === "error") {
      expect(result.current.state.message.length).toBeGreaterThan(0);
    }
  });

  it("retry re-issues the request after an error", async () => {
    localStorage.setItem("chenaikit_demo", "error");
    const { result } = renderHook(() => useDashboard());

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });
    expect(result.current.state.status).toBe("error");

    // 修复数据源后重试
    localStorage.removeItem("chenaikit_demo");
    await act(async () => {
      result.current.retry();
    });

    // retry 立即回到 loading
    expect(result.current.state.status).toBe("loading");

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });
    expect(result.current.state.status).toBe("success");
  });
});