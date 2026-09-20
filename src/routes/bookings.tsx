import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Eye, Hotel, Lock, Plus, Ticket, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { addBooking, cancelBooking, deleteBooking, shareBookingReference } from "@/lib/kintrip/actions";
import { actorName, isOrganiser } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";
import type { BookingType } from "@/lib/kintrip/types";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings and stay — CommonRoute" },
      {
        name: "description",
        content: "Keep your group's stay, tickets and travel in one place, with confirmation details kept private.",
      },
      { property: "og:title", content: "Bookings and stay — CommonRoute" },
      {
        property: "og:description",
        content: "Add what is booked, who it covers and when it cannot move.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingsScreen,
});

const TYPES: { value: BookingType; label: string }[] = [
  { value: "stay", label: "Place to stay" },
  { value: "activity", label: "Activity or ticket" },
  { value: "transport", label: "Travel" },
  { value: "meal", label: "Meal" },
  { value: "other", label: "Something else" },
];

function BookingsScreen() {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const organiser = isOrganiser(state);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "activity" as BookingType,
    title: "",
    provider: "",
    link: "",
    status: "planned" as "planned" | "confirmed",
    startLocal: "",
    endLocal: "",
    addressLocal: "",
    addressTranslated: "",
    contact: "",
    reference: "",
    attractionId: "",
    cancellationDeadline: "",
    travellerIds: state.travellers.map((t) => t.id),
  });

  const submit = () => {
    if (!form.title.trim()) return;
    addBooking({
      type: form.type,
      title: form.title,
      provider: form.provider || undefined,
      link: form.link || undefined,
      status: form.status,
      startLocal: form.startLocal || undefined,
      endLocal: form.endLocal || undefined,
      timeZone: state.trip.timeZone ?? "local",
      travellerIds: form.travellerIds,
      addressLocal: form.addressLocal || undefined,
      addressTranslated: form.addressTranslated || undefined,
      contact: form.contact || undefined,
      ownerId: me,
      reference: form.reference || undefined,
      attractionId: form.attractionId || undefined,
      cancellationDeadline: form.cancellationDeadline || undefined,
    });
    setOpen(false);
    setForm((f) => ({ ...f, title: "", reference: "", link: "", provider: "" }));
  };

  return (
    <AppShell title="Bookings and stay" subtitle="What is already arranged for your group">
      <Card className="space-y-2 bg-secondary-soft">
        <p className="text-sm">
          A confirmed booking with a time becomes a fixed point in the plan. Approving a place, agreeing
          who pays and actually booking it are three separate steps.
        </p>
        <p className="text-sm text-muted-foreground">
          Never store passport or card details here. Confirmation references stay with whoever booked,
          unless they choose to share them.
        </p>
        <Button type="button" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" aria-hidden /> Add a booking
        </Button>
      </Card>

      {open ? (
        <Card className="space-y-3">
          <h2 className="text-lg">New booking</h2>
          <Field label="What is it?">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as BookingType })}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Hotel Niwa Tokyo"
            />
          </Field>
          <Field label="Booked with (optional)">
            <input
              className={inputClass}
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
          </Field>
          <Field label="Link (optional)">
            <input
              className={inputClass}
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="Is it confirmed?">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "planned" | "confirmed" })}
            >
              <option value="planned">Planned, not booked yet</option>
              <option value="confirmed">Booked and confirmed</option>
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts (local time there)">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startLocal}
                onChange={(e) => setForm({ ...form, startLocal: e.target.value })}
              />
            </Field>
            <Field label="Ends (local time there)">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.endLocal}
                onChange={(e) => setForm({ ...form, endLocal: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Address in the local language (optional)">
            <input
              className={inputClass}
              value={form.addressLocal}
              onChange={(e) => setForm({ ...form, addressLocal: e.target.value })}
            />
          </Field>
          <Field label="Address in English (optional)">
            <input
              className={inputClass}
              value={form.addressTranslated}
              onChange={(e) => setForm({ ...form, addressTranslated: e.target.value })}
            />
          </Field>
          <Field label="Contact number (optional)">
            <input
              className={inputClass}
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </Field>
          <Field label="Linked stop (optional)">
            <select
              className={inputClass}
              value={form.attractionId}
              onChange={(e) => setForm({ ...form, attractionId: e.target.value })}
            >
              <option value="">Not linked</option>
              {state.attractions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Confirmation reference (only you can see this)">
            <input
              className={inputClass}
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </Field>
          <Field label="Free cancellation until (optional)">
            <input
              type="date"
              className={inputClass}
              value={form.cancellationDeadline}
              onChange={(e) => setForm({ ...form, cancellationDeadline: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="button" onClick={submit}>
              Save booking
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {state.bookings.length === 0 ? (
        <Card>
          <p className="text-sm">
            No bookings yet. Add your stay first — it powers the &quot;Find our stay&quot; card on Today.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {state.bookings.map((b) => {
            const mine = b.ownerId === me;
            const canSeeReference = mine || b.referenceSharedWith.includes(me);
            return (
              <Card key={b.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg">
                      {b.type === "stay" ? (
                        <Hotel className="size-5 text-secondary" aria-hidden />
                      ) : (
                        <Ticket className="size-5 text-secondary" aria-hidden />
                      )}
                      {b.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Booked by {actorName(state, b.ownerId)}
                      {b.provider ? ` · ${b.provider}` : ""}
                    </p>
                  </div>
                  <Chip tone={b.status === "confirmed" ? "lime" : b.status === "cancelled" ? "sunny" : "primary"}>
                    {b.status === "confirmed" ? "Booked" : b.status === "cancelled" ? "Cancelled" : "Not booked yet"}
                  </Chip>
                </div>

                {b.startLocal ? (
                  <p className="text-sm">
                    {b.startLocal.replace("T", " ")}
                    {b.endLocal ? ` → ${b.endLocal.replace("T", " ")}` : ""} (local time there)
                  </p>
                ) : null}
                {b.addressLocal ? <p className="text-sm font-semibold">{b.addressLocal}</p> : null}
                {b.addressTranslated ? (
                  <p className="text-sm text-muted-foreground">{b.addressTranslated}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Covers {b.travellerIds.length} {b.travellerIds.length === 1 ? "traveller" : "travellers"}
                </p>
                {b.cancellationDeadline ? (
                  <p className="text-sm">Free cancellation until {b.cancellationDeadline}</p>
                ) : null}

                {b.reference ? (
                  <p className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-sm">
                    <Lock className="size-4" aria-hidden />
                    {canSeeReference ? `Reference ${b.reference}` : "Reference kept with whoever booked it"}
                  </p>
                ) : null}

                {b.status === "confirmed" && b.startLocal ? (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> This is a fixed point —
                    moving the matching stop needs everyone to be told.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {mine && b.reference ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        shareBookingReference(
                          b.id,
                          b.referenceSharedWith.length > 0 ? [] : state.travellers.map((t) => t.id),
                        )
                      }
                    >
                      <Eye className="size-4" aria-hidden />
                      {b.referenceSharedWith.length > 0 ? "Stop sharing the reference" : "Share the reference"}
                    </Button>
                  ) : null}
                  {(mine || organiser) && b.status !== "cancelled" ? (
                    <Button type="button" variant="outline" onClick={() => cancelBooking(b.id)}>
                      Mark as cancelled
                    </Button>
                  ) : null}
                  {mine || organiser ? (
                    <Button type="button" variant="outline" onClick={() => deleteBooking(b.id)}>
                      <Trash2 className="size-4" aria-hidden /> Remove
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
