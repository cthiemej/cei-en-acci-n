import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const callerId = claimsData.claims.sub as string

    const admin = createClient(SUPABASE_URL, SERVICE)

    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: callerId, _role: 'admin' })
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    const userId = body?.userId
    const newEmail = body?.newEmail?.trim?.()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!userId || typeof userId !== 'string' || !newEmail || !emailRegex.test(newEmail)) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get old email from profiles
    const { data: prevProfile } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle()
    const oldEmail = prevProfile?.email ?? null

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    })
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: profErr } = await admin.from('profiles').update({ email: newEmail }).eq('id', userId)
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await admin.from('activity_log').insert({
      user_id: callerId,
      action: 'update_email',
      entity_type: 'profiles',
      entity_id: userId,
      metadata: { old_email: oldEmail, new_email: newEmail },
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})