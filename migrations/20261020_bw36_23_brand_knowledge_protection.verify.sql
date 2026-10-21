-- Operator-only read verification: history/fingerprint checks require explicit owner SET.
BEGIN READ ONLY;
SET LOCAL ROLE brand_knowledge_owner;
SELECT brand_knowledge_private.install_fingerprint() = obj_description(to_regnamespace('brand_knowledge_private')) AS catalog_matches_install;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.brand_knowledge_history'::regclass AND conname IN ('brand_history_brand_event','brand_history_source','brand_history_mutation','brand_history_sequence');
SELECT count(*) AS canonical_rows, count(*) FILTER(WHERE NOT EXISTS (SELECT FROM public.brand_knowledge_history h WHERE h.brand_id=b.id AND h.event_seq=b.knowledge_event_seq AND h.after_state=to_jsonb(b))) AS rows_without_exact_history FROM public.brands b;
SELECT count(*) AS baseline_rows FROM public.brand_knowledge_history WHERE operation_type='baseline';
RESET ROLE;
SELECT current_user,rolsuper,rolbypassrls,rolcreaterole,rolreplication,pg_has_role(current_user,'brand_knowledge_owner','MEMBER') AS owner_membership FROM pg_roles WHERE rolname=current_user;
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,has_any_column_privilege(current_user,c.oid,'UPDATE') AS can_update_column,has_table_privilege(current_user,c.oid,'DELETE') AS can_delete,has_table_privilege(current_user,c.oid,'TRUNCATE') AS can_truncate,has_table_privilege(current_user,c.oid,'TRIGGER') AS can_trigger FROM pg_class c WHERE c.oid IN ('public.brands'::regclass,'public.brand_knowledge_history'::regclass);
SELECT p.proname,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,has_function_privilege(current_user,p.oid,'EXECUTE') AS executable FROM pg_proc p WHERE pronamespace='brand_knowledge_private'::regnamespace ORDER BY proname;
-- Operator: rows_without_exact_history=0, catalog_matches_install=true.
-- This entire file is operator-only. Use the R3 verifier and separate runtime
-- probes for the actual app login; runtime cannot SET the owner or read history.
COMMIT;
