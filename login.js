const form = document.querySelector('#login-form');
const message = document.querySelector('#auth-message');
const nextPage = new URLSearchParams(window.location.search).get('next') || 'poslovanje.html';

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = 'Provera podataka...';
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await Promise.race([
      window.itAntSupabase.auth.signInWithPassword({ email: values.email, password: values.password }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);
    if (result.error) { message.textContent = 'Email ili lozinka nisu ispravni.'; return; }
    window.location.href = nextPage;
  } catch (error) {
    message.textContent = error.message === 'timeout' ? 'Supabase trenutno ne odgovara. Pokušaj ponovo za nekoliko trenutaka.' : 'Prijava nije uspela. Proveri internet konekciju.';
  } finally { button.disabled = false; }
});
