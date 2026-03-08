
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No direct client access - only edge functions with service role
CREATE POLICY "No direct access" ON public.otp_codes FOR ALL USING (false);

-- Index for fast lookup
CREATE INDEX idx_otp_codes_phone ON public.otp_codes (phone, verified, expires_at);
