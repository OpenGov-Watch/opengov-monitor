import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "@/components/layout/Layout";
import { RequireAuth } from "@/components/auth/require-auth";
import { RouteErrorBoundary } from "@/components/error/RouteErrorBoundary";

// Lazy load pages
import { lazy, Suspense } from "react";

const ReferendaPage = lazy(() => import("@/pages/referenda"));
const TreasuryPage = lazy(() => import("@/pages/treasury"));
const ChildBountiesPage = lazy(() => import("@/pages/child-bounties"));
const FellowshipPage = lazy(() => import("@/pages/fellowship"));
const SalaryCyclesPage = lazy(() => import("@/pages/fellowship-salary-cycles"));
const SalaryClaimantsPage = lazy(() => import("@/pages/fellowship-salary-claimants"));
const SpendingPage = lazy(() => import("@/pages/spending"));
const OutstandingClaimsPage = lazy(() => import("@/pages/outstanding-claims"));
const ExpiredClaimsPage = lazy(() => import("@/pages/expired-claims"));
const ManageCategoriesPage = lazy(() => import("@/pages/manage/categories"));
const ManageBountiesPage = lazy(() => import("@/pages/manage/bounties"));
const ManageSubtreasuryPage = lazy(() => import("@/pages/manage/subtreasury"));
const ManageCustomSpendingPage = lazy(() => import("@/pages/manage/custom-spending"));
const TreasuryNetflowsPage = lazy(() => import("@/pages/treasury-netflows"));
const ManageSyncSettingsPage = lazy(() => import("@/pages/manage/sync-settings"));
const ManageDataErrorsPage = lazy(() => import("@/pages/manage/data-errors"));
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

// Shared error element for child routes
const childErrorElement = <RouteErrorBoundary />;

export const router = createBrowserRouter([
  // Login page (outside main layout)
  {
    path: "/login",
    element: withSuspense(LoginPage),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/referenda" replace /> },
      { path: "referenda", element: withSuspense(ReferendaPage), errorElement: childErrorElement },
      { path: "treasury", element: withSuspense(TreasuryPage), errorElement: childErrorElement },
      { path: "child-bounties", element: withSuspense(ChildBountiesPage), errorElement: childErrorElement },
      { path: "fellowship", element: withSuspense(FellowshipPage), errorElement: childErrorElement },
      { path: "fellowship-salary-cycles", element: withSuspense(SalaryCyclesPage), errorElement: childErrorElement },
      { path: "fellowship-salary-claimants", element: withSuspense(SalaryClaimantsPage), errorElement: childErrorElement },
      { path: "spending", element: withSuspense(SpendingPage), errorElement: childErrorElement },
      { path: "outstanding-claims", element: withSuspense(OutstandingClaimsPage), errorElement: childErrorElement },
      { path: "expired-claims", element: withSuspense(ExpiredClaimsPage), errorElement: childErrorElement },
      { path: "manage/categories", element: withSuspense(ManageCategoriesPage), errorElement: childErrorElement },
      { path: "manage/bounties", element: withSuspense(ManageBountiesPage), errorElement: childErrorElement },
      { path: "manage/subtreasury", element: withSuspense(ManageSubtreasuryPage), errorElement: childErrorElement },
      { path: "manage/custom-spending", element: withSuspense(ManageCustomSpendingPage), errorElement: childErrorElement },
      { path: "treasury-netflows", element: withSuspense(TreasuryNetflowsPage), errorElement: childErrorElement },
      { path: "manage/sync", element: withSuspense(ManageSyncSettingsPage), errorElement: childErrorElement },
      { path: "manage/data-errors", element: withSuspense(ManageDataErrorsPage), errorElement: childErrorElement },
      { path: "dashboards", element: withSuspense(DashboardsListPage), errorElement: childErrorElement },
      { path: "dashboards/:id", element: withSuspense(DashboardViewPage), errorElement: childErrorElement },
      { path: "dashboards/:id/edit", element: <RequireAuth>{withSuspense(DashboardEditPage)}</RequireAuth>, errorElement: childErrorElement },
    ],
  },
]);
