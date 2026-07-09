import { useCallback, useMemo } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { markModuleSeen as apiMarkModuleSeen } from "@workspace/api-client-react";
import {
  computeActivitySinceLastVisit,
  formatLastSeen,
  type ActivityItem,
  type ActivityModule,
} from "@/lib/activity-notifications";

export function useActivityNotifications() {
  const { user, refreshUser } = useAuth();
  const {
    currentRole,
    recommendations,
    intakeItems,
    meldTimeline,
    agentWorkItems,
    projectTasks,
  } = useAppState();

  const moduleLastSeen = user?.moduleLastSeen ?? {};
  const lastLoginAt = user?.lastLoginAt ?? null;

  const sinceLastVisit = useMemo<ActivityItem[]>(() => {
    if (!user) return [];
    return computeActivitySinceLastVisit({
      role: currentRole,
      userName: user.name,
      moduleLastSeen,
      lastLoginAt,
      recommendations: recommendations.map((r) => ({
        id: r.id,
        recommendation: r.recommendation,
        status: r.status,
        requiredApprover: r.requiredApprover,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        approvals: r.approvals,
      })),
      intakeItems: intakeItems.map((it) => ({
        id: it.id,
        cleanedSummary: it.cleanedSummary,
        status: it.status,
        receivedAt: it.receivedAt,
      })),
      meldTimeline: meldTimeline.map((e) => ({
        id: e.id,
        itemTitle: e.itemTitle,
        timestamp: e.timestamp,
        finalized: e.finalized,
        needs: e.needs ?? null,
      })),
      agentWorkItems: agentWorkItems.map((w) => ({
        id: w.id,
        title: w.title,
        status: w.status,
        updatedAt: w.updatedAt,
        events: w.events.map((ev) => ({ timestamp: ev.timestamp })),
      })),
      projectTasks: projectTasks.map((t) => ({
        id: t.id,
        title: t.title,
        owner: t.owner,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  }, [
    user,
    currentRole,
    moduleLastSeen,
    lastLoginAt,
    recommendations,
    intakeItems,
    meldTimeline,
    agentWorkItems,
    projectTasks,
  ]);

  const lastVisitLabel = useMemo(
    () => formatLastSeen(moduleLastSeen, lastLoginAt),
    [moduleLastSeen, lastLoginAt],
  );

  const totalNew = sinceLastVisit.reduce((sum, item) => sum + item.count, 0);

  const markModuleSeen = useCallback(
    async (module: ActivityModule) => {
      if (!user) return;
      const now = new Date().toISOString();
      if (moduleLastSeen[module] && Date.parse(moduleLastSeen[module]) >= Date.parse(now) - 5000) {
        return;
      }
      try {
        const updated = await apiMarkModuleSeen({ module });
        refreshUser(updated);
      } catch {
        // non-blocking; counts may repeat until next successful sync
      }
    },
    [user, moduleLastSeen, refreshUser],
  );

  return {
    sinceLastVisit,
    lastVisitLabel,
    totalNew,
    markModuleSeen,
  };
}
