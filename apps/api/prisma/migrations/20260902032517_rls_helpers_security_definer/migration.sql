-- The RLS helper functions query base tables (room_participants, tenant_members,
-- comment_threads, …) that themselves have RLS. As plain functions that means a
-- policy on room_participants calls app.is_room_member() which queries
-- room_participants again → infinite recursion ("stack depth limit exceeded").
--
-- Making them SECURITY DEFINER runs their bodies as the owner (postgres,
-- BYPASSRLS), so the lookups inside a helper skip RLS and the recursion stops.
-- search_path is pinned and every table is schema-qualified.

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app.is_room_member(rid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = rid
        AND rp.user_id = app.current_user_id()
        AND rp.status <> 'revoked'
    )
$$;

CREATE OR REPLACE FUNCTION app.is_room_admin(rid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = rid
        AND rp.user_id = app.current_user_id()
        AND rp.status = 'active'
        AND rp.role = 'admin'
    )
$$;

CREATE OR REPLACE FUNCTION app.my_participant_id(rid text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT rp.id FROM public.room_participants rp
    WHERE rp.room_id = rid
      AND rp.user_id = app.current_user_id()
      AND rp.status <> 'revoked'
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.my_side(rid text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT rp.side::text FROM public.room_participants rp
    WHERE rp.room_id = rid
      AND rp.user_id = app.current_user_id()
      AND rp.status <> 'revoked'
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.is_tenant_member(tid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tid AND tm.user_id = app.current_user_id()
    )
$$;

CREATE OR REPLACE FUNCTION app.is_tenant_manager(tid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tid
        AND tm.user_id = app.current_user_id()
        AND tm.role IN ('owner', 'admin')
    )
$$;

CREATE OR REPLACE FUNCTION app.thread_visible(tid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.comment_threads t
      JOIN public.room_participants author ON author.id = t.created_by
      WHERE t.id = tid
        AND app.is_room_member(t.room_id)
        AND (t.visibility = 'room' OR author.side::text = app.my_side(t.room_id))
    )
$$;

CREATE OR REPLACE FUNCTION app.can_see_document(doc_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = doc_id AND app.is_room_member(d.room_id)
    )
$$;

CREATE OR REPLACE FUNCTION app.can_see_version(v_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.document_versions v
      JOIN public.documents d ON d.id = v.document_id
      WHERE v.id = v_id AND app.is_room_member(d.room_id)
    )
$$;

-- SECURITY DEFINER functions are executable by PUBLIC by default; keep the
-- explicit grant so intent is clear.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO veyra_app;
