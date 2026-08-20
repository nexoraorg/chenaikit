import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Dashboard } from "../pages/Dashboard";

const REAL_SET_TIMEOUT = globalThis.setTimeout;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Dashboard component states", () => {
  it("renders skeleton while loading", () => {
    render(<Dashboard />);
    // 骨架屏容器
    const skeletonGrids = document.querySelectorAll(".skeleton-line");
    expect(skeletonGrids.length).toBeGreaterThan(0);
  });

  it("renders stat cards and ledger table on success", async () => {
    render(<Dashboard />);

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });

    // 统计卡片
    expect(screen.getByText("Decisions today")).toBeInTheDocument();
    expect(screen.getByText("Avg. credit score")).toBeInTheDocument();
    // 账本表格
    expect(screen.getByText("GC3F...K91X")).toBeInTheDocument();
    const approvedCells = screen.getAllByText("approved");
    expect(approvedCells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no entries", async () => {
    localStorage.setItem("chenaikit_demo", "empty");
    render(<Dashboard />);

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });

    expect(screen.getByText("No ledger entries yet")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("renders error state with retry button", async () => {
    localStorage.setItem("chenaikit_demo", "error");
    render(<Dashboard />);

    await act(async () => {
      await new Promise((r) => REAL_SET_TIMEOUT(r, 750));
    });

    // 错误状态
    expect(screen.getByText("Couldn't load dashboard")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
    // 错误消息
    expect(screen.getByText(/connection timed out/i)).toBeInTheDocument();
  });
});