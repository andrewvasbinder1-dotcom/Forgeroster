/* ForgeRoster authentication: Supabase Auth (email/password).
   Configure window.FORGEROSTER_SUPABASE in auth-config.js.
   Never put service_role or secret keys in browser code. */
(()=>{'use strict';
const css=document.createElement('style');css.textContent=`
html{font-size:16px}body{overflow-x:hidden}button,input,select{min-height:44px}input,select{max-width:100%}
#frAuthGate{position:fixed;inset:0;z-index:9999;background:#090e1b;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:24px 16px;width:100%;height:100%;max-width:none;max-height:none;border:0;color:inherit}
#frAuthGate[hidden],#frAuthCard [hidden]{display:none!important}#frAuthCard{width:min(100%,420px);background:#141d30;border:1px solid #32425e;border-radius:18px;padding:26px 22px;box-shadow:0 20px 80px #0008}
#frAuthCard h2{font-size:27px;margin:0 0 8px}#frAuthCard p{color:#aebbd0;line-height:1.5}#frAuthCard label{display:block;margin:16px 0 6px}#frAuthCard input{display:block;width:100%;background:#0e1626;color:#fff;border:1px solid #52647f;border-radius:10px;padding:12px}
#frAuthCard button{width:100%;background:#507ee3;color:white;border:0;border-radius:10px;margin-top:18px;padding:12px;font-weight:700}
#frAuthCard button:disabled{opacity:.55}#frAuthCard .fr-link{background:transparent;border:0;color:#9dc1ff;font-weight:500;margin-top:10px}
#frAuthError{color:#ffb4a8!important;min-height:22px}#frAccount{display:flex;align-items:center;gap:8px;font-size:12px;color:#bac8df;max-width:50vw}#frAccount button{min-height:44px;padding:7px 12px;white-space:nowrap}#frAccount span{overflow-wrap:anywhere}#frAuthOpen{min-height:44px}body.fr-auth-pending> :not(#frAuthGate):not(script){visibility:hidden}
@media(max-width:600px){header{padding:12px 14px;gap:8px;flex-wrap:wrap}header h1{font-size:20px}#frAuthCard{padding:22px 18px}#frAuthGate{padding:12px}main{padding:12px}main aside,main section{padding:15px}#frWizard .fr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#frWizard .fr-choice{overflow-wrap:anywhere}#frAccount{max-width:100%;width:100%;justify-content:space-between}#frAccount span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}input{font-size:16px}}
`;document.head.append(css);
const gate = document.createElement('dialog');
gate.id = 'frAuthGate';
gate.setAttribute('aria-labelledby', 'frAuthTitle');
gate.innerHTML = `<div id="frAuthCard"><h2 id="frAuthTitle">ForgeRoster account</h2><p id="frAuthIntro"></p>
  <form id="frAuthForm"><label for="frEmail">Email</label>
  <input id="frEmail" type="email" autocomplete="email" required placeholder="you@example.com">
  <label id="frPasswordLabel" for="frPassword">Password</label>
  <input id="frPassword" type="password" autocomplete="current-password" minlength="6" required>
  <button id="frSubmit" type="submit">Sign in</button></form>
  <p id="frAuthError" role="status" aria-live="polite"></p>
  <button id="frSwitch" class="fr-link" type="button">Create an account</button>
  <button id="frReset" class="fr-link" type="button">Forgot password?</button>
  <button id="frGuest" class="fr-link" type="button">Continue on this device</button>
</div>`;
gate.hidden = true;
document.body.append(gate);
const $ = id => document.getElementById(id);
const cfg = window.FORGEROSTER_SUPABASE;
const redirect = location.origin + location.pathname;
let mode = 'login';
let identity = null;
let recovery = false;
let declinedSession = false;
let client;

function message(text) { $('frAuthError').textContent = text; }
function openGate() {
  gate.hidden = false;
  if (!gate.open) gate.showModal();
}
function closeGate() {
  if (gate.open) gate.close();
  gate.hidden = true;
}
function modeSet(next) {
  mode = next;
  const isReset = mode === 'reset';
  const isRecovery = mode === 'recovery';
  $('frSubmit').textContent = {
    login: 'Sign in', signup: 'Create account', reset: 'Send reset email', recovery: 'Save password'
  }[mode];
  $('frAuthIntro').textContent = {
    login: 'Sign in to save your armies across devices.',
    signup: 'Enter your email and choose a password. Check your inbox to verify the account.',
    reset: 'Enter your email to request a password reset link.',
    recovery: 'Choose a new password for your account.'
  }[mode];
  $('frEmail').required = !isRecovery;
  $('frEmail').hidden = isRecovery;
  $('frEmail').previousElementSibling.hidden = isRecovery;
  $('frPassword').required = !isReset;
  $('frPassword').hidden = isReset;
  $('frPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('frPasswordLabel').hidden = isReset;
  $('frSwitch').hidden = isRecovery;
  $('frSwitch').textContent = mode === 'login' ? 'Create an account' : 'Back to sign in';
  $('frReset').hidden = isReset || isRecovery;
  $('frGuest').textContent = isRecovery ? 'Cancel and sign out' : 'Continue on this device';
  message('');
}

const account = document.createElement('div');
account.id = 'frAccount';
const email = document.createElement('span');
email.id = 'frAccountEmail';
const accountButton = document.createElement('button');
accountButton.id = 'frAuthOpen';
accountButton.type = 'button';
account.append(email, accountButton);
document.querySelector('header')?.append(account);

function showGuest() {
  if (identity) {
    identity = null;
    document.dispatchEvent(new Event('fr-user-signed-out'));
  }
  document.body.classList.remove('fr-auth-pending');
  email.textContent = '';
  accountButton.textContent = 'Sign in';
  accountButton.onclick = () => { modeSet('login'); openGate(); };
}
async function signOut(skipFlush = false) {
  accountButton.disabled = true;
  try {
    if (!skipFlush) {
      try { await window.frFlushCloudRoster?.(); } catch {
        if (!confirm('Some changes have not synced. Sign out and keep your edits in this tab?')) return;
      }
    }
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    recovery = false;
    showGuest();
    closeGate();
  } catch (error) {
    openGate();
    message('Could not sign out. ' + error.message);
  } finally {
    accountButton.disabled = false;
  }
}
function showAccount(user) {
  if (identity?.id !== user.id) {
    identity = user;
    document.dispatchEvent(new CustomEvent('fr-user-signed-in', { detail: { client, user } }));
  }
  document.body.classList.remove('fr-auth-pending');
  email.textContent = user.email || 'Signed in';
  accountButton.textContent = 'Sign out';
  accountButton.onclick = () => signOut();
  $('frPassword').value = '';
  closeGate();
}

function failConfig() {
  accountButton.disabled = true;
  email.textContent = 'Cloud sign-in unavailable. Device rosters are available.';
  document.body.classList.remove('fr-auth-pending');
}
showGuest();
if (!cfg?.url || !cfg?.anonKey || !window.supabase?.createClient) {
  failConfig();
  return;
}
try {
  client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
} catch {
  failConfig();
  return;
}
document.body.classList.add('fr-auth-pending');
const initialSessionTimer = setTimeout(() => {
  document.body.classList.remove('fr-auth-pending');
  modeSet('login');
  message('Cloud sign-in took too long. You can continue on this device.');
  openGate();
}, 8000);
client.auth.onAuthStateChange((event, session) => {
  // Supabase Auth's callback holds an internal lock. Cloud queries start after it returns.
  setTimeout(() => {
    clearTimeout(initialSessionTimer);
    if (event === 'PASSWORD_RECOVERY') {
      recovery = true;
      document.body.classList.remove('fr-auth-pending');
      modeSet('recovery');
      openGate();
      return;
    }
    if (event === 'INITIAL_SESSION' && !session && /(?:^|[&#?])error=/.test(location.hash + location.search)) {
      showGuest();
      modeSet('reset');
      message('This link could not be verified. Request a new password reset link.');
      openGate();
      return;
    }
    if (recovery && session) return;
    if (session?.user && !(declinedSession && event === 'INITIAL_SESSION')) {
      showAccount(session.user);
    } else if (!session) {
      recovery = false;
      showGuest();
    }
  }, 0);
});
$('frSwitch').onclick = () => modeSet(mode === 'login' ? 'signup' : 'login');
$('frReset').onclick = () => modeSet('reset');
$('frGuest').onclick = () => {
  if (recovery) { signOut(true); return; }
  declinedSession = true;
  closeGate();
};
gate.addEventListener('cancel', event => {
  if (recovery) {
    event.preventDefault();
    signOut(true);
  }
});
gate.addEventListener('close', () => { gate.hidden = true; });
$('frAuthForm').onsubmit = async event => {
  event.preventDefault();
  const address = $('frEmail').value.trim();
  const password = $('frPassword').value;
  const button = $('frSubmit');
  button.disabled = true;
  message('Working…');
  try {
    if (mode === 'recovery') {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recovery = false;
      showAccount(data.user);
    } else if (mode === 'reset') {
      const { error } = await client.auth.resetPasswordForEmail(address, { redirectTo: redirect });
      if (error) throw error;
      message('Password reset requested. Check your inbox.');
    } else if (mode === 'signup') {
      const { data, error } = await client.auth.signUp({
        email: address, password, options: { emailRedirectTo: redirect }
      });
      if (error) throw error;
      if (!data.session) message('Check your email to confirm your account.');
    } else {
      const { error } = await client.auth.signInWithPassword({ email: address, password });
      if (error) throw error;
    }
  } catch (error) {
    message(error.message || 'Authentication failed.');
  } finally {
    button.disabled = false;
  }
};
})();
