'use strict';
// Server-only. Keep pg behind the established lazy storage boundary so browser and clean checks can load contracts without it.
let ready;
const SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS social_token_secrets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_account_id TEXT NOT NULL, platform TEXT NOT NULL CHECK(platform IN ('linkedin','instagram','facebook','x')),
 encrypted_payload TEXT NOT NULL CHECK(octet_length(encrypted_payload)<=32768), nonce TEXT NOT NULL, authentication_tag TEXT NOT NULL,
 encryption_key_version INTEGER NOT NULL CHECK(encryption_key_version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), rotated_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
 UNIQUE(id,owner_account_id), UNIQUE(id,owner_account_id,platform)
);
CREATE INDEX IF NOT EXISTS social_token_secrets_owner_idx ON social_token_secrets(owner_account_id,platform);
CREATE TABLE IF NOT EXISTS social_connected_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_account_id TEXT NOT NULL, platform TEXT NOT NULL CHECK(platform IN ('linkedin','instagram','facebook','x')), external_account_id TEXT,
 external_display_name TEXT, account_type TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','connected','needs_attention','revoked','disconnected')),
 granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(granted_scopes)='array'), token_secret_id UUID, token_expires_at TIMESTAMPTZ, last_validated_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), disconnected_at TIMESTAMPTZ, schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version=1),
 UNIQUE(id,owner_account_id), UNIQUE(id,owner_account_id,platform), FOREIGN KEY(token_secret_id,owner_account_id,platform) REFERENCES social_token_secrets(id,owner_account_id,platform) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS social_connected_identity_uidx ON social_connected_accounts(owner_account_id,platform,external_account_id) WHERE external_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_connected_owner_idx ON social_connected_accounts(owner_account_id,status);
CREATE TABLE IF NOT EXISTS social_publishing_destinations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), connected_account_id UUID NOT NULL, owner_account_id TEXT NOT NULL, external_destination_id TEXT NOT NULL, destination_type TEXT NOT NULL, display_name TEXT NOT NULL,
 capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(capabilities)='array'), authorization_state TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','unavailable','unauthorized')), active BOOLEAN NOT NULL DEFAULT TRUE,
 last_capability_refresh_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(id,owner_account_id),
 UNIQUE(connected_account_id,external_destination_id), FOREIGN KEY(connected_account_id,owner_account_id) REFERENCES social_connected_accounts(id,owner_account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS social_destinations_owner_idx ON social_publishing_destinations(owner_account_id,status);
CREATE TABLE IF NOT EXISTS social_oauth_attempts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_account_id TEXT NOT NULL, platform TEXT NOT NULL CHECK(platform IN ('linkedin','instagram','facebook','x')), return_path TEXT NOT NULL CHECK(return_path ~ '^/settings'), state_hash TEXT NOT NULL UNIQUE,
 pkce_verifier_reference TEXT, session_binding_fingerprint TEXT NOT NULL, failure_classification TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS social_oauth_owner_idx ON social_oauth_attempts(owner_account_id,created_at DESC);
CREATE TABLE IF NOT EXISTS social_publish_jobs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_account_id TEXT NOT NULL, board_id UUID NOT NULL REFERENCES boards(id) ON DELETE RESTRICT, node_id TEXT NOT NULL, approved_fingerprint TEXT NOT NULL,
 content_snapshot JSONB NOT NULL CHECK(octet_length(content_snapshot::text)<=65536), destination_id UUID NOT NULL, delivery_mode TEXT NOT NULL CHECK(delivery_mode IN ('immediate','scheduled')), requested_delivery_at TIMESTAMPTZ,
 original_local_time TEXT, original_timezone TEXT, status TEXT NOT NULL CHECK(status IN ('draft','queued','validating','delivering','delivered','failed','cancelled','outcome_unknown')), idempotency_key TEXT NOT NULL,
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0), last_safe_error_classification TEXT, created_by_actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), cancelled_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version=1),
 UNIQUE(owner_account_id,idempotency_key), UNIQUE(id,owner_account_id), FOREIGN KEY(destination_id,owner_account_id) REFERENCES social_publishing_destinations(id,owner_account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS social_jobs_board_idx ON social_publish_jobs(board_id,status); CREATE INDEX IF NOT EXISTS social_jobs_delivery_idx ON social_publish_jobs(status,requested_delivery_at);
CREATE TABLE IF NOT EXISTS social_provider_attempts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), publish_job_id UUID NOT NULL, owner_account_id TEXT NOT NULL, adapter_platform TEXT NOT NULL CHECK(adapter_platform IN ('linkedin','instagram','facebook','x')), attempt_number INTEGER NOT NULL CHECK(attempt_number>0), phase TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('started','accepted','rejected','temporary_failure','permanent_failure','outcome_unknown','reconciled')), safe_error_classification TEXT, ambiguous_outcome BOOLEAN NOT NULL DEFAULT FALSE, provider_request_reference TEXT,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ, UNIQUE(publish_job_id,attempt_number), FOREIGN KEY(publish_job_id,owner_account_id) REFERENCES social_publish_jobs(id,owner_account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS social_attempts_job_idx ON social_provider_attempts(publish_job_id,started_at DESC);
CREATE TABLE IF NOT EXISTS social_external_posts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), platform TEXT NOT NULL CHECK(platform IN ('linkedin','instagram','facebook','x')), external_post_id TEXT NOT NULL, destination_id UUID NOT NULL, publish_job_id UUID NOT NULL, owner_account_id TEXT NOT NULL,
 source_board_id UUID NOT NULL REFERENCES boards(id) ON DELETE RESTRICT, source_node_id TEXT NOT NULL, approved_fingerprint TEXT NOT NULL, published_snapshot_reference TEXT NOT NULL, external_url TEXT, published_at TIMESTAMPTZ,
 delivery_state TEXT NOT NULL CHECK(delivery_state IN ('confirmed','outcome_unknown','unavailable','deleted')), deletion_state TEXT NOT NULL CHECK(deletion_state IN ('retained','deleted')), last_synchronized_at TIMESTAMPTZ, schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version=1),
 UNIQUE(platform,external_post_id), UNIQUE(publish_job_id), FOREIGN KEY(destination_id,owner_account_id) REFERENCES social_publishing_destinations(id,owner_account_id) ON DELETE RESTRICT, FOREIGN KEY(publish_job_id,owner_account_id) REFERENCES social_publish_jobs(id,owner_account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS social_external_source_idx ON social_external_posts(owner_account_id,source_board_id,source_node_id);
`;
async function ensureSocialConnectorSchema(poolOverride){if(!ready){const pool=poolOverride||require('../_boards-storage').pool;ready=pool.query(SCHEMA_SQL).catch((error)=>{ready=null;throw error;});}return ready;}
module.exports={SCHEMA_SQL,ensureSocialConnectorSchema};
