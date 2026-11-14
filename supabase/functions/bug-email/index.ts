import { timingSafeEqual } from "node:crypto";

Deno.serve(async (request) => {
  const encoder = new TextEncoder();
  const a = encoder.encode(request.headers.get("x-forge-worker-token") ?? "");
  const b = encoder.encode(Deno.env.get("FORGE_WORKER_TOKEN") ?? "");
  if (request.method !== "POST" || b.length < 32 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response(null, { status: 403 });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("FORGE_NOTIFICATION_EMAIL");
  const from = Deno.env.get("FORGE_FROM_EMAIL");
  if (!url || !role || !key || !to || !from) return new Response("Worker configuration incomplete", { status: 503 });

  async function rpc(name: string, parameters: Record<string, unknown>) {
    return await fetch(url + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: role!, Authorization: "Bearer " + role, "Content-Type": "application/json" },
      body: JSON.stringify(parameters),
      signal: AbortSignal.timeout(12000),
    });
  }
  try {
    const claim = await rpc("fr_claim_bug_mail", {});
    if (!claim.ok) return new Response("Could not claim report", { status: 502 });
    const [bug] = await claim.json();
    if (!bug) return new Response(null, { status: 204 });

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Idempotency-Key": "forge-bug/" + bug.id },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from, to: [to], subject: "ForgeRoster bug · " + bug.severity + " · " + bug.id,
        text: [
          bug.title, "Report " + bug.id, bug.category + " · " + bug.severity, bug.description,
          "Steps\n" + bug.steps, "Expected\n" + bug.expected, "Actual\n" + bug.actual,
          "Submitted " + bug.created_at,
          "App " + (bug.diagnostics?.version ?? "Unknown") + " · " + (bug.diagnostics?.browser ?? "Unknown") + " · " + (bug.diagnostics?.device ?? "Unknown"),
          "Admin dashboard https://andrewvasbinder1-dotcom.github.io/Forgeroster/#admin",
        ].join("\n\n"),
      }),
    });
    if (!sent.ok) {
      if (sent.status >= 400 && sent.status < 500 && ![408,409,429].includes(sent.status)) {
        await rpc("fr_finish_bug_mail", { report: bug.id, outcome: "failed" });
      }
      return new Response("Email provider did not accept notification", { status: 502 });
    }
    const finish = await rpc("fr_finish_bug_mail", { report: bug.id, outcome: "sent" });
    return new Response(null, { status: finish.ok ? 204 : 502 });
  } catch {
    return new Response("Email worker request failed", { status: 502 });
  }
});
