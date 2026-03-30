import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notificationId, recipientEmail, subject, body } = await req.json();

    // For now, just log the email that would be sent
    // When email service is configured, send the actual email here
    console.log(`[send-notification] Would send email to: ${recipientEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body length: ${body?.length ?? 0} chars`);

    // Import supabase client to update notification status
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (notificationId) {
      // Check if email sending is enabled (admin toggle)
      // For now, mark as 'enviado' since we're logging
      await supabase
        .from('notifications')
        .update({ status: 'enviado', sent_at: new Date().toISOString() })
        .eq('id', notificationId);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification processed (email sending placeholder)' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
