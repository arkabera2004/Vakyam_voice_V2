import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { VoiceFlowBackdrop } from "@/components/brand/VoiceFlowBackdrop";

const fieldClass = "border-white/20 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-[#ff7b1c]/60";

/**
 * Two steps on one route. Without a recovery session: ask for the email and
 * send the Supabase reset link. With one (the user arrived from that link):
 * set the new password.
 */
export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY once it has exchanged the link's token.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    if (window.location.hash.includes("type=recovery")) setRecovering(true);
    return () => data.subscription.unsubscribe();
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` });
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Could not send the link", description: error.message });
    toast({ title: "Check your email", description: "If that address has an account, a reset link is on its way." });
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Password not changed", description: error.message });
    toast({ title: "Password updated", description: "You are signed in with the new password." });
    navigate("/console", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <VoiceFlowBackdrop />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="m-0">
            <img src="/brand/vakyam-lockup.png" alt="Vakyam" width={772} height={168} className="h-12 w-auto" />
          </h1>
          <p className="mt-3 text-sm text-white/70">{recovering ? "Choose a new password" : "Reset your password"}</p>
        </div>
        <Card className="border-white/10 bg-black/30 shadow-none backdrop-blur-xl">
          <form onSubmit={recovering ? setNewPassword : sendLink}>
            <CardContent className="space-y-4 pt-6">
              {recovering ? (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/80">New password</Label>
                  <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : recovering ? "Set new password" : "Send reset link"}
              </Button>
              <Link to="/login" className="text-xs text-white/60 hover:text-white">Back to sign in</Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
