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
      { title: "CommonRoute operations console" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Internal operations." },
      { property: "og:title", content: "CommonRoute operations console" },
      { property: "og:description", content: "Internal CommonRoute operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: function AdminAdminRoute() {
    return <AdminGate path="/admin/admin" />;
  },
});
