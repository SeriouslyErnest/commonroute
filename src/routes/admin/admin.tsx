import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/kintrip/AdminGate";

/**
 * Documented default address of the internal admin console. Serves the
 * console only when it matches ADMIN_CONSOLE_PATH on the server (default
 * /admin/admin); otherwise it answers with a plain "page not found".
 */
export const Route = createFileRoute("/admin/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Console" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Internal operations." },
    ],
  }),
  component: function AdminAdminRoute() {
    return <AdminGate path="/admin/admin" />;
  },
});
