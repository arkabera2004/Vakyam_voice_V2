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
 * Where invite-user's email link lands (APP_ORIGIN + "/accept"). Supabase
 * verifies the link's token and signs the user in before this page renders;
 * org_members was granted by the accept_invitation_for_user() trigger on
 * email confirmation, already done by the time this form submits. All that
 * remains is for the invitee to choose a password and, optionally, a name.
 */
export default function AcceptInvitation() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(window.location.hash.includes("access_token"));
  const [invalid, setInvalid] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setReady(true);
    });
    // The link's token is consumed on load; if there was never one in the
    // hash and no session follows shortly after, the link was already used
    // or malformed.
    const timer = window.setTimeout(async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) setInvalid(true);
    }, 2500);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const finishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password, data: name.trim() ? { display_name: name.trim() } : undefined });
    if (error) {
      setBusy(false);
      return toast({ variant: "destructive", title: "Could not finish setup", description: error.message });
    }
    if (name.trim()) {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (userId) await supabase.from("profiles").update({ display_name: name.trim() }).eq("user_id", userId);
    }
    setBusy(false);
    toast({ title: "Welcome to Vakyam", description: "Your account is ready." });
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
          <p className="mt-3 text-sm text-white/70">{invalid ? "This invitation link is no longer valid" : "Finish setting up your account"}</p>
        </div>
        <Card className="border-white/10 bg-black/30 shadow-none backdrop-blur-xl">
          {invalid ? (
            <CardContent className="space-y-4 pt-6 text-center text-sm text-white/70">
              <p>The link may have expired or already been used. Ask your administrator to send a new invitation.</p>
              <Link to="/login" className="inline-block text-xs text-white/60 hover:text-white">Back to sign in</Link>
            </CardContent>
          ) : !ready ? (
            <CardContent className="space-y-4 pt-6 text-center text-sm text-white/70">Verifying your invitation…</CardContent>
          ) : (
            <form onSubmit={finishSetup}>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/80">Your name</Label>
                  <Input id="name" autoComplete="name" placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/80">Choose a password</Label>
                  <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Finish setup"}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
