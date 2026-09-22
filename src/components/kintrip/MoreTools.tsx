import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  Building2,
  CalendarClock,
  CloudOff,
  GitCompare,
  HeartHandshake,
  LayoutList,
  Link2,
  MessageSquareHeart,
  Sparkles,
  Vote,
} from "lucide-react";
import { Card } from "@/components/kintrip/ui";

/**
 * Links to the planning tools that do not have their own tab.
 * Remixed from the original Kintrip project.
 */

const tools = [
  { to: "/polls", label: "Group questions", hint: "Dates, destination, budget", icon: Vote },
  { to: "/readiness", label: "Readiness and deadlines", hint: "What is still missing", icon: CalendarClock },
  { to: "/templates", label: "Starter lists", hint: "Packing, jobs and deadlines", icon: LayoutList },
  { to: "/stays", label: "Places to stay", hint: "Compare up to five bases", icon: Building2 },
  { to: "/scenarios", label: "Compare plans", hint: "Alternatives side by side", icon: GitCompare },
  { to: "/logistics", label: "Rooms and vehicles", hint: "Who sleeps where, who travels with whom", icon: BedDouble },
  { to: "/dependencies", label: "What waits for what", hint: "Booking order and risks", icon: Link2 },
  { to: "/breaks", label: "Rest and rejoin", hint: "A quiet word, not an announcement", icon: HeartHandshake },
  { to: "/offline", label: "Save days to this phone", hint: "For when there is no signal", icon: CloudOff },
  { to: "/feedback", label: "After the trip", hint: "Three optional questions", icon: MessageSquareHeart },
  { to: "/pricing", label: "Plans and prices", hint: "What is free, what is not", icon: Sparkles },
];

export function MoreTools() {
  return (
    <Card className="p-5">
      <h2 className="text-lg">More planning tools</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.to} to={t.to} className="kin-card flex items-center gap-3 p-4">
            <t.icon className="size-6 shrink-0 text-secondary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.label}</span>
              <span className="block text-sm text-muted-foreground">{t.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
