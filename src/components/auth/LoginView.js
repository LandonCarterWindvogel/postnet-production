// The signed-out screen. Sign-in button is disabled until Supabase env
// values are actually present (see services/supabase.js).

import { isSupabaseConfigured } from '../../services/supabase.js';

export function renderLoginView() {
  return `<main class="login">
      <section>
        <a class="brand brand--dark"><span>PN</span><b>PostNet<br>Production</b></a>
        <p class="eyebrow">Production workflow management</p>
        <h1>Welcome back</h1>
        <p>Sign in to manage work across the production centre and branches.</p>
        <form id="login-form">
          <label>Work email<input name="email" type="email" required></label>
          <label>Password<input name="password" type="password" required></label>
          <p class="form-error"></p>
          <button class="button button--primary" ${isSupabaseConfigured ? '' : 'disabled'}>Sign in</button>
        </form>
      </section>
      <aside>
        <p>Built for the production centre.</p>
        <h2>Know the next job, its exact requirements, and where every other job is in the process.</h2>
      </aside>
    </main>`;
}
