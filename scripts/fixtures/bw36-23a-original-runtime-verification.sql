DO $verify$
DECLARE runtime_role record;
BEGIN
  FOR runtime_role IN WITH RECURSIVE members(oid) AS (
    SELECT oid FROM pg_roles WHERE rolname='brand_knowledge_runtime'
    UNION SELECT m.member FROM pg_auth_members m JOIN members r ON m.roleid=r.oid
  ) SELECT p.* FROM pg_roles p JOIN members m ON p.oid=m.oid LOOP
    IF runtime_role.rolsuper OR runtime_role.rolbypassrls OR runtime_role.rolcreaterole OR runtime_role.rolcreatedb OR runtime_role.rolreplication
      OR pg_has_role(runtime_role.oid,'brand_knowledge_owner','MEMBER')
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
