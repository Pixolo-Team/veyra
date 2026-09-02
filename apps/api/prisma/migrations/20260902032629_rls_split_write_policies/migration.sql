-- A permissive `FOR ALL` policy also contributes its USING clause to SELECT, so
-- `comment_threads_write` / `annotations_write` (USING = "any room member" /
-- "author or admin") were widening read access past the narrower *_select
-- policies — a discloser admin could read the recipient side's private markers
-- and side-only threads. Replace them with per-command policies that never touch
-- SELECT.

-- comment_threads ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS comment_threads_write ON public.comment_threads;

CREATE POLICY comment_threads_insert ON public.comment_threads FOR INSERT
  WITH CHECK (app.is_room_member(room_id));
CREATE POLICY comment_threads_update ON public.comment_threads FOR UPDATE
  USING (app.thread_visible(id))
  WITH CHECK (app.is_room_member(room_id));
CREATE POLICY comment_threads_delete ON public.comment_threads FOR DELETE
  USING (app.thread_visible(id) AND app.is_room_admin(room_id));

-- annotations ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS annotations_write ON public.annotations;

CREATE POLICY annotations_insert ON public.annotations FOR INSERT
  WITH CHECK (app.is_room_member(room_id) AND author_participant_id = app.my_participant_id(room_id));
CREATE POLICY annotations_update ON public.annotations FOR UPDATE
  USING (author_participant_id = app.my_participant_id(room_id) OR app.is_room_admin(room_id))
  WITH CHECK (app.is_room_member(room_id));
CREATE POLICY annotations_delete ON public.annotations FOR DELETE
  USING (author_participant_id = app.my_participant_id(room_id) OR app.is_room_admin(room_id));
