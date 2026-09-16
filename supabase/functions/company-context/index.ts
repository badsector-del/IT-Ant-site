import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Niste prijavljeni.' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Sesija je istekla.' }, 401);
    const body = await request.json();
    if (!body.company_id) return json({ error: 'Preduzeće nije izabrano.' }, 400);
    const { data: membership } = await admin.from('company_users').select('company_id,companies(name)').eq('user_id', user.id).eq('company_id', body.company_id).maybeSingle();
    if (!membership) return json({ error: 'Nemate pristup ovom preduzeću.' }, 403);
    const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), active_company_id: body.company_id } });
    if (error) throw error;
    return json({ company_id: body.company_id, company_name: membership.companies?.name || null });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Greška servera.' }, 500); }
});
