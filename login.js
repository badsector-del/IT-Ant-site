const form = document.querySelector('#login-form');
const message = document.querySelector('#auth-message');
const signupButton = document.querySelector('#signup-button');
const nextPage = new URLSearchParams(window.location.search).get('next') || 'poslovanje.html';

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = 'Provera podataka...';
  const values = Object.fromEntries(new FormData(form));
  const { error } = await window.itAntSupabase.auth.signInWithPassword({ email: values.email, password: values.password });
  if (error) { message.textContent = 'Email ili lozinka nisu ispravni.'; return; }
  window.location.href = nextPage;
});

signupButton.addEventListener('click', async () => {
  const values = Object.fromEntries(new FormData(form));
  if (!values.email || !values.password) { message.textContent = 'Unesite email i lozinku za kreiranje naloga.'; return; }
  message.textContent = 'Kreiranje naloga...';
  const { error } = await window.itAntSupabase.auth.signUp({ email: values.email, password: values.password, options: { emailRedirectTo: `${window.location.origin}/login.html` } });
  message.textContent = error ? error.message : 'Nalog je kreiran. Proverite email ako je potvrda uključena.';
});
