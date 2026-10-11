-- BW-36.17: additive foundation. Execute complete file exactly once after merge.
-- No runtime DDL, backfill, or changes to existing Brand/Board/Workspace records.
BEGIN;
CREATE TABLE public.brand_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','archived')),
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 2000),
  statement_key text NOT NULL CHECK (statement_key ~ '^[a-f0-9]{64}$'),
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','campaign_observation','ai_suggestion')),
  source_board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL,
  source_node_id text CHECK (char_length(source_node_id) BETWEEN 1 AND 200),
  evidence_summary text CHECK (char_length(evidence_summary) BETWEEN 1 AND 4000),
  proposed_by_identity_id uuid NOT NULL REFERENCES public.app_identities(id) ON DELETE RESTRICT,
  reviewed_by_identity_id uuid REFERENCES public.app_identities(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  supersedes_learning_id uuid,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, id),
  FOREIGN KEY (brand_id, supersedes_learning_id) REFERENCES public.brand_learnings(brand_id, id),
  CHECK (supersedes_learning_id IS DISTINCT FROM id),
  CHECK ((status = 'proposed' AND reviewed_by_identity_id IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved','rejected','archived') AND reviewed_by_identity_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX brand_learnings_listing_idx ON public.brand_learnings(brand_id, status, updated_at DESC, id);
CREATE INDEX brand_learnings_successor_idx ON public.brand_learnings(brand_id, supersedes_learning_id);
CREATE UNIQUE INDEX brand_learnings_proposal_key ON public.brand_learnings(brand_id, statement_key) WHERE status = 'proposed';
CREATE UNIQUE INDEX brand_learnings_approved_key ON public.brand_learnings(brand_id, statement_key) WHERE status = 'approved';
CREATE UNIQUE INDEX brand_learnings_open_successor_key ON public.brand_learnings(brand_id, supersedes_learning_id)
  WHERE status = 'proposed' AND supersedes_learning_id IS NOT NULL;

CREATE TABLE public.brand_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  learning_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('proposed','proposal_edited','approved','rejected','archived','successor_proposed','superseded')),
  actor_identity_id uuid NOT NULL REFERENCES public.app_identities(id) ON DELETE RESTRICT,
  previous_status text CHECK (previous_status IN ('proposed','approved','rejected','archived')),
  next_status text NOT NULL CHECK (next_status IN ('proposed','approved','rejected','archived')),
  learning_revision bigint NOT NULL CHECK (learning_revision >= 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 40000
    AND snapshot ?& ARRAY['statement','source_type'] AND jsonb_typeof(snapshot->'statement') = 'string' AND jsonb_typeof(snapshot->'source_type') = 'string' AND char_length(snapshot->>'statement') BETWEEN 1 AND 2000
    AND (snapshot->>'evidence_summary' IS NULL OR char_length(snapshot->>'evidence_summary') BETWEEN 1 AND 4000)
    AND snapshot->>'source_type' IN ('manual','campaign_observation','ai_suggestion')
    AND (snapshot - ARRAY['statement','evidence_summary','source_type','supersedes_learning_id']) = '{}'::jsonb),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id, learning_id) REFERENCES public.brand_learnings(brand_id, id) ON DELETE CASCADE,
  UNIQUE (learning_id, learning_revision, event_type)
);
CREATE INDEX brand_learning_events_history_idx ON public.brand_learning_events(brand_id, learning_id, created_at DESC, id);

-- Defense in depth for lifecycle and immutable ownership/provenance.
CREATE FUNCTION public.guard_brand_learning_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'proposed' OR NEW.revision <> 0 THEN RAISE EXCEPTION 'learning_insert_state'; END IF;
  ELSE
    IF NEW.id <> OLD.id OR NEW.brand_id <> OLD.brand_id OR NEW.proposed_by_identity_id <> OLD.proposed_by_identity_id
      OR NEW.created_at <> OLD.created_at OR NEW.source_type <> OLD.source_type
      OR NEW.source_board_id IS DISTINCT FROM OLD.source_board_id
      OR NEW.source_node_id IS DISTINCT FROM OLD.source_node_id
      OR NEW.supersedes_learning_id IS DISTINCT FROM OLD.supersedes_learning_id
      OR NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'learning_revision_or_ownership'; END IF;
    IF NOT ((OLD.status = 'proposed' AND NEW.status IN ('proposed','approved','rejected'))
      OR (OLD.status = 'approved' AND NEW.status = 'archived')) THEN RAISE EXCEPTION 'learning_transition'; END IF;
    IF OLD.status <> 'proposed' AND (NEW.statement <> OLD.statement OR NEW.statement_key <> OLD.statement_key
      OR NEW.evidence_summary IS DISTINCT FROM OLD.evidence_summary
      OR NEW.reviewed_by_identity_id IS DISTINCT FROM OLD.reviewed_by_identity_id
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'learning_approved_immutable'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER brand_learning_lifecycle BEFORE INSERT OR UPDATE ON public.brand_learnings
  FOR EACH ROW EXECUTE FUNCTION public.guard_brand_learning_lifecycle();

-- Append-only while the owning Brand exists; authorized Brand cascade remains possible.
CREATE FUNCTION public.guard_brand_learning_history() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM public.brands WHERE id = OLD.brand_id) THEN
    RAISE EXCEPTION 'learning_history_immutable';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER brand_learning_no_delete BEFORE DELETE ON public.brand_learnings
  FOR EACH ROW EXECUTE FUNCTION public.guard_brand_learning_history();
CREATE TRIGGER brand_learning_events_append_only BEFORE UPDATE OR DELETE ON public.brand_learning_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_brand_learning_history();

CREATE FUNCTION public.guard_brand_learning_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'learning_history_immutable'; END $$;
CREATE TRIGGER brand_learning_no_truncate BEFORE TRUNCATE ON public.brand_learnings
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_brand_learning_truncate();
CREATE TRIGGER brand_learning_events_no_truncate BEFORE TRUNCATE ON public.brand_learning_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_brand_learning_truncate();

ALTER TABLE public.brand_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_learning_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_learnings, public.brand_learning_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_brand_learning_lifecycle(), public.guard_brand_learning_history(), public.guard_brand_learning_truncate() FROM PUBLIC, anon, authenticated;
-- No browser policies. The established privileged pg transport still requires application ACL.
COMMIT;
