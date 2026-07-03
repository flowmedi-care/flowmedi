import { DashboardOverviewSkeleton } from "./dashboard-overview-skeleton";
import { CalendarPageSkeleton } from "./calendar-page-skeleton";
import { TablePageSkeleton, TableRowsSkeleton } from "./table-page-skeleton";
import { PageShellSkeleton } from "./page-shell-skeleton";
import { SplitPanelSkeleton } from "./split-panel-skeleton";
import { DetailPageSkeleton } from "./detail-page-skeleton";
import { SettingsPageSkeleton } from "./settings-page-skeleton";

export type DashboardSkeletonVariant =
  | "overview"
  | "calendar"
  | "table"
  | "pageShell"
  | "split"
  | "detail"
  | "settings";

export function DashboardRouteSkeleton({
  variant = "table",
}: {
  variant?: DashboardSkeletonVariant;
}) {
  switch (variant) {
    case "overview":
      return <DashboardOverviewSkeleton />;
    case "calendar":
      return <CalendarPageSkeleton />;
    case "table":
      return <TablePageSkeleton />;
    case "pageShell":
      return <PageShellSkeleton />;
    case "split":
      return <SplitPanelSkeleton />;
    case "detail":
      return <DetailPageSkeleton />;
    case "settings":
      return <SettingsPageSkeleton />;
    default:
      return <TablePageSkeleton />;
  }
}

export {
  DashboardOverviewSkeleton,
  CalendarPageSkeleton,
  TablePageSkeleton,
  TableRowsSkeleton,
  PageShellSkeleton,
  SplitPanelSkeleton,
  DetailPageSkeleton,
  SettingsPageSkeleton,
};
