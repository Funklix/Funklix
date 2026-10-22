-- Operator-only read verification: history/fingerprint checks require explicit owner SET.
BEGIN READ ONLY;
SET LOCAL ROLE brand_knowledge_owner;
DO $verify$
DECLARE runtime_role record;
BEGIN
  -- PG16+ records creator/operator ADMIN-only memberships. These confer neither
  -- inherited privileges nor SET ROLE. Only elevated LOGIN operators already
  -- authorized to SET the owner may administer the group without joining this
  -- capability closure. INHERIT/SET edges are always checked, including postgres.
  FOR runtime_role IN WITH RECURSIVE members(oid) AS (
    SELECT oid FROM pg_roles WHERE rolname='brand_knowledge_runtime'
    UNION SELECT m.member FROM pg_auth_members m JOIN members r ON m.roleid=r.oid
      WHERE NOT (m.admin_option AND NOT m.inherit_option AND NOT m.set_option
        AND EXISTS(SELECT FROM pg_roles op WHERE op.oid=m.member AND op.rolcanlogin
          AND (op.rolsuper OR op.rolcreaterole)
          AND pg_has_role(op.oid,'brand_knowledge_owner','SET')))
  ) SELECT p.* FROM pg_roles p JOIN members m ON p.oid=m.oid LOOP
    IF runtime_role.rolsuper OR runtime_role.rolbypassrls OR runtime_role.rolcreaterole OR runtime_role.rolcreatedb OR runtime_role.rolreplication
      OR EXISTS(SELECT FROM pg_auth_members m WHERE m.member=runtime_role.oid
        AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)
      OR pg_has_role(runtime_role.oid,'brand_knowledge_owner','MEMBER')
      OR EXISTS(SELECT FROM pg_roles elevated WHERE
        (elevated.rolsuper OR elevated.rolbypassrls OR elevated.rolcreaterole OR elevated.rolcreatedb OR elevated.rolreplication)
        AND pg_has_role(runtime_role.oid,elevated.oid,'MEMBER'))
      OR has_table_privilege(runtime_role.oid,'public.brands','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      OR has_any_column_privilege(runtime_role.oid,'public.brands','INSERT,UPDATE,REFERENCES')
      OR has_table_privilege(runtime_role.oid,'public.brand_knowledge_history','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,SELECT')
      OR has_any_column_privilege(runtime_role.oid,'public.brand_knowledge_history','INSERT,UPDATE,SELECT')
      OR has_schema_privilege(runtime_role.oid,'brand_knowledge_private','CREATE')
      OR has_schema_privilege(runtime_role.oid,'public','CREATE') THEN
      RAISE EXCEPTION 'UNSAFE_RUNTIME_PRIVILEGES: %',runtime_role.rolname;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.brand_knowledge_history'::regclass AND conname='brand_history_source' AND confdeltype='r')
    OR EXISTS(SELECT FROM public.brands b WHERE NOT EXISTS(SELECT FROM public.brand_knowledge_history h WHERE h.brand_id=b.id AND h.event_seq=b.knowledge_event_seq AND h.after_state=to_jsonb(b))) THEN RAISE EXCEPTION 'PROTECTION_VERIFICATION_FAILED'; END IF;
END $verify$;

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
