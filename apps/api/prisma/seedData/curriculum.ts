/**
 * The Frontend Engineering path: 9 modules, 31 topics. Topics 1–2 are
 * deeply authored (see lessons.ts); the rest are structured outlines ready
 * for authoring through the CMS.
 */

export interface TopicSeed {
  slug: string;
  title: string;
  description: string;
  depth: 'AUTHORED' | 'OUTLINE';
  skills: Array<{ slug: string; name: string }>;
}

export interface ModuleSeed {
  slug: string;
  title: string;
  description: string;
  topics: TopicSeed[];
}

export const PATH_SEED = {
  slug: 'frontend-engineering',
  title: 'Frontend Engineering',
  description:
    'One guided journey from zero programming knowledge to industry-ready frontend engineer: fundamentals, HTML/CSS/JavaScript, TypeScript and React, quality, delivery, and career preparation.',
};

export const MODULES_SEED: ModuleSeed[] = [
  {
    slug: 'foundations',
    title: 'Foundations of Computing',
    description: 'How computers, operating systems, browsers, and the internet actually work.',
    topics: [
      {
        slug: 'computer-science-fundamentals',
        title: 'Computer Science Fundamentals',
        description:
          'What a computer really does: representing data with bits, executing instructions, and reasoning about algorithms.',
        depth: 'AUTHORED',
        skills: [
          { slug: 'data-representation', name: 'Binary & Data Representation' },
          { slug: 'execution-model', name: 'How Code Executes' },
          { slug: 'algorithmic-thinking', name: 'Algorithmic Thinking' },
        ],
      },
      {
        slug: 'operating-systems-basics',
        title: 'Operating Systems Basics',
        description:
          'Processes, threads, memory, and the file system — the machinery every program (including your browser) runs on.',
        depth: 'AUTHORED',
        skills: [
          { slug: 'processes-threads', name: 'Processes & Threads' },
          { slug: 'memory-storage', name: 'Memory & Storage' },
          { slug: 'command-line', name: 'Command Line Basics' },
        ],
      },
      {
        slug: 'browser-internals',
        title: 'Browser Internals',
        description:
          'Rendering pipeline, the DOM, the event loop, and what happens between typing a URL and seeing pixels.',
        depth: 'OUTLINE',
        skills: [{ slug: 'browser-rendering', name: 'Browser Rendering Pipeline' }],
      },
      {
        slug: 'internet-and-networking',
        title: 'Internet & Networking',
        description: 'IP, DNS, TCP, TLS, and HTTP — the stack that moves your bytes.',
        depth: 'OUTLINE',
        skills: [{ slug: 'http-networking', name: 'HTTP & Networking' }],
      },
    ],
  },
  {
    slug: 'markup-and-styling',
    title: 'HTML & CSS',
    description: 'Semantic structure and modern layout — the visual language of the web.',
    topics: [
      {
        slug: 'html-mastery',
        title: 'HTML Mastery',
        description: 'Semantic elements, forms, media, and accessible document structure.',
        depth: 'OUTLINE',
        skills: [{ slug: 'semantic-html', name: 'Semantic HTML' }],
      },
      {
        slug: 'css-mastery',
        title: 'CSS Mastery',
        description: 'The cascade, flexbox, grid, responsive design, and modern CSS features.',
        depth: 'OUTLINE',
        skills: [{ slug: 'css-layout', name: 'CSS Layout' }],
      },
    ],
  },
  {
    slug: 'javascript',
    title: 'JavaScript & Problem Solving',
    description:
      'The language of the web, plus the data structures and algorithms behind interviews and fast UIs.',
    topics: [
      {
        slug: 'javascript-mastery',
        title: 'JavaScript Mastery',
        description: 'From variables to closures, prototypes, async/await, and the event loop.',
        depth: 'OUTLINE',
        skills: [{ slug: 'javascript-core', name: 'JavaScript Core' }],
      },
      {
        slug: 'dsa-for-frontend',
        title: 'Data Structures & Algorithms for Frontend',
        description:
          'Arrays, maps, trees, and graphs with frontend-flavoured problems: DOM traversal, list diffing, debouncing.',
        depth: 'OUTLINE',
        skills: [{ slug: 'dsa', name: 'Data Structures & Algorithms' }],
      },
    ],
  },
  {
    slug: 'typescript-and-react',
    title: 'TypeScript & React',
    description: 'Typed, component-driven UI engineering with the modern React ecosystem.',
    topics: [
      {
        slug: 'typescript-mastery',
        title: 'TypeScript Mastery',
        description: 'The type system, generics, narrowing, and typing real applications.',
        depth: 'OUTLINE',
        skills: [{ slug: 'typescript-core', name: 'TypeScript Core' }],
      },
      {
        slug: 'react-mastery',
        title: 'React Mastery',
        description: 'Components, hooks, rendering behaviour, and performance.',
        depth: 'OUTLINE',
        skills: [{ slug: 'react-core', name: 'React Core' }],
      },
      {
        slug: 'ui-ux-fundamentals',
        title: 'UI/UX Fundamentals',
        description: 'Design principles, typography, spacing systems, and usable interfaces.',
        depth: 'OUTLINE',
        skills: [{ slug: 'ui-ux', name: 'UI/UX Principles' }],
      },
      {
        slug: 'react-router',
        title: 'React Router',
        description: 'Client-side routing, nested layouts, loaders, and navigation state.',
        depth: 'OUTLINE',
        skills: [{ slug: 'routing', name: 'Client-Side Routing' }],
      },
      {
        slug: 'state-management',
        title: 'State Management',
        description: 'Local vs server state, Redux Toolkit, TanStack Query, and when to use which.',
        depth: 'OUTLINE',
        skills: [{ slug: 'state-management', name: 'State Management' }],
      },
    ],
  },
  {
    slug: 'data-and-integration',
    title: 'APIs & Realtime Data',
    description: 'Talking to servers: REST, auth flows, and realtime channels.',
    topics: [
      {
        slug: 'api-integration',
        title: 'API Integration',
        description: 'fetch, error handling, caching, pagination, and resilient data layers.',
        depth: 'OUTLINE',
        skills: [{ slug: 'api-integration', name: 'API Integration' }],
      },
      {
        slug: 'authentication-authorization',
        title: 'Authentication & Authorization',
        description: 'Sessions, JWTs, OAuth, and secure token handling in SPAs.',
        depth: 'OUTLINE',
        skills: [{ slug: 'web-auth', name: 'Web Authentication' }],
      },
      {
        slug: 'websockets',
        title: 'WebSockets',
        description: 'Realtime communication: sockets, reconnection, and presence.',
        depth: 'OUTLINE',
        skills: [{ slug: 'realtime', name: 'Realtime Communication' }],
      },
    ],
  },
  {
    slug: 'quality-and-collaboration',
    title: 'Quality & Collaboration',
    description: 'Testing strategies and the collaborative workflows of professional teams.',
    topics: [
      {
        slug: 'testing',
        title: 'Testing',
        description: 'Unit, component, and end-to-end testing with Jest, RTL, and Playwright.',
        depth: 'OUTLINE',
        skills: [{ slug: 'testing', name: 'Testing' }],
      },
      {
        slug: 'git-and-github',
        title: 'Git & GitHub',
        description:
          'Version control fluency: branching, rebasing, code review, and team workflows.',
        depth: 'OUTLINE',
        skills: [{ slug: 'git', name: 'Git & Version Control' }],
      },
    ],
  },
  {
    slug: 'delivery-and-operations',
    title: 'Delivery & Operations',
    description:
      'Shipping frontend software: performance, security, accessibility, and infrastructure.',
    topics: [
      {
        slug: 'devops-for-frontend',
        title: 'DevOps for Frontend',
        description: 'Build pipelines, environments, artifacts, and observability for UI teams.',
        depth: 'OUTLINE',
        skills: [{ slug: 'devops', name: 'Frontend DevOps' }],
      },
      {
        slug: 'performance-optimization',
        title: 'Performance Optimization',
        description: 'Core Web Vitals, bundle discipline, rendering performance, and measurement.',
        depth: 'OUTLINE',
        skills: [{ slug: 'performance', name: 'Web Performance' }],
      },
      {
        slug: 'security',
        title: 'Security',
        description: 'XSS, CSRF, CSP, supply-chain risks, and secure-by-default frontend patterns.',
        depth: 'OUTLINE',
        skills: [{ slug: 'web-security', name: 'Web Security' }],
      },
      {
        slug: 'accessibility',
        title: 'Accessibility',
        description: 'WCAG, semantic markup, keyboard support, and assistive-technology testing.',
        depth: 'OUTLINE',
        skills: [{ slug: 'accessibility', name: 'Accessibility' }],
      },
      {
        slug: 'seo',
        title: 'SEO',
        description: 'Crawlability, metadata, structured data, and rendering strategies.',
        depth: 'OUTLINE',
        skills: [{ slug: 'seo', name: 'SEO' }],
      },
      {
        slug: 'progressive-web-apps',
        title: 'Progressive Web Apps',
        description: 'Service workers, offline strategies, and installable web apps.',
        depth: 'OUTLINE',
        skills: [{ slug: 'pwa', name: 'Progressive Web Apps' }],
      },
      {
        slug: 'docker',
        title: 'Docker',
        description: 'Containers for local dev and deployment, images, and compose.',
        depth: 'OUTLINE',
        skills: [{ slug: 'docker', name: 'Docker' }],
      },
      {
        slug: 'ci-cd',
        title: 'CI/CD',
        description:
          'Automated pipelines: linting, testing, building, and releasing on every push.',
        depth: 'OUTLINE',
        skills: [{ slug: 'ci-cd', name: 'CI/CD' }],
      },
      {
        slug: 'deployment',
        title: 'Deployment',
        description: 'Hosting models, CDNs, environment configuration, and rollbacks.',
        depth: 'OUTLINE',
        skills: [{ slug: 'deployment', name: 'Deployment' }],
      },
    ],
  },
  {
    slug: 'engineering-at-scale',
    title: 'Frontend Engineering at Scale',
    description: 'Designing and maintaining large frontend systems with many contributors.',
    topics: [
      {
        slug: 'frontend-system-design',
        title: 'Frontend System Design',
        description:
          'Architecture interviews and real-world design: micro-frontends, design systems, data flows.',
        depth: 'OUTLINE',
        skills: [{ slug: 'system-design', name: 'Frontend System Design' }],
      },
      {
        slug: 'enterprise-development-practices',
        title: 'Enterprise Development Practices',
        description:
          'Code review culture, documentation, feature flags, and working in large codebases.',
        depth: 'OUTLINE',
        skills: [{ slug: 'enterprise-practices', name: 'Enterprise Practices' }],
      },
    ],
  },
  {
    slug: 'career',
    title: 'Career & Interview Preparation',
    description: 'Turning skills into offers: portfolios, resumes, and interview performance.',
    topics: [
      {
        slug: 'career-preparation',
        title: 'Career Preparation',
        description: 'Portfolio building, resume craft, networking, and the job search.',
        depth: 'OUTLINE',
        skills: [{ slug: 'career', name: 'Career Skills' }],
      },
      {
        slug: 'interview-preparation',
        title: 'Interview Preparation',
        description: 'Coding rounds, machine coding, system design, and behavioural interviews.',
        depth: 'OUTLINE',
        skills: [{ slug: 'interviewing', name: 'Interviewing' }],
      },
    ],
  },
];
