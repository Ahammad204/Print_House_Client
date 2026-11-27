import { requireAdmin } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminChangePasswordPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Change Password</h1>
        <p className="text-sm text-slate-500">
          Update the admin password. All other signed-in devices are signed
          out immediately.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
