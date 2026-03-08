import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, Search, ArrowLeft } from "lucide-react";
import flashgridLogo from "@/assets/flashgrid-logo.png";
import { countryCodes, type CountryCode } from "@/data/countryCodes";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type LoginMethod = "email" | "phone";
type AuthStep = "credentials" | "otp";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("phone");
  const [authStep, setAuthStep] = useState<AuthStep>("credentials");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countryCodes[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const navigate = useNavigate();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCountryPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const filteredCountries = countryCodes.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const fullPhone = `${selectedCountry.dial}${phone}`;

  const sendOtp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("otp", {
        body: { action: "send", phone: fullPhone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // For testing: show OTP in toast (remove in production)
      if (data?.debug_otp) {
        toast.info(`Your OTP is: ${data.debug_otp}`, { duration: 30000 });
      }

      toast.success("OTP sent to your phone!");
      setAuthStep("otp");
      setResendTimer(30);
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndAuth = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("otp", {
        body: { action: "verify", phone: fullPhone, code: otp },
      });
      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      if (isLogin) {
        // Phone login: look up profile by phone
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("phone", fullPhone)
          .single();
        if (!profileData) {
          toast.error("No account found with this phone number. Please sign up first.");
          setAuthStep("credentials");
          setOtp("");
          setLoading(false);
          return;
        }
        // Sign in with phone + password
        const { error } = await supabase.auth.signInWithPassword({ phone: fullPhone, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      } else {
        // Phone signup
        if (!username.trim()) {
          toast.error("Username is required");
          setLoading(false);
          return;
        }
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.toLowerCase())
          .single();
        if (existing) {
          toast.error("Username already taken");
          setLoading(false);
          return;
        }
        const { data: existingPhone } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", fullPhone)
          .single();
        if (existingPhone) {
          toast.error("Phone number already registered");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: `${phone}@flashgrid.phone`,
          password,
          phone: fullPhone,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: username.toLowerCase(),
              display_name: displayName,
              phone: fullPhone,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! You can now sign in.");
        setIsLogin(true);
        setAuthStep("credentials");
        setOtp("");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      } else {
        if (!username.trim()) {
          toast.error("Username is required");
          setLoading(false);
          return;
        }
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.toLowerCase())
          .single();
        if (existing) {
          toast.error("Username already taken");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: username.toLowerCase(),
              display_name: displayName,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    await sendOtp();
  };

  const handleGoogleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result && "error" in result && result.error) {
      toast.error(String(result.error));
    }
  };

  // OTP verification screen
  if (authStep === "otp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6">
          <button
            onClick={() => { setAuthStep("credentials"); setOtp(""); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col items-center space-y-2">
            <img src={flashgridLogo} alt="FlashGrid" className="h-16 w-16" />
            <h1 className="font-display text-2xl font-bold text-foreground">Enter OTP</h1>
            <p className="text-sm text-muted-foreground text-center">
              We've sent a 6-digit code to{" "}
              <span className="font-semibold text-foreground">{fullPhone}</span>
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            variant="ig"
            className="w-full"
            onClick={verifyOtpAndAuth}
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            {resendTimer > 0 ? (
              <span className="text-muted-foreground">Resend in {resendTimer}s</span>
            ) : (
              <button
                type="button"
                onClick={sendOtp}
                className="font-semibold text-primary hover:underline"
                disabled={loading}
              >
                Resend OTP
              </button>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <img src={flashgridLogo} alt="FlashGrid" className="h-20 w-20" />
          <h1 className="font-display text-3xl font-bold gradient-ig-text">FlashGrid</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        {/* Login method tabs */}
        <div className="flex rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => setLoginMethod("phone")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              loginMethod === "phone"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Phone
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod("email")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              loginMethod === "email"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Email
          </button>
        </div>

        <form onSubmit={loginMethod === "phone" ? handlePhoneSubmit : handleEmailSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="cooluser123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  required={!isLogin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </>
          )}

          {loginMethod === "phone" ? (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex h-10 items-center gap-1 rounded-md border border-input bg-background px-2.5 text-sm hover:bg-accent transition-colors min-w-[90px]"
                  >
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="text-foreground">{selectedCountry.dial}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>

                  {showCountryPicker && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-background shadow-lg">
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredCountries.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(country);
                              setShowCountryPicker(false);
                              setCountrySearch("");
                            }}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors ${
                              selectedCountry.code === country.code ? "bg-accent" : ""
                            }`}
                          >
                            <span className="text-base">{country.flag}</span>
                            <span className="flex-1 text-left text-foreground">{country.name}</span>
                            <span className="text-muted-foreground">{country.dial}</span>
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No country found
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  required
                  className="flex-1"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button type="submit" variant="ig" className="w-full" disabled={loading}>
            {loading
              ? "Loading..."
              : loginMethod === "phone"
              ? "Send OTP"
              : isLogin
              ? "Sign In"
              : "Sign Up"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleLogin} type="button">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="font-semibold text-primary hover:underline"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}
