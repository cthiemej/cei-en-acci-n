import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple business day check (no Chilean holidays for simplicity in edge fn)
function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
}

function businessDaysRemaining(deadline: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  if (target <= today) return 0;
  let count = 0;
  const cursor = new Date(today);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) count++;
  }
  return count;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find projects with upcoming deadlines (review_deadline or reception_deadline)
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, code, title, review_deadline, reception_deadline, status")
      .in("status", ["recibido", "en_pre_revision", "asignado", "en_evaluacion"])
      .not("review_deadline", "is", null);

    if (error) throw error;

    const { data: projectsReception } = await supabase
      .from("projects")
      .select("id, code, title, reception_deadline, status")
      .in("status", ["recibido", "en_pre_revision"])
      .not("reception_deadline", "is", null);

    const allProjects = [
      ...(projects || []).map((p: any) => ({ ...p, deadlineField: "review_deadline", deadline: p.review_deadline })),
      ...(projectsReception || []).map((p: any) => ({ ...p, deadlineField: "reception_deadline", deadline: p.reception_deadline })),
    ];

    // Get secretarios
    const { data: secretarios } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "secretario");

    let notificationsCreated = 0;

    for (const p of allProjects) {
      if (!p.deadline) continue;
      const remaining = businessDaysRemaining(new Date(p.deadline));
      if (remaining <= 3) {
        const deadlineType = p.deadlineField === "reception_deadline" ? "pre-revisión" : "informe";
        for (const s of secretarios || []) {
          // Check if notification already sent today
          const today = new Date().toISOString().split("T")[0];
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("recipient_id", s.user_id)
            .eq("project_id", p.id)
            .eq("notification_type", "alerta_plazo")
            .gte("created_at", today)
            .limit(1);

          if (existing && existing.length > 0) continue;

          await supabase.from("notifications").insert({
            recipient_id: s.user_id,
            project_id: p.id,
            notification_type: "alerta_plazo",
            subject: `Alerta: el proyecto ${p.code} vence en ${remaining} día(s) hábiles`,
            body: `El plazo de ${deadlineType} del proyecto "${p.title}" (${p.code}) vence en ${remaining} día(s) hábiles.`,
          });
          notificationsCreated++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, notificationsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
