/** Project briefs for the authored topics, each with a scoring rubric. */

export interface ProjectBriefSeed {
  topicSlug: string;
  kind: 'MINI_PROJECT' | 'MACHINE_CODING';
  title: string;
  briefMd: string;
  rubric: Array<{ title: string; description: string; maxPoints: number }>;
}

export const PROJECT_BRIEFS_SEED: ProjectBriefSeed[] = [
  {
    topicSlug: 'computer-science-fundamentals',
    kind: 'MINI_PROJECT',
    title: 'Build a toy computer simulator',
    briefMd: `Extend the toy CPU from lesson 1 into a small, working simulator.

## Requirements

- Support at least these instructions: \`SET\`, \`ADD\`, \`SUB\`, \`PRINT\`, and \`JUMP_IF_ZERO\`
- Programs are arrays of instruction objects; the simulator runs them with a program counter
- Include at least **three example programs**, one of which must use a loop built from \`JUMP_IF_ZERO\`
- A \`README.md\` explaining the instruction set and how to run the examples (Node.js)

## Constraints

- Plain JavaScript, no dependencies
- Push the project to a public Git repository and submit the URL

## Hints

Start from the fetch–decode–execute loop in the lesson. Think about what
happens when a program jumps backwards — that is how loops exist at the
machine level.`,
    rubric: [
      {
        title: 'Correctness',
        description:
          'All five instructions work; the loop example terminates with the right output.',
        maxPoints: 10,
      },
      {
        title: 'Code clarity',
        description: 'Readable naming, small functions, no dead code.',
        maxPoints: 5,
      },
      {
        title: 'README & examples',
        description: 'A newcomer can run every example from the README alone.',
        maxPoints: 5,
      },
    ],
  },
  {
    topicSlug: 'operating-systems-basics',
    kind: 'MACHINE_CODING',
    title: 'Process monitor page',
    briefMd: `Build a single-page "process monitor" with vanilla HTML/CSS/JS — no frameworks.

## Requirements

- Render a table of at least 8 mock processes: name, PID, memory (MB), state (\`running\` / \`sleeping\`)
- A text input filters the table by process name as you type
- Clicking a column header sorts by that column (toggle asc/desc)
- A "kill" button per row removes the process from the table
- State lives in a single JavaScript array; the DOM re-renders from it

## Constraints

- Vanilla JS only (this is the point — you will appreciate React later)
- Push to a public Git repository; a live demo URL (GitHub Pages etc.) is a plus

## Hints

Write a single \`render(processes)\` function and call it after every state
change. That discipline — state in, DOM out — is the mental model every
frontend framework builds on.`,
    rubric: [
      {
        title: 'Functionality',
        description: 'Filter, sort, and kill all work together correctly.',
        maxPoints: 10,
      },
      {
        title: 'State-driven rendering',
        description: 'One source of truth; the DOM is derived from state, not patched ad hoc.',
        maxPoints: 5,
      },
      {
        title: 'Code organization',
        description: 'Clear separation of data, rendering, and event handling.',
        maxPoints: 5,
      },
    ],
  },
];
