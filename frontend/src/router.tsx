import { createBrowserRouter } from "react-router";
import { Layout } from "@/components/layout/Layout";

// Lazy load pages
import { lazy, Suspense } from "react";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ReferendaPage = lazy(() => import("@/pages/referenda"));
const TreasuryPage = lazy(() => import("@/pages/treasury"));
const ChildBountiesPage = lazy(() => import("@/pages/child-bounties"));
const FellowshipPage = lazy(() => import("@/pages/fellowship"));
const SalaryCyclesPage = lazy(() => import("@/pages/fellowship-salary-cycles"));
const SalaryClaimantsPage = lazy(() => import("@/pages/fellowship-salary-claimants"));
const SpendingPage = lazy(() => import("@/pages/spending"));
const OutstandingClaimsPage = lazy(() => import("@/pages/outstanding-claims"));
const ExpiredClaimsPage = lazy(() => import("@/pages/expired-claims"));
const LogsPage = lazy(() => import("@/pages/logs"));
const ManageCategoriesPage = lazy(() => import("@/pages/manage/categories"));
const ManageBountiesPage = lazy(() => import("@/pages/manage/bounties"));
const ManageSubtreasuryPage = lazy(() => import("@/pages/manage/subtreasury"));
const ManageSyncSettingsPage = lazy(() => import("@/pages/manage/sync-settings"));
const DashboardsListPage = lazy(() => import("@/pages/dashboards/index"));
const DashboardViewPage = lazy(() => import("@/pages/dashboards/view"));
const DashboardEditPage = lazy(() => import("@/pages/dashboards/edit"));
const LoginPage = lazy(() => import("@/pages/login"));

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-muted rounded mb-6" />
      <div className="h-96 bg-muted rounded" />
    </div>
  );
}

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Login page (outside main layout)
  {
    path: "/login",
    element: withSuspense(LoginPage),
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: withSuspense(DashboardPage) },
      { path: "referenda", element: withSuspense(ReferendaPage) },
      { path: "treasury", element: withSuspense(TreasuryPage) },
      { path: "child-bounties", element: withSuspense(ChildBountiesPage) },
      { path: "fellowship", element: withSuspense(FellowshipPage) },
      { path: "fellowship-salary-cycles", element: withSuspense(SalaryCyclesPage) },
      { path: "fellowship-salary-claimants", element: withSuspense(SalaryClaimantsPage) },
      { path: "spending", element: withSuspense(SpendingPage) },
      { path: "outstanding-claims", element: withSuspense(OutstandingClaimsPage) },
      { path: "expired-claims", element: withSuspense(ExpiredClaimsPage) },
      { path: "logs", element: withSuspense(LogsPage) },
      { path: "manage/categories", element: withSuspense(ManageCategoriesPage) },
      { path: "manage/bounties", element: withSuspense(ManageBountiesPage) },
      { path: "manage/subtreasury", element: withSuspense(ManageSubtreasuryPage) },
      { path: "manage/sync", element: withSuspense(ManageSyncSettingsPage) },
      { path: "dashboards", element: withSuspense(DashboardsListPage) },
      { path: "dashboards/:id", element: withSuspense(DashboardViewPage) },
      { path: "dashboards/:id/edit", element: withSuspense(DashboardEditPage) },
    ],
  },
]);
