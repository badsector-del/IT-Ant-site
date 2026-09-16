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
    const { data: access } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!access) return json({ error: 'Nemate administratorski pristup.' }, 403);
    const body = await request.json();
    if (body.action === 'list') {
      const [{ data: companies, error: companiesError }, { data: memberships, error: membersError }, { data: users, error: usersError }, { data: logs, error: logsError }] = await Promise.all([
        admin.from('companies').select('id,name,pib,address,bank_name,bank_account,tax_regime,vat_number,regime_effective_from,created_at').order('created_at'),
        admin.from('company_users').select('company_id,user_id,role'),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from('admin_audit_logs').select('id,admin_user_id,action,target_type,target_id,details,created_at').order('created_at', { ascending: false }).limit(50)
      ]);
      if (companiesError || membersError || usersError || logsError) throw new Error('Učitavanje administracije nije uspelo.');
      const profiles = new Map(users.users.map(item => [item.id, { email: item.email || item.id, first_name: item.user_metadata?.first_name || '', last_name: item.user_metadata?.last_name || '' }]));
      return json({ companies, memberships: memberships.map(item => ({ ...item, ...(profiles.get(item.user_id) || {}) })), logs: logs.map(log => ({ ...log, admin_email: profiles.get(log.admin_user_id)?.email })) });
    }
    if (body.action === 'create-company') {
      if (!body.name?.trim()) return json({ error: 'Naziv preduzeća je obavezan.' }, 400);
      const { data, error } = await admin.from('companies').insert({ name: body.name.trim(), pib: body.pib?.trim() || null, address: body.address?.trim() || null, bank_name: body.bank_name?.trim() || null, bank_account: body.bank_account?.trim() || null, tax_regime: body.tax_regime || 'pausal', vat_number: body.vat_number?.trim() || null, regime_effective_from: body.regime_effective_from || new Date().toISOString().slice(0, 10) }).select('id').single();
      if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'create_company', target_type: 'company', target_id: data.id, details: { name: body.name.trim(), pib: body.pib?.trim() || null, tax_regime: body.tax_regime || 'pausal' } });
      return json({ company: data });
    }
    if (body.action === 'update-company') {
      if (!body.company_id || !body.name?.trim()) return json({ error: 'Naziv preduzeća je obavezan.' }, 400);
      const { data, error } = await admin.from('companies').update({ name: body.name.trim(), pib: body.pib?.trim() || null, address: body.address?.trim() || null, bank_name: body.bank_name?.trim() || null, bank_account: body.bank_account?.trim() || null, tax_regime: body.tax_regime || 'pausal', vat_number: body.vat_number?.trim() || null, regime_effective_from: body.regime_effective_from || new Date().toISOString().slice(0, 10) }).eq('id', body.company_id).select('id').single();
      if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'update_company', target_type: 'company', target_id: data.id, details: { name: body.name.trim(), tax_regime: body.tax_regime || 'pausal' } });
      return json({ company: data });
    }
    if (body.action === 'delete-company') {
      if (!body.company_id) return json({ error: 'Preduzeće nije izabrano.' }, 400);
      const checks = await Promise.all([
        admin.from('company_users').select('user_id', { count: 'exact', head: true }).eq('company_id', body.company_id),
        admin.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', body.company_id),
        admin.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', body.company_id),
        admin.from('expenses').select('id', { count: 'exact', head: true }).eq('company_id', body.company_id)
      ]);
      if (checks.some(check => check.error)) throw new Error('Nije moguće proveriti podatke preduzeća.');
      if (checks.some(check => (check.count || 0) > 0)) return json({ error: 'Preduzeće ne može biti obrisano dok ima korisnike ili podatke.' }, 409);
      const { data: target } = await admin.from('companies').select('name').eq('id', body.company_id).single();
      const { error } = await admin.from('companies').delete().eq('id', body.company_id);
      if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'delete_company', target_type: 'company', target_id: body.company_id, details: { name: target?.name || null } });
      return json({ company_id: body.company_id });
    }
    if (body.action === 'create-user') {
      if (!body.email || !body.password || !body.company_id) return json({ error: 'Popunite sva polja.' }, 400);
      if (!body.first_name?.trim() || !body.last_name?.trim()) return json({ error: 'Ime i prezime su obavezni.' }, 400);
      const { data: created, error: userError } = await admin.auth.admin.createUser({ email: body.email.trim(), password: body.password, email_confirm: true, user_metadata: { first_name: body.first_name.trim(), last_name: body.last_name.trim() } });
      if (userError) throw userError;
      const { error: memberError } = await admin.from('company_users').insert({ company_id: body.company_id, user_id: created.user.id, role: 'member' });
      if (memberError) { await admin.auth.admin.deleteUser(created.user.id); throw memberError; }
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'create_user', target_type: 'user', target_id: created.user.id, details: { email: body.email.trim(), company_id: body.company_id, role: 'member' } });
      return json({ user_id: created.user.id });
    }
    if (body.action === 'update-user') {
      if (!body.user_id || !body.first_name?.trim() || !body.last_name?.trim()) return json({ error: 'Ime i prezime su obavezni.' }, 400);
      const { data: target, error } = await admin.auth.admin.getUserById(body.user_id);
      if (error || !target.user) return json({ error: 'Korisnik ne postoji.' }, 404);
      const { error: updateError } = await admin.auth.admin.updateUserById(body.user_id, { user_metadata: { ...(target.user.user_metadata || {}), first_name: body.first_name.trim(), last_name: body.last_name.trim() } });
      if (updateError) throw updateError;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'update_user', target_type: 'user', target_id: body.user_id, details: { email: target.user.email || null } });
      return json({ user_id: body.user_id });
    }
    if (body.action === 'update-user-companies') {
      if (!body.user_id || !Array.isArray(body.company_ids) || !body.company_ids.length) return json({ error: 'Korisnik mora imati najmanje jedno preduzeće.' }, 400);
      const uniqueCompanyIds = [...new Set(body.company_ids)];
      const { data: companies, error: companiesError } = await admin.from('companies').select('id').in('id', uniqueCompanyIds);
      if (companiesError || companies.length !== uniqueCompanyIds.length) return json({ error: 'Izabrano preduzeće ne postoji.' }, 400);
      const { data: existingMemberships, error: existingError } = await admin.from('company_users').select('company_id,role').eq('user_id', body.user_id);
      if (existingError) throw existingError;
      const roles = new Map((existingMemberships || []).map(item => [item.company_id, item.role]));
      const { error: deleteError } = await admin.from('company_users').delete().eq('user_id', body.user_id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await admin.from('company_users').insert(uniqueCompanyIds.map(company_id => ({ company_id, user_id: body.user_id, role: roles.get(company_id) || 'member' })));
      if (insertError) throw insertError;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'update_user_companies', target_type: 'user', target_id: body.user_id, details: { company_ids: uniqueCompanyIds } });
      return json({ user_id: body.user_id, company_ids: uniqueCompanyIds });
    }
    if (body.action === 'reset-password') {
      if (!body.user_id || !body.password || body.password.length < 8) return json({ error: 'Nova lozinka mora imati najmanje 8 karaktera.' }, 400);
      const { data: updated, error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'reset_password', target_type: 'user', target_id: body.user_id, details: { email: updated.user?.email || null } });
      return json({ user_id: body.user_id });
    }
    if (body.action === 'move-user') {
      if (!body.user_id || !body.company_id) return json({ error: 'Izaberite preduzeće.' }, 400);
      const { data: membership, error } = await admin.from('company_users').update({ company_id: body.company_id }).eq('user_id', body.user_id).select('user_id').maybeSingle();
      if (error) throw error;
      if (!membership) {
        const { error: insertError } = await admin.from('company_users').insert({ company_id: body.company_id, user_id: body.user_id, role: 'member' });
        if (insertError) throw insertError;
      }
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'move_user', target_type: 'user', target_id: body.user_id, details: { company_id: body.company_id } });
      return json({ user_id: body.user_id, company_id: body.company_id });
    }
    if (body.action === 'delete-user') {
      if (!body.user_id || body.user_id === user.id) return json({ error: 'Ne možete obrisati sopstveni administratorski nalog.' }, 400);
      const { data: target } = await admin.auth.admin.getUserById(body.user_id);
      if (!target.user) return json({ error: 'Korisnik ne postoji.' }, 404);
      await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, action: 'delete_user', target_type: 'user', target_id: body.user_id, details: { email: target.user.email || null } });
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) throw error;
      return json({ user_id: body.user_id });
    }
    return json({ error: 'Nepoznata radnja.' }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Greška servera.' }, 500); }
});
