
-- ==========================================
-- FEED ITEMS (fan-out feed architecture)
-- ==========================================
CREATE TABLE public.feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_items_user_score ON public.feed_items (user_id, score DESC, created_at DESC);
CREATE INDEX idx_feed_items_user_created ON public.feed_items (user_id, created_at DESC);
CREATE UNIQUE INDEX idx_feed_items_unique ON public.feed_items (user_id, post_id);

ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own feed" ON public.feed_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert feed items" ON public.feed_items FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update feed items" ON public.feed_items FOR UPDATE USING (true);
CREATE POLICY "System can delete feed items" ON public.feed_items FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- USER INTERACTIONS (relationship strength)
-- ==========================================
CREATE TABLE public.user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  interaction_type text NOT NULL,
  interaction_count integer NOT NULL DEFAULT 1,
  last_interaction_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_user_id, interaction_type)
);

CREATE INDEX idx_user_interactions_user ON public.user_interactions (user_id, target_user_id);

ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own interactions" ON public.user_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage interactions" ON public.user_interactions FOR ALL USING (true);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  type text NOT NULL,
  entity_id uuid,
  entity_type text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (recipient_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- ==========================================
-- USER DEVICES (push notifications)
-- ==========================================
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX idx_user_devices_user ON public.user_devices (user_id);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own devices" ON public.user_devices FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- STORY VIEWS
-- ==========================================
CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX idx_story_views_story ON public.story_views (story_id);
CREATE INDEX idx_story_views_viewer ON public.story_views (viewer_id);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story owners can see views" ON public.story_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stories WHERE stories.id = story_views.story_id AND stories.user_id = auth.uid())
  OR auth.uid() = viewer_id
);
CREATE POLICY "Users can insert story views" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- ==========================================
-- CONTENT MODERATION
-- ==========================================
CREATE TABLE public.content_moderation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  moderation_score numeric NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_moderation_post ON public.content_moderation (post_id);
CREATE INDEX idx_content_moderation_flagged ON public.content_moderation (flagged, status);

ALTER TABLE public.content_moderation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage moderation" ON public.content_moderation FOR ALL USING (true);

-- ==========================================
-- HASHTAGS
-- ==========================================
CREATE TABLE public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_hashtags_name ON public.hashtags (name);
CREATE INDEX idx_hashtags_popular ON public.hashtags (post_count DESC);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hashtags are public" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "System can manage hashtags" ON public.hashtags FOR ALL USING (true);

-- ==========================================
-- POST HASHTAGS (junction)
-- ==========================================
CREATE TABLE public.post_hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);

CREATE INDEX idx_post_hashtags_post ON public.post_hashtags (post_id);
CREATE INDEX idx_post_hashtags_hashtag ON public.post_hashtags (hashtag_id);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post hashtags are public" ON public.post_hashtags FOR SELECT USING (true);
CREATE POLICY "System can manage post hashtags" ON public.post_hashtags FOR ALL USING (true);

-- ==========================================
-- MODERATION ACTIONS (admin)
-- ==========================================
CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_actions_target ON public.moderation_actions (target_type, target_id);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage moderation actions" ON public.moderation_actions FOR ALL USING (true);

-- ==========================================
-- RECOMMENDATIONS
-- ==========================================
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recommended_user_id uuid,
  recommended_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_user ON public.recommendations (user_id, score DESC);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own recommendations" ON public.recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage recommendations" ON public.recommendations FOR ALL USING (true);

-- ==========================================
-- USER ACTIVITY (analytics)
-- ==========================================
CREATE TABLE public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_user ON public.user_activity (user_id, created_at DESC);
CREATE INDEX idx_user_activity_type ON public.user_activity (activity_type, created_at DESC);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own activity" ON public.user_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage activity" ON public.user_activity FOR ALL USING (true);

-- ==========================================
-- RATE LIMITING
-- ==========================================
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  UNIQUE(user_id, action_type, window_start)
);

CREATE INDEX idx_rate_limits_user ON public.rate_limits (user_id, action_type, window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage rate limits" ON public.rate_limits FOR ALL USING (true);

-- ==========================================
-- ADD read_at TO MESSAGES
-- ==========================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- ==========================================
-- ENABLE REALTIME
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ==========================================
-- NOTIFICATION TRIGGER FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _post_owner_id uuid;
BEGIN
  -- Like notification
  IF TG_TABLE_NAME = 'likes' THEN
    SELECT user_id INTO _post_owner_id FROM public.posts WHERE id = NEW.post_id;
    IF _post_owner_id IS NOT NULL AND _post_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, entity_id, entity_type)
      VALUES (_post_owner_id, NEW.user_id, 'like', NEW.post_id, 'post');
    END IF;
  END IF;

  -- Comment notification
  IF TG_TABLE_NAME = 'comments' THEN
    SELECT user_id INTO _post_owner_id FROM public.posts WHERE id = NEW.post_id;
    IF _post_owner_id IS NOT NULL AND _post_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, entity_id, entity_type)
      VALUES (_post_owner_id, NEW.user_id, 'comment', NEW.post_id, 'post');
    END IF;
  END IF;

  -- Follow notification
  IF TG_TABLE_NAME = 'follows' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_id, entity_type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow', NEW.follower_id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_like_create_notification
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.create_notification();

CREATE TRIGGER on_comment_create_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.create_notification();

CREATE TRIGGER on_follow_create_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.create_notification();

-- ==========================================
-- FEED FAN-OUT TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION public.fanout_post_to_feed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.feed_items (user_id, post_id, author_id, score, created_at)
  SELECT 
    f.follower_id,
    NEW.id,
    NEW.user_id,
    1.0,
    NEW.created_at
  FROM public.follows f
  WHERE f.following_id = NEW.user_id;

  -- Also add to author's own feed
  INSERT INTO public.feed_items (user_id, post_id, author_id, score, created_at)
  VALUES (NEW.user_id, NEW.id, NEW.user_id, 1.0, NEW.created_at)
  ON CONFLICT (user_id, post_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_fanout_feed
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.fanout_post_to_feed();

-- ==========================================
-- USER INTERACTION TRACKING FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.track_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user uuid;
  _itype text;
BEGIN
  IF TG_TABLE_NAME = 'likes' THEN
    SELECT user_id INTO _target_user FROM public.posts WHERE id = NEW.post_id;
    _itype := 'like';
  ELSIF TG_TABLE_NAME = 'comments' THEN
    SELECT user_id INTO _target_user FROM public.posts WHERE id = NEW.post_id;
    _itype := 'comment';
  END IF;

  IF _target_user IS NOT NULL AND _target_user != NEW.user_id THEN
    INSERT INTO public.user_interactions (user_id, target_user_id, interaction_type, interaction_count, last_interaction_at)
    VALUES (NEW.user_id, _target_user, _itype, 1, now())
    ON CONFLICT (user_id, target_user_id, interaction_type) 
    DO UPDATE SET interaction_count = user_interactions.interaction_count + 1, last_interaction_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_track_interaction
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.track_interaction();

CREATE TRIGGER on_comment_track_interaction
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.track_interaction();

-- ==========================================
-- STORAGE BUCKET for message media
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('message_media', 'message_media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload message media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message_media');

CREATE POLICY "Message media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'message_media');
