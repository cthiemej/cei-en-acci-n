import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TESTING_NOTICE_HTML =
  '<p style="background:#fff3cd;border:1px solid #ffe69c;padding:10px;border-radius:6px;color:#664d03;font-family:sans-serif;">[Correo de prueba — CEI-UDP en etapa de testing]</p>';

function toHtml(body: string): string {
  const escaped = (body ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `${TESTING_NOTICE_HTML}<div style="font-family:sans-serif;color:#1a1a2e;">${escaped}</div>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let notificationId: string | undefined;
  let recipientEmail = '';
  let subject = '';

  try {
    const payload = await req.json();
    notificationId = payload.notificationId;
    const recipientId = payload.recipientId;
    subject = payload.subject;
    const body: string = payload.body ?? '';

    if (!recipientId) {
      throw new Error('recipientId es requerido');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', recipientId)
      .single();

    if (profileError || !profile?.email) {
      throw new Error(`No se pudo resolver el email del destinatario (recipientId: ${recipientId})`);
    }

    recipientEmail = profile.email;

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS');
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!gmailAddress || !gmailAppPassword) {
      throw new Error('Faltan las credenciales GMAIL_ADDRESS o GMAIL_APP_PASSWORD');
    }

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: gmailAddress, password: gmailAppPassword },
      },
    });

    await client.send({
      from: `CEI-UDP <${gmailAddress}>`,
      to: recipientEmail,
      subject,
      content: body,
      html: toHtml(body),
    });
    await client.close();

    console.log(`[send-notification] Enviado OK a ${recipientEmail} — asunto: ${subject}`);

    if (notificationId) {
      await supabase
        .from('notifications')
        .update({ status: 'enviado', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', notificationId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[send-notification] Error enviando a ${recipientEmail}: ${message}`);

    if (notificationId) {
      await supabase
        .from('notifications')
        .update({ status: 'error', error_message: message })
        .eq('id', notificationId);
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
