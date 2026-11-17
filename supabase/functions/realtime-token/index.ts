import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildDemoContext } from "./inventory.ts";
import { countFromContentRange, limitFromEnv, overLimit, parseTokenRequest } from "./limits.ts";
import { resolveAgentConfig, type AgentVersionRow } from "./agentConfig.ts";

// Set ALLOWED_ORIGIN to the app's origin in production; "*" is for local dev.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resource = Deno.env.get("AZURE_OPENAI_RESOURCE");
    const apiKey = Deno.env.get("AZURE_OPENAI_API_KEY");
    const deployment = Deno.env.get("AZURE_REALTIME_DEPLOYMENT");
    if (!resource) throw new Error("AZURE_OPENAI_RESOURCE is not configured");
    if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not configured");
    if (!deployment) throw new Error("AZURE_REALTIME_DEPLOYMENT is not configured");

    // With an Azure Speech resource configured, the model replies in text and
    // the browser speaks it with a native Indian Azure voice instead.
    const speechKey = Deno.env.get("AZURE_SPEECH_KEY");
    const speechRegion = Deno.env.get("AZURE_SPEECH_REGION");
    const indianVoice = Boolean(speechKey && speechRegion);

    // Only a signed-in user may start a call. The bearer value alone proves
    // nothing (the publishable key is also sent as a bearer), so ask Supabase
    // Auth whether it is a live user session.
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    const userResponse = authHeader?.startsWith("Bearer ")
      ? await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: supabaseKey },
        })
      : null;
    if (!userResponse?.ok) return json({ error: "Unauthorized" }, 401);

    // The console's voice previews only need a Speech token; they must not
    // spend a realtime session (GAP-B-05).
    const { speechOnly, callId } = parseTokenRequest(req.method === "POST" ? await req.text() : null);
    if (speechOnly && !indianVoice) return json({ error: "Azure Speech is not configured" }, 404);

    // A full session must name the call start_call() already created, so the
    // agent configuration below comes from that call's own agent_version
    // rather than a guess, and the token cannot be minted for a call that
    // was not resolved for this user by start_call() in the first place.
    let agentVersion: AgentVersionRow = null;
    if (!speechOnly) {
      if (!callId) return json({ error: "callId is required" }, 400);
      const { id: userId } = await userResponse.json();
      const callLookup = await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${callId}&select=started_by,status,agent_version_id`, {
        headers: { Authorization: authHeader!, apikey: supabaseKey },
      });
      if (!callLookup.ok) throw new Error(`Could not read the call (${callLookup.status})`);
      const [call] = (await callLookup.json()) as { started_by: string; status: string; agent_version_id: string | null }[];
      if (!call) return json({ error: "Call not found" }, 404);
      if (call.started_by !== userId) return json({ error: "This call does not belong to you" }, 403);
      if (!["created", "initializing"].includes(call.status)) return json({ error: `This call is already ${call.status}` }, 409);
      if (call.agent_version_id) {
        const versionLookup = await fetch(`${supabaseUrl}/rest/v1/agent_versions?id=eq.${call.agent_version_id}&select=prompt,first_message,voice`, {
          headers: { Authorization: authHeader!, apikey: supabaseKey },
        });
        if (!versionLookup.ok) throw new Error(`Could not read the agent version (${versionLookup.status})`);
        [agentVersion] = (await versionLookup.json()) as AgentVersionRow[];
      }
    }
    const agentConfig = resolveAgentConfig(agentVersion);
    const voice = agentConfig.voiceOverride || Deno.env.get("AZURE_REALTIME_VOICE") || "marin";
    const speechVoice = agentConfig.voiceOverride || Deno.env.get("AZURE_SPEECH_VOICE") || "en-IN-AartiIndicNeural";

    // Rate limit per user, counted and recorded with the caller's own JWT
    // under RLS on public.voice_sessions (GAP-S-02).
    const rest = `${supabaseUrl}/rest/v1/voice_sessions`;
    const restHeaders = { Authorization: authHeader!, apikey: supabaseKey, "Content-Type": "application/json" };
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const countResponse = await fetch(`${rest}?select=id&created_at=gte.${since}&limit=1`, {
      headers: { ...restHeaders, Prefer: "count=exact" },
    });
    if (!countResponse.ok) throw new Error(`Could not read voice_sessions (${countResponse.status})`);
    const limit = limitFromEnv(Deno.env.get("VOICE_SESSIONS_PER_HOUR"));
    if (overLimit(countFromContentRange(countResponse.headers.get("content-range")), limit)) {
      return json({ error: `Too many voice sessions. The limit is ${limit} per hour.` }, 429);
    }
    const recorded = await fetch(rest, {
      method: "POST",
      headers: { ...restHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ kind: speechOnly ? "speech" : "realtime" }),
    });
    if (!recorded.ok) throw new Error(`Could not record the voice session (${recorded.status})`);

    // A Speech token lasts ten minutes, as long as the longest call.
    const speechTokenRequest = indianVoice
      ? fetch(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": speechKey!, "Content-Length": "0" },
        })
      : null;

    if (speechOnly) {
      const speechResponse = await speechTokenRequest!;
      if (!speechResponse.ok) {
        console.error("Azure Speech token error:", speechResponse.status, await speechResponse.text());
        throw new Error(`Azure Speech refused the session (${speechResponse.status})`);
      }
      return json({ speech: { token: await speechResponse.text(), region: speechRegion, voice: speechVoice } });
    }

    // The prompt and voice are fixed here, server-side. The browser only gets
    // a short-lived token bound to this session configuration.
    const base = `https://${resource}.openai.azure.com/openai/v1/realtime`;
    const session = indianVoice
      ? { output_modalities: ["text"], instructions: agentConfig.textInstructions }
      : { audio: { output: { voice } }, instructions: agentConfig.instructions };
    const [tokenResponse, speechResponse] = await Promise.all([
      fetch(`${base}/client_secrets`, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: deployment,
            ...session,
            instructions: [session.instructions, buildDemoContext()].join("\n\n"),
          },
        }),
      }),
      speechTokenRequest,
    ]);

    if (!tokenResponse.ok) {
      console.error("Azure token error:", tokenResponse.status, await tokenResponse.text());
      throw new Error(`Azure refused the session (${tokenResponse.status})`);
    }
    if (speechResponse && !speechResponse.ok) {
      console.error("Azure Speech token error:", speechResponse.status, await speechResponse.text());
      throw new Error(`Azure Speech refused the session (${speechResponse.status})`);
    }

    const { value: token } = await tokenResponse.json();
    if (!token) throw new Error("Azure returned no session token");
    const speech = speechResponse
      ? { token: await speechResponse.text(), region: speechRegion, voice: speechVoice }
      : undefined;

    // webrtcfilter=on keeps the prompt out of the events sent to the browser.
    return json({ token, callUrl: `${base}/calls?webrtcfilter=on`, firstMessage: agentConfig.firstMessage, speech });
  } catch (error: unknown) {
    // Details (which secret is missing, what Azure said) stay in the function
    // logs; the browser gets a generic message (GAP-S-08).
    console.error("Error in realtime-token:", error instanceof Error ? error.message : error);
    return json({ error: "The voice service is not available right now. Please try again later." }, 500);
  }
});
