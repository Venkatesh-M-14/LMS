export const en = {
  app: {
    name: 'Frontend Engineering Academy',
    tagline: 'From zero to industry-ready frontend engineer.',
  },
  nav: {
    dashboard: 'Dashboard',
    logout: 'Log out',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    language: 'Language',
  },
  auth: {
    loginTitle: 'Welcome back',
    loginSubtitle: 'Log in to continue your learning journey',
    registerTitle: 'Create your account',
    registerSubtitle: 'Start your journey to industry-ready frontend engineering',
    email: 'Email address',
    password: 'Password',
    displayName: 'Display name',
    loginButton: 'Log in',
    registerButton: 'Create account',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    registerLink: 'Sign up',
    loginLink: 'Log in',
    errors: {
      INVALID_CREDENTIALS: 'Email or password is incorrect.',
      EMAIL_ALREADY_REGISTERED: 'An account with this email already exists.',
      ACCOUNT_SUSPENDED: 'This account has been suspended. Contact support.',
      RATE_LIMITED: 'Too many attempts — please wait a moment and try again.',
      NETWORK: 'Cannot reach the server. Check your connection and try again.',
      UNEXPECTED: 'Something went wrong. Please try again.',
    },
  },
  dashboard: {
    greeting: 'Welcome, {{name}}!',
    subtitle: 'Your learning journey starts here.',
    roleLabel: 'Signed in as {{role}}',
    curriculumTitle: 'Your learning path',
    curriculumEmpty:
      'The Frontend Engineering path is being prepared. Lessons, challenges, and projects arrive with the next platform update.',
    profileTitle: 'Profile',
    memberSince: 'Member since {{date}}',
  },
  errors: {
    boundaryTitle: 'Something went wrong',
    boundaryBody: 'An unexpected error occurred in the application. Reloading usually fixes it.',
    reload: 'Reload page',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The page you are looking for does not exist or has moved.',
    backHome: 'Back to dashboard',
  },
  common: {
    loading: 'Loading…',
  },
};

export type Messages = typeof en;
