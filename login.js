const form = document.querySelector('#login-form');
const message = document.querySelector('#auth-message');
const nextPage = new URLSearchParams(window.location.search).get('next') || 'poslovanje.html';

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = 'Provera podataka...';
  const values = Object.fromEntries(new FormData(form));
  const { error } = await window.itAntSupabase.auth.signInWithPassword({ email: values.email, password: values.password });
  if (error) { message.textContent = 'Email ili lozinka nisu ispravni.'; return; }
  window.location.href = nextPage;
});
