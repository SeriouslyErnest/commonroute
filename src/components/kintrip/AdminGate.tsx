import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AdminConsole } from "@/components/kintrip/AdminConsole";
import { adminConsoleAccess } from "@/lib/kintrip/admin.functions";

/**
 * Renders the admin console only when this route's path is the configured
 * console address (ADMIN_CONSOLE_PATH, default /admin/admin). Any other path
 * shows a plain "page not found", so the unlisted address stays unlisted.
 * Real access control happens on the server inside each admin action.
 */
export function AdminGate({ path }: { path: string }) {
  const check = useServerFn(adminConsoleAccess);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    check({ data: path })
      .then((r) => setAllowed(r.allowed))
      .catch(() => setAllowed(false));
  }, [check, path]);

  if (allowed === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }
  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-extrabold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The page you asked for does not exist.</p>
      </main>
    );
  }
  return <AdminConsole />;
}
