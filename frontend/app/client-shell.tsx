"use client";

import { Header, Sidebar } from "@/components";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="workspace-shell flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="workspace-main flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
