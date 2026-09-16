CREATE TABLE public.kintrip_trips (
  trip_id TEXT PRIMARY KEY,
  share_code TEXT NOT NULL UNIQUE,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.kintrip_trips TO service_role;

ALTER TABLE public.kintrip_trips ENABLE ROW LEVEL SECURITY;