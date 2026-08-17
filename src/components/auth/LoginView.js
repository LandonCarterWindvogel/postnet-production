// Signed-out screen for the production management system.

import { isSupabaseConfigured } from '../../services/supabase.js';

export function renderLoginView() {
  return `<main class="login">
    <section class="login__panel">
      <div class="login__brand" aria-label="PostNet Copy and Print">
        <div class="brand__mark brand__mark--login">
          <strong>POSTNET</strong>
          <em>copy &amp; print</em>
        </div>
        <span>Production Management System</span>
      </div>
      <p class="eyebrow">PostNet Production</p>
      <h1>Sign in to your production centre.</h1>
      <p class="login__intro">Manage incoming work, production progress, stock and completed jobs from one place.</p>
      <form id="login-form" class="login__form">
        <label>Work email<input name="email" type="email" autocomplete="username" required placeholder="name@postnet.co.za"></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
        <div class="login__options">
          <label class="check"><input type="checkbox"> Remember me</label>
          <button type="button" class="link-button" disabled>Forgot password?</button>
        </div>
        <p class="form-error"></p>
        <button class="button button--primary button--wide" ${isSupabaseConfigured ? '' : 'disabled'}>Sign in</button>
      </form>
    </section>
    <aside class="login__hero">
      <div>
        <span class="login__hero-kicker">Copy &amp; Print · Production Centre</span>
        <h2>Keep every job moving.</h2>
        <p>See what needs to be printed, cut, weeded, pressed, checked and collected — without losing the production queue.</p>
        <div class="login__hero-pills">
          <span>Live queue</span><span>Branch visibility</span><span>Stock control</span>
        </div>
      </div>
      <small>© ${new Date().getFullYear()} PostNet. Production management.</small>
    </aside>
  </main>`;
}
