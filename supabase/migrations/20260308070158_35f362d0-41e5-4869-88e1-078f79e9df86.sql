-- Fix overly permissive conversations INSERT policy
DROP POLICY "Users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);