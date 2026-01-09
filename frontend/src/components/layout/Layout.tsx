import { Outlet } from "react-router";
import { Sidebar } from "./sidebar";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden p-6">
        <Outlet />
      </main>
    </div>
  );
}
