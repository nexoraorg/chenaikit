// hooks/useDashboard.ts — loading / empty / error / success state machine
//
// TODO: replace the simulated fetch with a real API call when the backend
// implements /api/dashboard (currently only /health exists).

import { useCallback, useEffect, useState } from "react";

export type Stat = {
  label: string;
  value: string;
  delta: string;
  dir: "up" | "down";
};

export type LedgerEntry = {
  account: string;
  model: string;
  score: string;
  status: string;
  time: string;
};

export type DashboardState =
  | { status: "loading" }
  | { status: "success"; stats: Stat[]; entries: LedgerEntry[] }
  | { status: "empty" }
  | { status: "error"; message: string };

/* ---------- simulated data source ---------- */

const STATS: Stat[] = [
  { label: "Decisions today", value: "1,204", delta: "▲ 8.2% vs yesterday", dir: "up" },
  { label: "Avg. credit score", value: "693", delta: "▲ 1.1%", dir: "up" },
  { label: "Fraud flags", value: "17", delta: "▲ 3 vs yesterday", dir: "down" },
  { label: "Oracle uptime", value: "99.97%", delta: "30-day avg", dir: "up" },
];

const ENTRIES: LedgerEntry[] = [
  { account: "GC3F...K91X", model: "credit-score", score: "742", status: "approved", time: "0:02 ago" },
  { account: "GA7B...M2QZ", model: "fraud-detect", score: "—", status: "flagged", time: "0:41 ago" },
  { account: "GD9K...T4LP", model: "credit-score", score: "681", status: "approved", time: "1:15 ago" },
  { account: "GE2N...W8YV", model: "fraud-detect", score: "—", status: "pending", time: "2:03 ago" },
  { account: "GF5H...R3UB", model: "credit-score", score: "598", status: "flagged", time: "3:47 ago" },
];

/** Simulate a network request. Replace with `fetch("/api/dashboard")` when the
 *  backend route exists. */
function fetchDashboard(): Promise<{ stats: Stat[]; entries: LedgerEntry[] }> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Opt-in demo modes  — set via localStorage for testing
      //   localStorage.setItem("chenaikit_demo", "error")  →  simulate network failure
      //   localStorage.setItem("chenaikit_demo", "empty")  →  simulate empty state
      const demo = typeof localStorage !== "undefined" ? localStorage.getItem("chenaikit_demo") : null;

      if (demo === "error") {
        reject(new Error("Failed to reach stellar-testnet — connection timed out"));
        return;
      }
      resolve({
        stats: STATS,
        entries: demo === "empty" ? [] : ENTRIES,
      });
    }, 700);
  });
}

/* ---------- hook ---------- */

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  const fetchData = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await fetchDashboard();
      if (data.entries.length === 0) {
        setState({ status: "empty" });
      } else {
        setState({ status: "success", ...data });
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { state, retry: fetchData } as const;
}