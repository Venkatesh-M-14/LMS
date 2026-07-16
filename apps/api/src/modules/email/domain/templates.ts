/**
 * Email templates — pure functions from a payload to a rendered message.
 * Kept dependency-free so rendering is unit-testable and the worker stays thin.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = 'Frontend Engineering Academy';

function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#5b5bd6;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${cta.label}</a></p>`
    : '';
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
  <h1 style="font-size:20px">${heading}</h1>
  ${bodyHtml}
  ${button}
  <hr style="border:none;border-top:1px solid #e5e5ef;margin:28px 0" />
  <p style="color:#6b6b80;font-size:12px">${BRAND}</p>
</div>`;
}

function esc(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}

type Renderer = (payload: Record<string, unknown>, webOrigin: string) => RenderedEmail;

const TEMPLATES: Record<string, Renderer> = {
  welcome: (p, web) => {
    const name = esc(p.displayName) || 'there';
    return {
      subject: `Welcome to ${BRAND}`,
      text: `Hi ${name}, welcome to ${BRAND}! Start your first lesson at ${web}.`,
      html: layout(
        `Welcome, ${name} 👋`,
        `<p>You're in. ${BRAND} takes you from zero to industry-ready frontend engineer — one guided lesson at a time.</p>`,
        { label: 'Start learning', url: web },
      ),
    };
  },
  'certificate-issued': (p, web) => {
    const scope = p.scope === 'PATH' ? 'learning path' : 'module';
    const title = esc(p.scopeTitle);
    const verifyUrl = `${web}/verify/${esc(p.verificationCode)}`;
    return {
      subject: `Your certificate for "${title}" is ready`,
      text: `Congratulations! You completed the ${scope} "${title}". Verify it at ${verifyUrl}.`,
      html: layout(
        'Certificate earned 🎓',
        `<p>Congratulations on completing the ${scope} <strong>"${title}"</strong>. Your certificate is available in your account, and anyone can verify it with the link below.</p>`,
        { label: 'View & verify', url: verifyUrl },
      ),
    };
  },
  /** Sent to the rest of the circle when a member hits a milestone (M10). */
  'peer-milestone': (p, web) => {
    const who = esc(p.actorName);
    const scope = p.scope === 'PATH' ? 'the whole learning path' : `the module "${esc(p.scopeTitle)}"`;
    return {
      subject: `${who} just completed ${p.scope === 'PATH' ? 'the learning path' : esc(p.scopeTitle)}`,
      text: `${who} completed ${scope}. See where everyone is up to: ${web}/leaderboard`,
      html: layout(
        `${who} hit a milestone 🎉`,
        `<p><strong>${who}</strong> just completed ${scope}. Your circle is moving — see where everyone is up to.</p>`,
        { label: 'View the leaderboard', url: `${web}/leaderboard` },
      ),
    };
  },
  'project-reviewed': (p, web) => {
    const approved = p.decision === 'APPROVED';
    const title = esc(p.briefTitle);
    return {
      subject: approved
        ? `Your project "${title}" was approved`
        : `Feedback on your project "${title}"`,
      text: approved
        ? `Your submission for "${title}" was approved. Great work!`
        : `Your reviewer requested changes on "${title}". Open the platform to see the feedback.`,
      html: layout(
        approved ? 'Project approved ✅' : 'Changes requested',
        approved
          ? `<p>Your submission for <strong>"${title}"</strong> passed review. Great work!</p>`
          : `<p>Your reviewer left feedback on <strong>"${title}"</strong>. Open the project to see what to revise.</p>`,
        { label: 'Open the academy', url: web },
      ),
    };
  },
};

export function renderEmail(
  template: string,
  payload: Record<string, unknown>,
  webOrigin: string,
): RenderedEmail | null {
  const renderer = TEMPLATES[template];
  return renderer ? renderer(payload, webOrigin) : null;
}
