/**
 * Seed coding challenges + which lesson quizzes they attach to. A mix of
 * visible tests (shipped to the client for instant runs) and hidden tests
 * (server-side only — the anti-hardcoding guard).
 */

export interface ChallengeSeed {
  slug: string;
  title: string;
  environment: 'JS' | 'DOM';
  instructionsMd: string;
  starterFiles: Record<string, string>;
  solutionFiles: Record<string, string>;
  timeLimitMs: number;
  tests: Array<{
    name: string;
    kind: 'UNIT' | 'DOM';
    specCode: string;
    weight: number;
    isHidden: boolean;
  }>;
}

export interface ChallengeAttachment {
  lessonSlug: string;
  challengeSlug: string;
  itemType: 'CODING' | 'DEBUGGING';
  points: number;
  skillSlugs: string[];
}

export const CHALLENGES_SEED: ChallengeSeed[] = [
  {
    slug: 'binary-search',
    title: 'Implement binary search',
    environment: 'JS',
    instructionsMd: `Implement \`binarySearch(sorted, target)\`:

- \`sorted\` is an array of numbers in ascending order
- return the **index** of \`target\`, or \`-1\` when it is absent
- your solution must halve the search space each step (no \`indexOf\`!)

The visible tests check the happy path. Hidden tests probe the edges — first/last elements and empty input.`,
    starterFiles: {
      'main.js': `function binarySearch(sorted, target) {
  // TODO: return the index of target in sorted, or -1 if absent.
  return -1;
}
`,
    },
    solutionFiles: {
      'main.js': `function binarySearch(sorted, target) {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
`,
    },
    timeLimitMs: 5000,
    tests: [
      {
        name: 'finds an element in the middle',
        kind: 'UNIT',
        specCode: 'assertEqual(binarySearch([1, 3, 5, 7, 9], 5), 2)',
        weight: 1,
        isHidden: false,
      },
      {
        name: 'returns -1 for a missing element',
        kind: 'UNIT',
        specCode: 'assertEqual(binarySearch([1, 3, 5, 7, 9], 4), -1)',
        weight: 1,
        isHidden: false,
      },
      {
        name: 'finds the first and last elements',
        kind: 'UNIT',
        specCode:
          'assertEqual(binarySearch([2, 4, 6, 8], 2), 0); assertEqual(binarySearch([2, 4, 6, 8], 8), 3)',
        weight: 1,
        isHidden: true,
      },
      {
        name: 'handles an empty array',
        kind: 'UNIT',
        specCode: 'assertEqual(binarySearch([], 1), -1)',
        weight: 1,
        isHidden: true,
      },
    ],
  },
  {
    slug: 'fix-sum-first-n',
    title: 'Fix the off-by-one bug',
    environment: 'JS',
    instructionsMd: `\`sumFirstN(numbers, n)\` should add up the **first n** numbers of the array — but QA reports it returns too much. Find the bug and fix it.

Do not rewrite the function from scratch; find the actual defect.`,
    starterFiles: {
      'main.js': `function sumFirstN(numbers, n) {
  let total = 0;
  for (let i = 0; i <= n; i++) {
    total += numbers[i] ?? 0;
  }
  return total;
}
`,
    },
    solutionFiles: {
      'main.js': `function sumFirstN(numbers, n) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += numbers[i] ?? 0;
  }
  return total;
}
`,
    },
    timeLimitMs: 5000,
    tests: [
      {
        name: 'sums the first two numbers',
        kind: 'UNIT',
        specCode: 'assertEqual(sumFirstN([10, 20, 30, 40], 2), 30)',
        weight: 1,
        isHidden: false,
      },
      {
        name: 'n equal to the array length',
        kind: 'UNIT',
        specCode: 'assertEqual(sumFirstN([1, 2, 3], 3), 6)',
        weight: 1,
        isHidden: true,
      },
      {
        name: 'n of zero sums nothing',
        kind: 'UNIT',
        specCode: 'assertEqual(sumFirstN([5, 5], 0), 0)',
        weight: 1,
        isHidden: true,
      },
    ],
  },
  {
    slug: 'render-process-list',
    title: 'Render the process list',
    environment: 'DOM',
    instructionsMd: `The array \`PROCESS_NAMES\` is defined for you. Render it into the page:

- create a \`<ul>\` with the id \`processes\`
- append one \`<li>\` per name, **in array order**
- append the list to \`document.body\`

Use the DOM APIs (\`createElement\`, \`appendChild\`, \`textContent\`).`,
    starterFiles: {
      'main.js': `const PROCESS_NAMES = ['browser', 'renderer', 'gpu'];

// TODO: render <ul id="processes"> with one <li> per process name.
`,
    },
    solutionFiles: {
      'main.js': `const PROCESS_NAMES = ['browser', 'renderer', 'gpu'];

const list = document.createElement('ul');
list.id = 'processes';
for (const name of PROCESS_NAMES) {
  const item = document.createElement('li');
  item.textContent = name;
  list.appendChild(item);
}
document.body.appendChild(list);
`,
    },
    timeLimitMs: 5000,
    tests: [
      {
        name: 'a #processes list exists',
        kind: 'DOM',
        specCode: 'assert(document.querySelector("ul#processes"), "no <ul id=processes> found")',
        weight: 1,
        isHidden: false,
      },
      {
        name: 'renders one item per process',
        kind: 'DOM',
        specCode: 'assertEqual(document.querySelectorAll("#processes li").length, 3)',
        weight: 1,
        isHidden: false,
      },
      {
        name: 'items appear in array order',
        kind: 'DOM',
        specCode:
          'const texts = [...document.querySelectorAll("#processes li")].map((li) => li.textContent); assertEqual(texts, ["browser", "renderer", "gpu"])',
        weight: 2,
        isHidden: true,
      },
    ],
  },
];

export const CHALLENGE_ATTACHMENTS: ChallengeAttachment[] = [
  {
    lessonSlug: 'thinking-in-algorithms',
    challengeSlug: 'binary-search',
    itemType: 'CODING',
    points: 6,
    skillSlugs: ['algorithmic-thinking'],
  },
  {
    lessonSlug: 'from-source-code-to-execution',
    challengeSlug: 'fix-sum-first-n',
    itemType: 'DEBUGGING',
    points: 4,
    skillSlugs: ['execution-model'],
  },
  {
    lessonSlug: 'processes-and-threads',
    challengeSlug: 'render-process-list',
    itemType: 'CODING',
    points: 5,
    skillSlugs: ['processes-threads'],
  },
];
