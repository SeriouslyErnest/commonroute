import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, BedDouble, Car, Eye, ListChecks, Phone, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { actorName, editableTravellers } from "@/lib/kintrip/governance";
import {
  canManageLogistics,
  maySeeRoomNumber,
  seesOwnAllocation,
  unhousedTravellers,
  vehicleOccupants,
  vehicleWarnings,
  visibleEmergencyCards,
} from "@/lib/kintrip/coordination";
import {
  addRoom,
  addSweepJobs,
  addVehicle,
  assignToRoom,
  assignToVehicle,
  removeEmergencyCard,
  removeFromRoom,
  removeFromVehicle,
  removeRoom,
  removeVehicle,
  saveEmergencyCard,
  setDriver,
} from "@/lib/kintrip/coordination.actions";

export const Route = createFileRoute("/logistics")({
  head: () => ({
    meta: [
      { title: "Rooms, vehicles and contacts — CommonRoute" },
      {
        name: "description",
        content:
          "Decide who sleeps where and who travels in which vehicle, with room numbers kept to the people who need them.",
      },
      { property: "og:title", content: "Rooms, vehicles and contacts — CommonRoute" },
      {
        property: "og:description",
        content: "Room and seat allocations that refuse to overfill, plus one contact card per traveller.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogisticsScreen,
});

function LogisticsScreen() {
  const state = useKintrip();
  const mayEdit = canManageLogistics(state);
  const [error, setError] = useState<string | null>(null);
  const [openRoom, setOpenRoom] = useState(false);
  const [openVehicle, setOpenVehicle] = useState(false);
  const [room, setRoom] = useState({
    label: "",
    fromDate: state.trip.startDate,
    toDate: state.trip.endDate,
    roomNumber: "",
    occupancy: "",
    bedCount: "",
  });
  const [vehicle, setVehicle] = useState({
    label: "",
    segmentId: "",
    driverId: "",
    seats: "",
    childSeats: "0",
    luggageNote: "",
  });
  const [card, setCard] = useState({
    travellerId: state.activeTravellerId,
    contactName: "",
    contactPhone: "",
    allergyNote: "",
    visibility: "organisers" as "organisers" | "group",
  });

  const run = (result: string | null) => setError(result);
  const unhoused = unhousedTravellers(state);
  const cards = visibleEmergencyCards(state);
  const mine = editableTravellers(state);

  return (
    <AppShell title="Rooms, vehicles and contacts" subtitle="Who sleeps where, who travels with whom">
      {error ? (
        <Card className="border-coral bg-coral-soft">
          <p className="inline-flex items-start gap-2 text-sm font-semibold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        </Card>
      ) : null}

      {/* ---------------- rooms ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Rooms</h2>
        {mayEdit ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-3 text-sm"
            onClick={() => setOpenRoom((v) => !v)}
          >
            <Plus className="size-4" aria-hidden /> Add a room
          </Button>
        ) : null}
      </div>

      {openRoom && mayEdit ? (
        <Card className="space-y-3">
          <Field label="Name for the room">
            <input
              className={inputClass}
              value={room.label}
              onChange={(e) => setRoom({ ...room, label: e.target.value })}
              placeholder="Family room"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First night">
              <input
                className={inputClass}
                type="date"
                value={room.fromDate}
                onChange={(e) => setRoom({ ...room, fromDate: e.target.value })}
              />
            </Field>
            <Field label="Checkout day">
              <input
                className={inputClass}
                type="date"
                value={room.toDate}
                onChange={(e) => setRoom({ ...room, toDate: e.target.value })}
              />
            </Field>
            <Field label="Room number (kept private)">
              <input
                className={inputClass}
                value={room.roomNumber}
                onChange={(e) => setRoom({ ...room, roomNumber: e.target.value })}
              />
            </Field>
            <Field label="People allowed (leave blank if unconfirmed)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={room.occupancy}
                onChange={(e) => setRoom({ ...room, occupancy: e.target.value })}
              />
            </Field>
            <Field label="Beds (optional)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={room.bedCount}
                onChange={(e) => setRoom({ ...room, bedCount: e.target.value })}
              />
            </Field>
          </div>
          <Button
            type="button"
            onClick={() => {
              const err = addRoom({
                label: room.label,
                fromDate: room.fromDate,
                toDate: room.toDate,
                roomNumber: room.roomNumber || undefined,
                occupancy: room.occupancy ? Number(room.occupancy) : undefined,
                bedCount: room.bedCount ? Number(room.bedCount) : undefined,
              });
              run(err);
              if (!err) {
                setOpenRoom(false);
                setRoom({ ...room, label: "", roomNumber: "", occupancy: "", bedCount: "" });
              }
            }}
          >
            Save this room
          </Button>
        </Card>
      ) : null}

      {state.rooms.length === 0 ? (
        <Card>
          <p className="text-sm">No rooms yet. Add them once the stay is booked.</p>
        </Card>
      ) : (
        state.rooms.map((r) => {
          const free =
            typeof r.occupancy === "number" ? r.occupancy - r.occupantIds.length : undefined;
          return (
            <Card key={r.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 font-bold">
                  <BedDouble className="size-4 text-secondary" aria-hidden /> {r.label}
                  {maySeeRoomNumber(state, r) && r.roomNumber ? ` · Room ${r.roomNumber}` : ""}
                </p>
                <Chip tone={typeof free === "number" ? (free > 0 ? "lime" : "neutral") : "sunny"}>
                  {typeof free === "number"
                    ? free > 0
                      ? `${free} place${free === 1 ? "" : "s"} free`
                      : "Full"
                    : "Permitted number not verified"}
                </Chip>
              </div>
              <p className="text-sm text-muted-foreground">
                {r.fromDate} to {r.toDate} (checkout){r.bedCount ? ` · ${r.bedCount} beds` : ""}
              </p>
              {r.bedNotes.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Beds: {r.bedNotes.map((b) => b.label).join(", ")}
                </p>
              ) : null}
              <ul className="space-y-1 text-sm">
                {r.occupantIds.length === 0 ? (
                  <li className="text-muted-foreground">Nobody in this room yet.</li>
                ) : (
                  r.occupantIds.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-2">
                      <span>
                        {actorName(state, id)}
                        {seesOwnAllocation(state, id) ? " · you" : ""}
                      </span>
                      {mayEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 px-2 text-sm"
                          aria-label={`Take ${actorName(state, id)} out of ${r.label}`}
                          onClick={() => run(removeFromRoom(r.id, id))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {mayEdit ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-sm font-semibold">Put someone in this room</span>
                    <select
                      className={inputClass}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) run(assignToRoom(r.id, e.target.value));
                        e.target.value = "";
                      }}
                    >
                      <option value="">Choose a person…</option>
                      {state.travellers
                        .filter((t) => !r.occupantIds.includes(t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => run(addSweepJobs(r.id))}
                  >
                    <ListChecks className="size-4" aria-hidden /> Add last-look jobs
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => run(removeRoom(r.id))}
                  >
                    Remove room
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      {unhoused.length > 0 ? (
        <Card className="border-sunny bg-sunny-soft">
          <p className="text-sm font-semibold">
            Nobody has a room for: {unhoused.map((t) => t.name).join(", ")}.
          </p>
        </Card>
      ) : null}

      {/* ---------------- vehicles ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Vehicles</h2>
        {mayEdit ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-3 text-sm"
            onClick={() => setOpenVehicle((v) => !v)}
          >
            <Plus className="size-4" aria-hidden /> Add a vehicle
          </Button>
        ) : null}
      </div>

      {openVehicle && mayEdit ? (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={inputClass}
                value={vehicle.label}
                onChange={(e) => setVehicle({ ...vehicle, label: e.target.value })}
                placeholder="Hired van"
              />
            </Field>
            <Field label="Which journey">
              <input
                className={inputClass}
                value={vehicle.segmentId}
                onChange={(e) => setVehicle({ ...vehicle, segmentId: e.target.value })}
                placeholder="Day 3 — airport transfer"
              />
            </Field>
            <Field label="Seats including the driver">
              <input
                className={inputClass}
                inputMode="numeric"
                value={vehicle.seats}
                onChange={(e) => setVehicle({ ...vehicle, seats: e.target.value })}
              />
            </Field>
            <Field label="Child seats fitted">
              <input
                className={inputClass}
                inputMode="numeric"
                value={vehicle.childSeats}
                onChange={(e) => setVehicle({ ...vehicle, childSeats: e.target.value })}
              />
            </Field>
            <Field label="Driver">
              <select
                className={inputClass}
                value={vehicle.driverId}
                onChange={(e) => setVehicle({ ...vehicle, driverId: e.target.value })}
              >
                <option value="">Not decided yet</option>
                {state.travellers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Luggage note">
              <input
                className={inputClass}
                value={vehicle.luggageNote}
                onChange={(e) => setVehicle({ ...vehicle, luggageNote: e.target.value })}
              />
            </Field>
          </div>
          <Button
            type="button"
            onClick={() => {
              const err = addVehicle({
                label: vehicle.label,
                segmentId: vehicle.segmentId,
                driverId: vehicle.driverId || undefined,
                seats: vehicle.seats ? Number(vehicle.seats) : undefined,
                childSeats: Number(vehicle.childSeats || 0),
                luggageNote: vehicle.luggageNote || undefined,
              });
              run(err);
              if (!err) {
                setOpenVehicle(false);
                setVehicle({ ...vehicle, label: "", segmentId: "", luggageNote: "" });
              }
            }}
          >
            Save this vehicle
          </Button>
        </Card>
      ) : null}

      {state.vehicles.length === 0 ? (
        <Card>
          <p className="text-sm">No vehicles yet. Add one for any journey by car or van.</p>
        </Card>
      ) : (
        state.vehicles.map((v) => {
          const occupants = vehicleOccupants(v);
          const warnings = vehicleWarnings(state, v);
          return (
            <Card key={v.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 font-bold">
                  <Car className="size-4 text-secondary" aria-hidden /> {v.label}
                </p>
                <Chip tone={typeof v.seats === "number" ? "lime" : "sunny"}>
                  {typeof v.seats === "number"
                    ? `${occupants.length} of ${v.seats} seats`
                    : "Seats not verified"}
                </Chip>
              </div>
              <p className="text-sm text-muted-foreground">
                {v.segmentId}
                {v.driverId ? ` · driven by ${actorName(state, v.driverId)}` : ""}
                {v.luggageNote ? ` · ${v.luggageNote}` : ""}
              </p>
              {warnings.map((w) => (
                <p key={w} className="rounded-xl bg-sunny-soft p-3 text-sm font-semibold">
                  {w}
                </p>
              ))}
              <ul className="space-y-1 text-sm">
                {occupants.length === 0 ? (
                  <li className="text-muted-foreground">Nobody in this vehicle yet.</li>
                ) : (
                  occupants.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-2">
                      <span>
                        {actorName(state, id)}
                        {id === v.driverId ? " · driving" : ""}
                      </span>
                      {mayEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 px-2 text-sm"
                          aria-label={`Take ${actorName(state, id)} out of ${v.label}`}
                          onClick={() => run(removeFromVehicle(v.id, id))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {mayEdit ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-sm font-semibold">Add a passenger</span>
                    <select
                      className={inputClass}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) run(assignToVehicle(v.id, e.target.value));
                        e.target.value = "";
                      }}
                    >
                      <option value="">Choose a person…</option>
                      {state.travellers
                        .filter((t) => !occupants.includes(t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-sm font-semibold">Driver</span>
                    <select
                      className={inputClass}
                      value={v.driverId ?? ""}
                      onChange={(e) => run(setDriver(v.id, e.target.value || undefined))}
                    >
                      <option value="">Not decided yet</option>
                      {state.travellers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => run(removeVehicle(v.id))}
                  >
                    Remove vehicle
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      {/* ---------------- contact cards ---------------- */}
      <h2 className="text-lg">Contact cards</h2>
      <Card className="space-y-3">
        <p className="text-sm text-muted-foreground">
          One name, one phone number and one allergy line per traveller, kept for the offline pack.
          This is not an emergency service — in an emergency call the local emergency number.
        </p>
        {cards.map((c) => (
          <div key={c.travellerId} className="flex items-start justify-between gap-2 border-t border-border pt-3">
            <span className="min-w-0">
              <span className="block font-semibold">
                <Phone className="mr-1 inline size-4 text-secondary" aria-hidden />
                {actorName(state, c.travellerId)} → {c.contactName}
              </span>
              <span className="block text-sm text-muted-foreground">
                {c.contactPhone}
                {c.allergyNote ? ` · ${c.allergyNote}` : ""} ·{" "}
                {c.visibility === "group" ? "Whole group can see it" : "Organisers only"}
              </span>
            </span>
            {mine.some((t) => t.id === c.travellerId) || mayEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 px-2 text-sm"
                aria-label={`Remove the card for ${actorName(state, c.travellerId)}`}
                onClick={() => run(removeEmergencyCard(c.travellerId))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}

        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Field label="Who it is for">
            <select
              className={inputClass}
              value={card.travellerId}
              onChange={(e) => setCard({ ...card, travellerId: e.target.value })}
            >
              {(mayEdit ? state.travellers : mine).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Person to call">
            <input
              className={inputClass}
              value={card.contactName}
              onChange={(e) => setCard({ ...card, contactName: e.target.value })}
            />
          </Field>
          <Field label="Phone number">
            <input
              className={inputClass}
              value={card.contactPhone}
              onChange={(e) => setCard({ ...card, contactPhone: e.target.value })}
            />
          </Field>
          <Field label="One allergy line (optional)">
            <input
              className={inputClass}
              value={card.allergyNote}
              onChange={(e) => setCard({ ...card, allergyNote: e.target.value })}
            />
          </Field>
          <Field label="Who can see it">
            <select
              className={inputClass}
              value={card.visibility}
              onChange={(e) =>
                setCard({ ...card, visibility: e.target.value as "organisers" | "group" })
              }
            >
              <option value="organisers">Organisers only</option>
              <option value="group">Everyone on the trip</option>
            </select>
          </Field>
        </div>
        <Button
          type="button"
          onClick={() => {
            const err = saveEmergencyCard({
              travellerId: card.travellerId,
              contactName: card.contactName,
              contactPhone: card.contactPhone,
              allergyNote: card.allergyNote || undefined,
              visibility: card.visibility,
            });
            run(err);
            if (!err) setCard({ ...card, contactName: "", contactPhone: "", allergyNote: "" });
          }}
        >
          <Eye className="size-4" aria-hidden /> Save this card
        </Button>
      </Card>
    </AppShell>
  );
}
