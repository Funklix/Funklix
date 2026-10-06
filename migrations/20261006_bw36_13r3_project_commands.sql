-- BW-36.13R3. Manual post-merge execution only, after Workspace foundation/identity/backfill.
BEGIN;
CREATE TABLE public.project_commands (
  identity_id uuid NOT NULL REFERENCES public.app_identities(id) ON DELETE RESTRICT,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9._:-]{1,64}$'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  -- Outcome identifiers intentionally survive entity deletion; replay then fails closed.
  brand_id uuid NOT NULL,
  board_id uuid NOT NULL,
  outcome jsonb NOT NULL CHECK (jsonb_typeof(outcome) = 'object'
    AND outcome->>'contract' = 'project_command_v1'
    AND outcome->>'request_id' = request_id
    AND outcome->'workspace'->>'id' = workspace_id::text
    AND outcome->'brand'->>'id' = brand_id::text
    AND outcome->'board'->>'id' = board_id::text),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_id, request_id)
);
ALTER TABLE public.project_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_commands FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.project_commands IS 'Server-only completed project_command_v1 outcomes. No browser policies.';
COMMIT;
