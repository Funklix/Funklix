-- Disposable legacy Board schema snapshot; never production input.

      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        canvas_json JSONB NOT NULL,
        brand_core_snapshot JSONB,
        order_index INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    ;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot JSONB;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS order_index INTEGER;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_view_enabled BOOLEAN NOT NULL DEFAULT FALSE;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_view_token_hash TEXT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_view_token_created_at TIMESTAMPTZ;;

        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_public_view_state_check CHECK (
            (public_view_enabled = FALSE AND public_view_token_hash IS NULL AND public_view_token_created_at IS NULL)
            OR (public_view_enabled = TRUE AND public_view_token_hash ~ '^[0-9a-f]{64}$' AND public_view_token_created_at IS NOT NULL)
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      ;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_id TEXT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_email TEXT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_name TEXT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_avatar TEXT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS created_by TEXT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_id UUID;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_source_revision BIGINT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_source_updated_at TIMESTAMPTZ;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot_copied_at TIMESTAMPTZ;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot_backup JSONB;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_backup_source_revision BIGINT;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_backup_source_updated_at TIMESTAMPTZ;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_backup_snapshot_copied_at TIMESTAMPTZ;;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot_backup_created_at TIMESTAMPTZ;;

        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_brand_core_source_revision_check
            CHECK (brand_core_source_revision IS NULL OR brand_core_source_revision > 0);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      ;

        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_brand_core_backup_source_revision_check
            CHECK (brand_core_backup_source_revision IS NULL OR brand_core_backup_source_revision > 0);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      ;
CREATE INDEX IF NOT EXISTS boards_brand_id_idx ON boards (brand_id);;

        CREATE TABLE IF NOT EXISTS board_editors (
          board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'editor',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          CHECK (email = LOWER(email)),
          CONSTRAINT board_editors_role_check CHECK (role IN ('editor', 'viewer'))
        );
      ;
ALTER TABLE board_editors ADD COLUMN IF NOT EXISTS name TEXT;;
ALTER TABLE board_editors ADD COLUMN IF NOT EXISTS avatar TEXT;;

        DO $$ DECLARE constraint_name TEXT; BEGIN
          SELECT conname INTO constraint_name FROM pg_constraint
          WHERE conrelid = 'board_editors'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%role%';
          IF constraint_name IS NOT NULL AND pg_get_constraintdef(
            (SELECT oid FROM pg_constraint WHERE conrelid = 'board_editors'::regclass AND conname = constraint_name)
          ) NOT LIKE '%viewer%' THEN
            EXECUTE format('ALTER TABLE board_editors DROP CONSTRAINT %I', constraint_name);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'board_editors'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%' AND pg_get_constraintdef(oid) LIKE '%viewer%') THEN
            ALTER TABLE board_editors ADD CONSTRAINT board_editors_role_check CHECK (role IN ('editor', 'viewer'));
          END IF;
        END $$;
      ;
CREATE UNIQUE INDEX IF NOT EXISTS board_editors_board_email_uidx ON board_editors (board_id, email);;
CREATE INDEX IF NOT EXISTS board_editors_email_idx ON board_editors (email);;
CREATE INDEX IF NOT EXISTS board_editors_board_id_idx ON board_editors (board_id);;
ALTER TABLE boards ADD CONSTRAINT boards_brand_id_fkey FOREIGN KEY(brand_id) REFERENCES brands(id) ON DELETE SET NULL;
