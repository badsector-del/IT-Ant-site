import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Niste prijavljeni.' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Sesija je istekla.' }, 401);
    const { data: access } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!access) return json({ error: 'Nemate administratorski pristup.' }, 403);
    const body = await request.json();
    if (body.action === 'list') {
      const [{ data: companies, error: companiesError }, { data: memberships, error: membersError }, { data: users, error: usersError }, { data: logs, error: logsError }] = await Promise.all([
        admin.from('companies').select('id,name,pib,created_at').order('created_at'),
        admin.from('company_users').select('company_id,user_id,role'),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from('admin_audit_logs').select('id,admin_user_id,action,target_type,target_id,details,created_at').order('created_at', { ascending: false }).limit(50)
      ]);
      if (companiesError || membersError || usersError || logsError) throw new Error('Učitavanje administracije nije uspelo.');
      const emails = new Map(users.users.map(item => [item.id, item.email || item.id]));
      return json({ companies, memberships: memberships.map(item => ({ ...item, email: emails.get(item.user_id) })), logs: logs.map(log => ({ ...log, admin_email: emails.get(log.admin_user_id) })) });
    }
    if (body.action === 'create-company') {
      if (!body.name?.trim()) return json({ error: 'Naziv preduzeća je obavezan.' }, 400);
      const { data, error } = await admin.from('companies').insert({ name: body.name.trim(), pib: body.pib?.trim() || null }).select('id').single();
      if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'create_company', target_type: 'company', target_id: data.id, details: { name: body.name.trim(), pib: body.pib?.trim() || null } });
      return json({ company: data });
    }
    if (body.action === 'create-user') {
      if (!body.email || !body.password || !body.company_id) return json({ error: 'Popunite sva polja.' }, 400);
      const { data: created, error: userError } = await admin.auth.admin.createUser({ email: body.email.trim(), password: body.password, email_confirm: true });
      if (userError) throw userError;
      const { error: memberError } = await admin.from('company_users').insert({ company_id: body.company_id, user_id: created.user.id, role: 'member' });
      if (memberError) { await admin.auth.admin.deleteUser(created.user.id); throw memberError; }
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'create_user', target_type: 'user', target_id: created.user.id, details: { email: body.email.trim(), company_id: body.company_id, role: 'member' } });
      return json({ user_id: created.user.id });
    }
    return json({ error: 'Nepoznata radnja.' }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Greška servera.' }, 500); }
});
