-- Safe rollback is a write freeze and roll-forward, not dropping protection.
-- Reviewed operator artifact; never invoked by runtime or this implementation.
BEGIN;
SET LOCAL lock_timeout='5s';
REVOKE EXECUTE ON FUNCTION brand_knowledge_private.write_brand(text,uuid,jsonb,jsonb,boolean),brand_knowledge_private.create_brand(text,uuid,uuid,text,jsonb,uuid),brand_knowledge_private.lifecycle(text,uuid,jsonb,jsonb) FROM brand_knowledge_runtime;
COMMIT;
-- Keep rows, history, triggers and all denied direct-write grants.
-- Drain app instances and use a compatible prior build in read-only mode.
-- Any infrastructure restore needs separate approval and verified backup.
