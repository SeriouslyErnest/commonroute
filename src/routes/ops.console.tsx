import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/kintrip/AdminGate";

/**
 * Internal admin console. Not linked from anywhere in the app and excluded
 * from search engines. This address only serves the console when it matches
 * ADMIN_CONSOLE_PATH on the server; access itself is decided by operator
 * identity on every action — the unlisted address is never the control.
 */
export const Route = createFileRoute("/ops/console")({
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
  component: function OpsConsoleRoute() {
    return <AdminGate path="/ops/console" />;
  },
});
