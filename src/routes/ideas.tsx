import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Lightbulb, MapPin, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { trackProduct } from "@/lib/kintrip/track";
import { actorName, isOrganiser } from "@/lib/kintrip/governance";
import { needsLocation } from "@/lib/kintrip/enhancements";
import { resolveIdeaLocation, saveIdea } from "@/lib/kintrip/enhancements.actions";
import { searchPlaces, type PlaceResult } from "@/lib/kintrip/places.functions";

export const Route = createFileRoute("/ideas")({
  head: () => ({
    meta: [
      { title: "Save an idea — CommonRoute" },
      { name: "description", content: "Save a place name, a note or a link in seconds. Add the location later." },
      { property: "og:title", content: "Save an idea — CommonRoute" },
      { property: "og:description", content: "Quick trip ideas without the form: add details when you have a moment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IdeasScreen,
});

const newKey = () => `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function IdeasScreen() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const keyRef = useRef(newKey());

  const incomplete = useMemo(() => state.attractions.filter(needsLocation), [state.attractions]);

  const save = (allowDuplicate = false) => {
    setError(null);
    setMessage(null);
    const out = saveIdea({ text, note: note || undefined, captureKey: keyRef.current, allowDuplicate });
    if (out.error) {
      setError(out.error);
      setDupId(out.duplicateOf ?? null);
      return;
    }
    setDupId(null);
    setSavedId(out.savedId ?? null);
    trackProduct(state, "idea_saved");
    setMessage("Saved. It is on the shortlist and can be discussed now.");
  };

  const another = () => {
    setText("");
    setNote("");
    setMessage(null);
    setSavedId(null);
    keyRef.current = newKey();
  };

  return (
    <AppShell title="Save an idea" subtitle="A name, a note or a link is enough">
      <Card className="space-y-3">
        <Field label="Place, note or link">
          <input
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. that matcha café near the station"
            maxLength={500}
          />
        </Field>
        <Field label="Why it caught your eye (optional)">
          <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        <p className="text-xs text-muted-foreground">
          Seen by everyone on this trip, like other suggestions. Nothing is looked up, fetched or charged when you save.
        </p>
        {error ? (
          <div role="alert" className="rounded-xl bg-sunny-soft px-3 py-2 text-sm">
            {error}
            {dupId ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/fit/$attractionId" params={{ attractionId: dupId }} className="font-semibold underline">
                  Open the existing one
                </Link>
                <button type="button" className="font-semibold underline" onClick={() => save(true)}>
                  It is a different place — save anyway
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {message ? (
          <div role="status" className="rounded-xl bg-primary-soft px-3 py-2 text-sm">
            {message}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {savedId ? (
            <>
              <Button type="button" onClick={another}>
                <Plus className="size-4" aria-hidden /> Suggest another
              </Button>
              <a href="#needs-location" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-semibold">
                Add details
              </a>
            </>
          ) : (
            <Button type="button" onClick={() => save()} disabled={text.trim().length < 2}>
              <Lightbulb className="size-4" aria-hidden /> Save idea
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-3" >
        <h2 id="needs-location" className="text-lg">Location needed</h2>
        <p className="text-sm text-muted-foreground">
          These can be voted on and discussed, but stay out of routes and timings until a map result is chosen.
        </p>
        {incomplete.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every idea has a location.</p>
        ) : (
          <ul className="space-y-3">
            {incomplete.map((a) => (
              <IdeaRow
                key={a.id}
                id={a.id}
                name={a.name}
                note={a.ideaNote}
                url={a.sourceUrl}
                by={state.suggestions[a.id]?.suggestedBy}
                canEdit={organiser || state.suggestions[a.id]?.suggestedBy === state.activeTravellerId}
                destination={state.trip.destination}
                byName={(id) => actorName(state, id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}

function IdeaRow(props: {
  id: string;
  name: string;
  note?: string | undefined;
  url?: string | undefined;
  by?: string | undefined;
  canEdit: boolean;
  destination: string;
  byName: (id: string) => string;
}) {
  const [q, setQ] = useState(props.name);
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const find = () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    searchPlaces({ data: { query: q.trim(), destination: props.destination, provider: "free" } })
      .then((o) => setResults(o.results.slice(0, 5)))
      .catch(() => setErr("Map search is not answering right now. Your idea is safe — try again later."))
      .finally(() => setBusy(false));
  };

  return (
    <li className="rounded-xl bg-muted px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{props.name}</p>
        <Chip tone="sunny">
          <MapPin className="size-3" aria-hidden /> Location needed
        </Chip>
      </div>
      {props.note ? <p className="mt-1 text-sm">{props.note}</p> : null}
      <p className="text-xs text-muted-foreground">
        {props.by ? `Saved by ${props.byName(props.by)}` : "Saved"}
        {props.url ? (
          <>
            {" · "}
            <a href={props.url} target="_blank" rel="noreferrer noopener" className="underline">
              open link
            </a>
          </>
        ) : null}
      </p>
      {props.canEdit ? (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search the map for ${props.name}`} />
            <Button type="button" variant="outline" onClick={find} disabled={busy}>
              <Search className="size-4" aria-hidden /> {busy ? "Searching…" : "Find"}
            </Button>
          </div>
          {err ? <p className="text-sm">{err}</p> : null}
          {results && results.length === 0 ? <p className="text-sm text-muted-foreground">No map results. Try a different name — the idea stays as it is.</p> : null}
          {results?.map((r) => (
            <button
              key={r.placeId}
              type="button"
              className="block min-h-11 w-full rounded-xl bg-card px-3 py-2 text-left text-sm"
              onClick={() => {
                const e = resolveIdeaLocation(props.id, r);
                if (e) setErr(e);
              }}
            >
              <span className="font-semibold">{r.name}</span>
              <span className="block text-xs text-muted-foreground">{r.address}</span>
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
