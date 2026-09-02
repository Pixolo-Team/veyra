-- Row-Level Security for Veyra (mvp-plan §3 "RLS policies per room").
--
-- STATUS: applied but DORMANT. The app connects as `postgres`, which has
-- BYPASSRLS, so these policies do not take effect yet. They are enforced only
-- for the `veyra_app` role (NOBYPASSRLS). Activation — see apps/api/README.md —
-- is: wrap each authenticated request in a transaction that runs
--   SET LOCAL ROLE veyra_app;
--   SELECT set_config('app.user_id', <users.id>, true);
-- and route Prisma through it. Public routes (login, invite accept, password
-- reset) and background jobs keep running as `postgres` and bypass RLS by design.
--
-- All policy predicates are expressed through STABLE helper functions in the
-- `app` schema so the rules live in one place.

-- ─────────────────────────────────────────────────────────────────────────────
-- Role
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'veyra_app') THEN
    CREATE ROLE veyra_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT veyra_app TO postgres;           -- so a session can SET LOCAL ROLE to it

CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app, public TO veyra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO veyra_app;
REVOKE ALL ON TABLE public._prisma_migrations FROM veyra_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO veyra_app;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app.is_room_member(rid text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = rid
        AND rp.user_id = app.current_user_id()
        AND rp.status <> 'revoked'
    )
$$;

CREATE OR REPLACE FUNCTION app.is_room_admin(rid text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = rid
        AND rp.user_id = app.current_user_id()
        AND rp.status = 'active'
        AND rp.role = 'admin'
    )
$$;

CREATE OR REPLACE FUNCTION app.my_participant_id(rid text) RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT rp.id FROM public.room_participants rp
    WHERE rp.room_id = rid
      AND rp.user_id = app.current_user_id()
      AND rp.status <> 'revoked'
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.my_side(rid text) RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT rp.side::text FROM public.room_participants rp
    WHERE rp.room_id = rid
      AND rp.user_id = app.current_user_id()
      AND rp.status <> 'revoked'
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.is_tenant_member(tid text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tid AND tm.user_id = app.current_user_id()
    )
$$;

CREATE OR REPLACE FUNCTION app.is_tenant_manager(tid text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tid
        AND tm.user_id = app.current_user_id()
        AND tm.role IN ('owner', 'admin')
    )
$$;

-- D5: a `side` thread is visible only to the creator's own side; `room` to all.
CREATE OR REPLACE FUNCTION app.thread_visible(tid text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
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
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = doc_id AND app.is_room_member(d.room_id)
    )
$$;

CREATE OR REPLACE FUNCTION app.can_see_version(v_id text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.document_versions v
      JOIN public.documents d ON d.id = v.document_id
      WHERE v.id = v_id AND app.is_room_member(d.room_id)
    )
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO veyra_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO veyra_app;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS + policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Identity ───────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON public.users FOR SELECT USING (
  id = app.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.room_participants me
    JOIN public.room_participants them ON them.room_id = me.room_id
    WHERE me.user_id = app.current_user_id() AND them.user_id = public.users.id
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_members me
    JOIN public.tenant_members them ON them.tenant_id = me.tenant_id
    WHERE me.user_id = app.current_user_id() AND them.user_id = public.users.id
  )
);
CREATE POLICY users_insert ON public.users FOR INSERT WITH CHECK (app.current_user_id() IS NOT NULL);
CREATE POLICY users_update ON public.users FOR UPDATE USING (id = app.current_user_id());

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_select ON public.companies FOR SELECT USING (app.current_user_id() IS NOT NULL);
CREATE POLICY companies_insert ON public.companies FOR INSERT WITH CHECK (app.current_user_id() IS NOT NULL);

ALTER TABLE public.company_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_domains_select ON public.company_domains FOR SELECT USING (app.current_user_id() IS NOT NULL);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_select ON public.tenants FOR SELECT USING (app.is_tenant_member(id));

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_members_select ON public.tenant_members FOR SELECT USING (app.is_tenant_member(tenant_id));

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_all ON public.sessions FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- no policy: reset flows run on public routes as `postgres` and bypass RLS.

-- Rooms & participation ──────────────────────────────────────────────────────
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_select ON public.rooms FOR SELECT USING (app.is_room_member(id));
CREATE POLICY rooms_insert ON public.rooms FOR INSERT WITH CHECK (app.is_tenant_manager(tenant_id));
CREATE POLICY rooms_update ON public.rooms FOR UPDATE USING (app.is_room_admin(id));

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_participants_select ON public.room_participants FOR SELECT USING (app.is_room_member(room_id));
CREATE POLICY room_participants_write ON public.room_participants FOR ALL
  USING (app.is_room_admin(room_id) OR user_id = app.current_user_id())
  WITH CHECK (app.is_room_admin(room_id) OR user_id = app.current_user_id());

ALTER TABLE public.participant_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY participant_capabilities_select ON public.participant_capabilities FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.id = participant_id AND app.is_room_member(rp.room_id))
);
CREATE POLICY participant_capabilities_write ON public.participant_capabilities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.id = participant_id AND app.is_room_admin(rp.room_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.id = participant_id AND app.is_room_admin(rp.room_id)));

-- Templates (reference data, read-only to the app) ──────────────────────────
ALTER TABLE public.module_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_templates_select ON public.module_templates FOR SELECT USING (app.current_user_id() IS NOT NULL);
ALTER TABLE public.module_template_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_template_nodes_select ON public.module_template_nodes FOR SELECT USING (app.current_user_id() IS NOT NULL);

-- Dossier content (room-scoped) ─────────────────────────────────────────────
ALTER TABLE public.room_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_modules_all ON public.room_modules FOR ALL
  USING (app.is_room_member(room_id)) WITH CHECK (app.is_room_member(room_id));

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY folders_all ON public.folders FOR ALL
  USING (app.is_room_member(room_id)) WITH CHECK (app.is_room_member(room_id));

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_all ON public.documents FOR ALL
  USING (app.is_room_member(room_id)) WITH CHECK (app.is_room_member(room_id));

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_versions_all ON public.document_versions FOR ALL
  USING (app.can_see_document(document_id)) WITH CHECK (app.can_see_document(document_id));

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY upload_batches_all ON public.upload_batches FOR ALL
  USING (app.is_room_member(room_id)) WITH CHECK (app.is_room_member(room_id));

ALTER TABLE public.upload_batch_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY upload_batch_files_all ON public.upload_batch_files FOR ALL
  USING (EXISTS (SELECT 1 FROM public.upload_batches b WHERE b.id = batch_id AND app.is_room_member(b.room_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.upload_batches b WHERE b.id = batch_id AND app.is_room_member(b.room_id)));

ALTER TABLE public.document_renditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_renditions_all ON public.document_renditions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.id = participant_id AND rp.user_id = app.current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.id = participant_id AND rp.user_id = app.current_user_id()));

-- Review ────────────────────────────────────────────────────────────────────
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY annotations_select ON public.annotations FOR SELECT USING (
  app.is_room_member(room_id)
  AND (
    author_participant_id = app.my_participant_id(room_id)
    OR EXISTS (SELECT 1 FROM public.comment_threads t WHERE t.annotation_id = annotations.id AND app.thread_visible(t.id))
  )
);
CREATE POLICY annotations_write ON public.annotations FOR ALL
  USING (author_participant_id = app.my_participant_id(room_id) OR app.is_room_admin(room_id))
  WITH CHECK (app.is_room_member(room_id));

ALTER TABLE public.comment_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY comment_threads_select ON public.comment_threads FOR SELECT USING (app.thread_visible(id));
CREATE POLICY comment_threads_write ON public.comment_threads FOR ALL
  USING (app.is_room_member(room_id)) WITH CHECK (app.is_room_member(room_id));

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_select ON public.comments FOR SELECT USING (app.thread_visible(thread_id));
CREATE POLICY comments_write ON public.comments FOR ALL
  USING (app.thread_visible(thread_id)) WITH CHECK (app.thread_visible(thread_id));

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY comment_mentions_all ON public.comment_mentions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.comments c WHERE c.id = comment_id AND app.thread_visible(c.thread_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.comments c WHERE c.id = comment_id AND app.thread_visible(c.thread_id)));

-- Operations ────────────────────────────────────────────────────────────────
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_all ON public.invitations FOR ALL
  USING (app.is_room_admin(room_id)) WITH CHECK (app.is_room_admin(room_id));

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
-- no policy: the outbox worker runs as `postgres` and bypasses RLS.

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_prefs_all ON public.notification_prefs FOR ALL
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_select ON public.audit_events FOR SELECT USING (
  (room_id IS NOT NULL AND app.is_room_member(room_id))
  OR (room_id IS NULL AND actor_user_id = app.current_user_id())
);
CREATE POLICY audit_events_insert ON public.audit_events FOR INSERT WITH CHECK (
  (room_id IS NOT NULL AND app.is_room_member(room_id))
  OR actor_user_id = app.current_user_id()
);
