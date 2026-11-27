import { getAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/Sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // No session (e.g. /admin/login): render the page plain, without the
  // sidebar. Protected pages still redirect via middleware / requireAdmin().
  if (!session) {
    return <>{children}</>;
  }

  return (
    <AdminShell adminName={session.name} adminEmail={session.email}>
      {children}
    </AdminShell>
  );
}
