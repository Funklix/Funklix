-- BW-36.12: one durable logo authority on the reusable Brand.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_object_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS logo_mime_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS logo_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS logo_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS logo_source_host TEXT NULL;

ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_logo_metadata_check;
ALTER TABLE public.brands ADD CONSTRAINT brands_logo_metadata_check CHECK (
  (logo_object_path IS NULL AND logo_mime_type IS NULL AND logo_source IS NULL AND logo_source_host IS NULL)
  OR (length(logo_object_path) BETWEEN 1 AND 2048
      AND logo_mime_type IN ('image/png','image/jpeg','image/webp','image/gif')
      AND logo_source IN ('uploaded','discovered')
      AND (logo_source_host IS NULL OR length(logo_source_host) <= 253))
);
DO $$ BEGIN
  ALTER TABLE public.brands ADD CONSTRAINT brands_logo_revision_check CHECK (logo_revision >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
