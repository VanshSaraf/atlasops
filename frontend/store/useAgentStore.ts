import { create } from "zustand";
import type { AgentRun, DashboardStats } from "@/types";
import { listRuns, triggerAgent } from "@/lib/api";
import type { RunAgentRequest } from "@/types";

interface AgentState {
  runs: AgentRun[];
  activeRun: AgentRun | null;
  result: AgentRun | null;
  isRunning: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  historyError: string | null;

  stats: DashboardStats;

  loadRuns: () => Promise<void>;
  startRun: (payload: RunAgentRequest) => Promise<void>;
  setActiveRun: (run: AgentRun | null) => void;
  setRuns: (runs: AgentRun[]) => void;
  addRun: (run: AgentRun) => void;
  clearError: () => void;
  clearResult: () => void;
}

function computeStats(runs: AgentRun[]): DashboardStats {
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === "PASSED").length;
  const failedRuns = runs.filter((r) => r.status === "FAILED").length;
  const totalFixesApplied = runs.reduce((sum, r) => sum + r.totalFixes, 0);
  const averageTime =
    totalRuns > 0
      ? Math.round(runs.reduce((sum, r) => sum + r.timeTaken, 0) / totalRuns)
      : 0;

  return { totalRuns, passedRuns, failedRuns, totalFixesApplied, averageTime };
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runs: [],
  activeRun: null,
  result: null,
  isRunning: false,
  isLoadingHistory: false,
  error: null,
  historyError: null,
  stats: {
    totalRuns: 0,
    passedRuns: 0,
    failedRuns: 0,
    totalFixesApplied: 0,
    averageTime: 0,
  },

  loadRuns: async () => {
    set({ isLoadingHistory: true, historyError: null });
    try {
      const persistedRuns = await listRuns();
      const merged = mergeRuns(persistedRuns, get().runs);
      set({
        runs: merged,
        isLoadingHistory: false,
        stats: computeStats(merged),
      });
    } catch (err) {
      set({
        isLoadingHistory: false,
        historyError:
          err instanceof Error
            ? err.message
            : "Could not load run history. Backend may be unavailable.",
      });
    }
  },

  startRun: async (payload) => {
    set({ isRunning: true, error: null });
    try {
      const result = await triggerAgent(payload);
      const run: AgentRun = {
        ...result,
        id: result.id || crypto.randomUUID(),
        repositorySource: result.repositorySource || "local",
        writebackEnabled: result.writebackEnabled ?? false,
        createdAt: result.createdAt || new Date().toISOString(),
      };
      const runs = mergeRuns([run], get().runs);
      set({
        runs,
        activeRun: run,
        result: run,
        isRunning: false,
        stats: computeStats(runs),
      });
    } catch (err) {
      set({
        isRunning: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      });
    }
  },

  setActiveRun: (run) => set({ activeRun: run }),

  setRuns: (runs) => set({ runs, stats: computeStats(runs) }),

  addRun: (run) => {
    const runs = mergeRuns([run], get().runs);
    set({ runs, stats: computeStats(runs) });
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ result: null }),
}));

function mergeRuns(primary: AgentRun[], secondary: AgentRun[]): AgentRun[] {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((run) => {
    if (seen.has(run.id)) return false;
    seen.add(run.id);
    return true;
  });
}
