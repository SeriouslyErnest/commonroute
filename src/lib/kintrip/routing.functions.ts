import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const inputSchema = z.object({
  points: z.array(pointSchema).min(2).max(12),
});

export interface RouteLegResult {
  /** Index of the leg's first endpoint in the submitted list. */
  fromIndex: number;
  toIndex: number;
  metres: number | null;
  seconds: number | null;
  /** True when no road route came back — we show "unavailable", never a guess. */
  unavailable: boolean;
}

export interface DrivingRouteResult {
  legs: RouteLegResult[];
  provider: string;
  /** Set when the whole request failed, so the caller can show unknown travel. */
  error?: string;
}

const ROUTER = "https://router.project-osrm.org";

/**
 * Routed driving distance and time between ordered endpoints.
 * Any failure returns explicit "unavailable" legs rather than an estimate.
 */
export const routeDriving = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<DrivingRouteResult> => {
    const coords = data.points.map((p) => `${p.longitude},${p.latitude}`).join(";");
    const unavailable = (error?: string): DrivingRouteResult => ({
      provider: "osrm",
      error,
      legs: data.points.slice(0, -1).map((_, i) => ({
        fromIndex: i,
        toIndex: i + 1,
        metres: null,
        seconds: null,
        unavailable: true,
      })),
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(
        `${ROUTER}/route/v1/driving/${coords}?overview=false&annotations=false`,
        { signal: controller.signal, headers: { Accept: "application/json" } },
      );
      clearTimeout(timer);
      if (!response.ok) return unavailable(`Routing service returned ${response.status}`);
      const body = (await response.json()) as {
        code?: string;
        routes?: Array<{ legs?: Array<{ distance?: number; duration?: number }> }>;
      };
      if (body.code !== "Ok" || !body.routes?.[0]?.legs) {
        return unavailable("No driving route between these points");
      }
      const legs = body.routes[0].legs!.map((leg, i) => ({
        fromIndex: i,
        toIndex: i + 1,
        metres: typeof leg.distance === "number" ? Math.round(leg.distance) : null,
        seconds: typeof leg.duration === "number" ? Math.round(leg.duration) : null,
        unavailable: typeof leg.duration !== "number",
      }));
      return { legs, provider: "osrm" };
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "Routing failed");
    }
  });
