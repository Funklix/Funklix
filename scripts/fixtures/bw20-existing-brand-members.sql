-- Disposable supported baseline, copied from main a1f72e6. Never run on production.
      CREATE TABLE IF NOT EXISTS brand_members (
        brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NULL,
        avatar TEXT NULL,
        invited_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT brand_members_brand_email_key UNIQUE (brand_id, email),
        CONSTRAINT brand_members_email_lowercase_check CHECK (email = LOWER(email)),
        CONSTRAINT brand_members_role_check CHECK (role IN ('admin', 'editor', 'viewer'))
      );
      CREATE INDEX IF NOT EXISTS brand_members_email_brand_idx ON brand_members (email, brand_id);
      CREATE INDEX IF NOT EXISTS brand_members_brand_idx ON brand_members (brand_id);
