'use strict';
// Read-only readiness; schema creation/repair belongs to reviewed operator migrations.
const COLUMNS = Object.freeze({
  "brand_documents": ["id", "board_id", "tile_id", "source_type", "original_filename", "display_filename", "media_type", "extension", "file_size", "content_hash", "storage_key", "upload_status", "malware_scan_status", "page_count", "page_count_status", "schema_version", "created_by", "uploaded_at", "replaced_at", "deleted_at", "active", "revision"],
  "brand_document_upload_intents": ["id", "request_id", "board_id", "tile_id", "source_type", "original_filename", "display_filename", "declared_media_type", "extension", "storage_key", "expected_document_id", "created_by", "status", "created_at", "expires_at"],
  "brand_document_processing_jobs": ["id", "board_id", "tile_id", "source_type", "document_id", "document_revision", "content_hash", "state", "attempt_count", "max_attempts", "safe_error_code", "parser_version", "chunker_version", "scan_status", "scan_reference", "scan_version", "schema_version", "lease_token", "lease_owner", "lease_expires_at", "requested_by", "created_at", "updated_at", "started_at", "completed_at", "cancelled_at", "superseded_at"],
  "brand_document_processing_results": ["id", "job_id", "board_id", "tile_id", "source_type", "document_id", "document_revision", "content_hash", "parser_version", "chunker_version", "scan_reference", "scan_version", "schema_version", "created_at", "superseded_at"],
  "boards": ["id", "name", "canvas_json", "brand_core_snapshot", "order_index", "created_at", "updated_at", "public_view_enabled", "public_view_token_hash", "public_view_token_created_at", "owner_id", "owner_email", "owner_name", "owner_avatar", "created_by", "brand_id", "brand_core_source_revision", "brand_core_source_updated_at", "brand_core_snapshot_copied_at", "brand_core_snapshot_backup", "brand_core_backup_source_revision", "brand_core_backup_source_updated_at", "brand_core_backup_snapshot_copied_at", "brand_core_snapshot_backup_created_at", "workspace_id"],
  "board_editors": ["board_id", "email", "role", "created_at", "created_by", "name", "avatar"],
  "social_token_secrets": ["id", "owner_account_id", "platform", "encrypted_payload", "nonce", "authentication_tag", "encryption_key_version", "created_at", "updated_at", "rotated_at", "revoked_at"],
  "social_connected_accounts": ["id", "owner_account_id", "platform", "external_account_id", "external_display_name", "account_type", "status", "granted_scopes", "token_secret_id", "token_expires_at", "last_validated_at", "created_at", "updated_at", "disconnected_at", "schema_version", "last_oauth_attempt_id"],
  "social_publishing_destinations": ["id", "connected_account_id", "owner_account_id", "external_destination_id", "destination_type", "display_name", "capabilities", "authorization_state", "status", "active", "last_capability_refresh_at", "created_at", "updated_at"],
  "social_oauth_attempts": ["id", "owner_account_id", "platform", "return_path", "state_hash", "pkce_verifier_reference", "session_binding_fingerprint", "failure_classification", "last_confirmed_phase", "client_request_id", "server_request_id", "created_at", "expires_at", "consumed_at"],
  "social_publish_jobs": ["id", "owner_account_id", "board_id", "node_id", "approved_fingerprint", "content_snapshot", "destination_id", "delivery_mode", "requested_delivery_at", "original_local_time", "original_timezone", "status", "idempotency_key", "attempt_count", "last_safe_error_classification", "created_by_actor", "created_at", "updated_at", "cancelled_at", "completed_at", "schema_version"],
  "social_provider_attempts": ["id", "publish_job_id", "owner_account_id", "adapter_platform", "attempt_number", "phase", "status", "safe_error_classification", "ambiguous_outcome", "provider_request_reference", "started_at", "completed_at"],
  "social_external_posts": ["id", "platform", "external_post_id", "destination_id", "publish_job_id", "owner_account_id", "source_board_id", "source_node_id", "approved_fingerprint", "published_snapshot_reference", "external_url", "published_at", "delivery_state", "deletion_state", "last_synchronized_at", "schema_version"],
  "social_connector_schema_version": ["singleton", "version", "updated_at"]
});
async function requireRuntimeTables(client, tables) {
  const result = await client.query(`SELECT c.relname AS table_name,a.attname AS column_name
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
      AND c.relname=ANY($1::text[])`, [tables]);
  for (const table of tables) {
    const present = new Set(result.rows.filter(row=>row.table_name===table).map(row=>row.column_name));
    if (!present.size || (COLUMNS[table]||[]).some(column=>!present.has(column))) {
      throw new Error('RUNTIME_SCHEMA_MIGRATION_REQUIRED:'+table);
    }
  }
  return true;
}
module.exports={requireRuntimeTables,COLUMNS};
