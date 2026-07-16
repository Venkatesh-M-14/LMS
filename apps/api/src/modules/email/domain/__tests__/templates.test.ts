import { renderEmail } from '../templates';

const WEB = 'http://web.test';

describe('renderEmail', () => {
  it('renders the welcome email with the display name', () => {
    const out = renderEmail('welcome', { displayName: 'Sam' }, WEB);
    expect(out).not.toBeNull();
    expect(out!.subject).toMatch(/welcome/i);
    expect(out!.html).toContain('Sam');
    expect(out!.text).toContain(WEB);
  });

  it('renders a certificate email with a verification link', () => {
    const out = renderEmail(
      'certificate-issued',
      { scope: 'PATH', scopeTitle: 'Frontend', verificationCode: 'abc-123' },
      WEB,
    );
    expect(out!.subject).toContain('Frontend');
    expect(out!.html).toContain(`${WEB}/verify/abc-123`);
  });

  it('varies the project email by decision', () => {
    const approved = renderEmail('project-reviewed', { briefTitle: 'App', decision: 'APPROVED' }, WEB);
    const changes = renderEmail('project-reviewed', { briefTitle: 'App', decision: 'CHANGES_REQUESTED' }, WEB);
    expect(approved!.subject).toMatch(/approved/i);
    expect(changes!.subject).toMatch(/feedback/i);
  });

  it('escapes HTML in payload values', () => {
    const out = renderEmail('welcome', { displayName: '<script>x</script>' }, WEB);
    expect(out!.html).not.toContain('<script>x</script>');
    expect(out!.html).toContain('&lt;script&gt;');
  });

  it('returns null for an unknown template', () => {
    expect(renderEmail('does-not-exist', {}, WEB)).toBeNull();
  });
});
