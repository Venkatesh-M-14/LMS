import type { ContentBlockInput } from '@academy/shared';

/**
 * Deeply-authored lessons for the first two topics. Every lesson seeds as a
 * published v1 (authored by the instructor, reviewed by the admin) so the
 * student experience is real on first boot.
 */

export interface LessonSeed {
  topicSlug: string;
  slug: string;
  title: string;
  estimatedMinutes: number;
  skillSlugs: string[];
  blocks: ContentBlockInput[];
}

export const LESSONS_SEED: LessonSeed[] = [
  // ── Topic 1: Computer Science Fundamentals ────────────────────────────────
  {
    topicSlug: 'computer-science-fundamentals',
    slug: 'how-a-computer-works',
    title: 'How a Computer Actually Works',
    estimatedMinutes: 15,
    skillSlugs: ['execution-model'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# How a Computer Actually Works

Strip away the case, the screen, and the keyboard, and every computer — from a smartwatch to the machine serving this page — is the same three-part loop:

1. **Memory (RAM)** holds data and instructions as numbers.
2. **The CPU** reads an instruction from memory, executes it, and moves to the next one — billions of times per second.
3. **Input/Output devices** (keyboard, network card, screen) move data between that loop and the outside world.

That's it. There is no magic component that "understands" your program. A computer is a very fast, very obedient instruction-follower.

## The fetch–decode–execute cycle

The CPU runs an endless loop:

- **Fetch** the next instruction from memory (its address lives in a counter register).
- **Decode** it — work out *which* tiny operation it is: add two numbers, copy a value, jump somewhere else.
- **Execute** it and store the result.

Every app you have ever used — games, browsers, this learning platform — reduces to long sequences of these tiny steps.`,
        },
      },
      {
        type: 'CALLOUT',
        payload: {
          variant: 'tip',
          title: 'Why this matters for frontend engineers',
          markdown:
            'When a page "feels slow", a CPU somewhere is executing too many instructions before it can paint the next frame. Performance work — which you will do in a later module — is the art of asking the machine to do less.',
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Memory is one long street of numbered boxes

RAM is best imagined as a single enormous row of boxes, each with an address (0, 1, 2, …) and each holding one **byte** (a number from 0 to 255). Everything — your variables, your photos, the code itself — lives in those boxes.

When JavaScript says:

\`\`\`
let score = 42;
\`\`\`

somewhere, some bytes now hold the value 42, and your program remembers *which address* they live at. Higher-level languages hide the addresses from you, but they never stop existing.

## Programs are data too

Here is the idea that made modern computing possible (the *von Neumann architecture*): **instructions are stored in the same memory as data.** Code is just bytes the CPU has been pointed at. That is why you can download a program like any file — and also why running untrusted code is dangerous: to the machine, code and data are the same stuff.`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'javascript',
          filename: 'cpu-simulator.js',
          caption:
            'A 20-line "CPU" that runs a program of tiny instructions — the real thing differs only in speed and scale.',
          code: `// A toy CPU: memory is an array, the program is data in that memory.
const memory = { a: 0, b: 0 };

const program = [
  { op: 'SET', target: 'a', value: 5 },
  { op: 'SET', target: 'b', value: 7 },
  { op: 'ADD', target: 'a', source: 'b' }, // a = a + b
  { op: 'PRINT', source: 'a' },
];

let counter = 0; // which instruction is next — the "program counter"
while (counter < program.length) {
  const instr = program[counter]; // FETCH
  switch (instr.op) {             // DECODE
    case 'SET':   memory[instr.target] = instr.value; break;          // EXECUTE
    case 'ADD':   memory[instr.target] += memory[instr.source]; break;
    case 'PRINT': console.log(memory[instr.source]); break;           // → 12
  }
  counter++;
}`,
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Check your understanding

Before moving on, you should be able to answer these in your own words:

- What are the three components every computer shares, and what does each do?
- What happens in the fetch–decode–execute cycle?
- Why is "code is data" both powerful and dangerous?

In the next lesson we zoom into those memory boxes and learn the language they speak: **binary**.`,
        },
      },
    ],
  },
  {
    topicSlug: 'computer-science-fundamentals',
    slug: 'bits-bytes-and-binary',
    title: 'Bits, Bytes, and Binary',
    estimatedMinutes: 18,
    skillSlugs: ['data-representation'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# Bits, Bytes, and Binary

A transistor — the physical cell computers are built from — reliably distinguishes exactly two states: current or no current. **On or off. 1 or 0.** One such digit is a **bit**.

One bit can't say much. But bits gang up:

| Group | Name | Distinct values |
| --- | --- | --- |
| 1 bit | bit | 2 |
| 8 bits | byte | 256 |
| 2 bytes | 16-bit | 65,536 |
| 4 bytes | 32-bit | ~4.3 billion |

Every doubling of bits **doubles** the number of representable values. Eight switches per box is enough to give every letter, digit, and symbol its own pattern — which is exactly what happens.

## Counting in base 2

Decimal is base 10: the number 203 means 2×100 + 0×10 + 3×1. Binary is the same game with powers of two. The byte \`1100 1011\` means:

\`\`\`
1×128 + 1×64 + 0×32 + 0×16 + 1×8 + 0×4 + 1×2 + 1×1  =  203
\`\`\`

Same quantity, different notation. Nothing about binary is exotic — it's just counting with two fingers instead of ten.`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'javascript',
          filename: 'binary-playground.js',
          caption: 'JavaScript can show you the binary underneath any number or character.',
          code: `// Numbers ↔ binary
(203).toString(2);        // → "11001011"
parseInt('11001011', 2);  // → 203

// Text is numbers wearing a costume (Unicode code points)
'A'.codePointAt(0);       // → 65
'அ'.codePointAt(0);       // → 2949 (Tamil letter A)
String.fromCodePoint(65); // → "A"

// Colors are three bytes: red, green, blue
// #3F51B5 → 0x3F=63 red, 0x51=81 green, 0xB5=181 blue
parseInt('3F', 16);       // → 63`,
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Everything is an encoding

If memory only stores numbers, how does it hold *this sentence*? Or a photo? Through **encodings** — agreements about what the numbers mean:

- **Text**: Unicode assigns every character a number ("code point"); UTF-8 stores those numbers as 1–4 bytes each.
- **Colors**: one byte each for red, green, and blue intensity. \`#FF0000\` is "red at full, others at zero".
- **Images**: a grid of pixels, each pixel three (or four) bytes.
- **Sound**: thousands of numbers per second, each measuring air pressure at an instant.

The bytes \`72 101 108 108 111\` are the word "Hello" *only because* both sides agreed to read them as UTF-8 text. The same bytes read as image data would be five meaningless pixels. **Data has no meaning without its encoding** — a truth you will meet again in HTTP headers like \`Content-Type\`.`,
        },
      },
      {
        type: 'CALLOUT',
        payload: {
          variant: 'warning',
          title: 'The bug you will definitely meet',
          markdown:
            "Floating-point numbers are also an encoding — one with limited precision. Try `0.1 + 0.2 === 0.3` in a console: it's `false` (the sum is `0.30000000000000004`). Never compare money or fractional values with `===`; work in integer cents or compare against a tiny tolerance.",
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Check your understanding

- Why do computers use base 2 rather than base 10?
- How many distinct values fit in one byte, and why exactly that many?
- The bytes for "Hello" could also be pixels. What decides which one they are?
- Why is \`0.1 + 0.2 === 0.3\` false in JavaScript?

Next: how your human-readable source code becomes instructions the CPU can run.`,
        },
      },
    ],
  },
  {
    topicSlug: 'computer-science-fundamentals',
    slug: 'from-source-code-to-execution',
    title: 'From Source Code to Execution',
    estimatedMinutes: 16,
    skillSlugs: ['execution-model'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# From Source Code to Execution

CPUs execute **machine code** — raw numeric instructions. Nobody wants to write those by hand, so we write in human-friendly languages and translate. There are two classic translation strategies:

## Compilers: translate everything first

A **compiler** reads your whole program and produces machine code *before* anything runs. C, C++, Rust, and Go work this way. You get fast execution and early error detection, at the cost of a build step.

## Interpreters: translate as you go

An **interpreter** reads your source line by line *while* running it. Python (classically) and shell scripts work this way. You get instant feedback and portability — anywhere the interpreter runs, your code runs.

## JavaScript: both at once

Modern JavaScript engines like **V8** (Chrome, Node.js) use a hybrid called **JIT — just-in-time compilation**:

1. Your source is parsed into a tree (the AST), then compiled to **bytecode** — instructions for a pretend CPU.
2. An interpreter starts executing that bytecode immediately — no waiting.
3. The engine watches for **hot** code (a function called thousands of times) and compiles *just those parts* to real machine code, optimized using what it observed about your data.
4. If an assumption breaks (a function that always saw numbers suddenly gets a string), the engine **de-optimizes** back to bytecode and carries on.

You get script-language convenience with near-compiled speed — most of the time.`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'javascript',
          filename: 'hot-function.js',
          caption: 'Consistent shapes let the JIT keep functions on the fast path.',
          code: `// This function will get JIT-compiled: called often, always with numbers.
function total(prices) {
  let sum = 0;
  for (const p of prices) sum += p;
  return sum;
}

total([120, 250, 999]);   // engine notes: "p is always a number"
// ...thousands of calls later, total() runs as optimized machine code.

total([120, '250', 999]); // a string appears → de-optimization.
// Result is the string "120250999" — and the fast path is gone.
// Consistent types aren't just tidy; they are literally faster.`,
        },
      },
      {
        type: 'CALLOUT',
        payload: {
          variant: 'info',
          title: 'Where TypeScript fits',
          markdown:
            'TypeScript is a compiler that outputs JavaScript, not machine code — a *transpiler*. It exists to catch the "suddenly a string" class of bug before the code ever reaches an engine. You will spend a whole topic on it later in this path.',
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## The toolchain you will actually use

A modern frontend project chains several translators before the browser sees a byte:

\`\`\`
Your .tsx files
   → TypeScript compiler (types checked, types erased)
   → Bundler (many files merged, dead code dropped)
   → Minifier (names shortened, whitespace removed)
   → Browser JS engine (parse → bytecode → JIT)
\`\`\`

Each stage exists for a reason you now understand: developers want expressive source; networks want few, small files; engines want code they can optimize.

## Check your understanding

- What trade-off separates compilers from interpreters?
- What does "just-in-time" mean in JIT compilation?
- Why can passing mixed types to a hot function make it slower?
- Why is TypeScript called a transpiler rather than a compiler?`,
        },
      },
    ],
  },
  {
    topicSlug: 'computer-science-fundamentals',
    slug: 'thinking-in-algorithms',
    title: 'Thinking in Algorithms',
    estimatedMinutes: 20,
    skillSlugs: ['algorithmic-thinking'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# Thinking in Algorithms

An **algorithm** is a precise, finite recipe for solving a problem: unambiguous steps, a defined end. "Add the prices, then return the sum" is an algorithm. So is the process you use to find a name in a phone book — and *how* you do it matters enormously.

## Two ways to find a name

**Linear search**: start at page one, check every entry. Works on any list. For a million entries, worst case one million checks.

**Binary search**: open the book at the middle. Your name is alphabetically before or after that page — so half the book is now irrelevant. Repeat. A million entries need at most **20** checks, because each step halves the problem. The catch: the book must be **sorted**.

That difference — a million steps versus twenty — is not about faster computers. It's about a better recipe.

## Talking about cost: Big-O

Engineers describe an algorithm's cost by **how it grows with input size n**, written in Big-O notation:

| Notation | Name | Feel | Example |
| --- | --- | --- | --- |
| O(1) | constant | instant, any size | \`map.get(key)\` |
| O(log n) | logarithmic | barely grows | binary search |
| O(n) | linear | doubles with data | one loop over a list |
| O(n²) | quadratic | 10× data → 100× work | a loop inside a loop |

Big-O deliberately ignores constants and small inputs — it answers one question: *what happens when the data gets big?*`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'javascript',
          filename: 'search.js',
          caption:
            'Both find the answer. At a million elements, one does ~1,000,000 steps, the other ~20.',
          code: `// O(n): check every element
function linearSearch(sorted, target) {
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] === target) return i;
  }
  return -1;
}

// O(log n): halve the search space every step (requires sorted input)
function binarySearch(sorted, target) {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Where frontend engineers meet Big-O

This is not just interview trivia. Real UI slowdowns are usually accidental O(n²):

- **Lookup in a loop.** For each of n orders, \`users.find(...)\` scans m users → O(n×m). Build a \`Map\` once (O(m)), then each lookup is O(1) — total O(n+m).
- **Re-rendering everything** when one item changes, instead of the one row.
- **Filtering a huge list on every keystroke** — often fixed by debouncing (fewer runs) before optimizing the filter itself.

The professional habit: before shipping code that loops over data, ask *"what happens when this list has 10,000 items?"*`,
        },
      },
      {
        type: 'CALLOUT',
        payload: {
          variant: 'warning',
          title: 'Do not optimize in the dark',
          markdown:
            'The opposite failure exists too: contorting simple code to save microseconds that no user will ever feel. The rule of professionals: **write the clear version, measure, and optimize only what measurement proves slow.** Big-O tells you where danger *can* hide; profilers tell you where it actually does.',
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Check your understanding

- Why does binary search require sorted data, and what does it cost to keep data sorted?
- A page maps over 2,000 items and inside calls \`.find()\` over 500 tags. What's the complexity, and how would you fix it?
- Your search box lags at every keystroke. Name two fundamentally different fixes.

**Milestone reached** — you can now reason about what computers do (execute instructions), what they operate on (encoded bytes), and how to compare recipes for doing it (algorithms and Big-O). Next topic: the operating system that manages all of it.`,
        },
      },
    ],
  },

  // ── Topic 2: Operating Systems Basics ─────────────────────────────────────
  {
    topicSlug: 'operating-systems-basics',
    slug: 'processes-and-threads',
    title: 'Processes, Threads, and Why Your Browser Has Both',
    estimatedMinutes: 18,
    skillSlugs: ['processes-threads'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# Processes, Threads, and Why Your Browser Has Both

Your machine runs hundreds of programs "at once" on a handful of CPU cores. The **operating system** (OS) creates that illusion, and its two central characters are processes and threads.

## Processes: programs in their own bubble

A **process** is a running program plus everything it owns: its own private memory, its open files, its permissions. The OS enforces the bubble — one process cannot read another's memory. When a process crashes, only its bubble pops.

## Threads: workers sharing one bubble

A **thread** is an execution lane *inside* a process. A process starts with one thread and may spawn more; all of them share the same memory. Sharing makes threads cheap and communication instant — and it creates the hardest bugs in computing (**race conditions**) when two threads touch the same data at once.

## Scheduling: the illusion of "at once"

A CPU core runs one thread at a time. The OS **scheduler** slices time into milliseconds and rotates runnable threads through the cores, saving and restoring each one's registers as it swaps them (a **context switch**). Thousands of switches per second look exactly like simultaneity.

## Your browser uses all of it

Modern browsers are a *fleet* of processes: one for the UI, one per tab (roughly), one for the GPU. A crashed tab takes only its own process down; a malicious site is trapped inside its sandboxed bubble. Inside each tab's process live several threads — and one of them is special: the **main thread**, where your JavaScript, layout, and painting all run. Block it and the page freezes: that is why heavy work belongs in a **Web Worker** (another thread), and why understanding this lesson makes you a better frontend engineer.`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'javascript',
          filename: 'main-thread-freeze.js',
          caption:
            'One thread, one queue: while the loop runs, clicks, scrolling, and rendering all wait.',
          code: `// DON'T: run this in a click handler — the whole page freezes for ~2s.
function blockMainThread() {
  const until = Date.now() + 2000;
  while (Date.now() < until) { /* the main thread can do nothing else */ }
}

// DO: hand heavy work to a Web Worker — a separate thread.
// main.js
const worker = new Worker('crunch.js');
worker.postMessage({ numbers: hugeArray });
worker.onmessage = (e) => render(e.data); // main thread stayed responsive

// crunch.js (runs on the worker thread)
onmessage = (e) => {
  const result = e.data.numbers.reduce((a, b) => a + b, 0);
  postMessage(result);
};`,
        },
      },
      {
        type: 'CALLOUT',
        payload: {
          variant: 'info',
          title: 'Why workers communicate by message',
          markdown:
            'Web Workers deliberately do **not** share objects with the page — they pass copies via `postMessage`. That design makes JavaScript race-condition-free by default: no shared mutable state, no locks, none of the classic multithreading bugs. It trades a little copying cost for a huge class of bugs that simply cannot happen.',
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## See it yourself

Open your OS task manager (Activity Monitor on macOS, Task Manager on Windows) and find your browser: you will see many processes, each with a memory column — those are the bubbles. Then open your browser's own task manager (in Chrome: ⋮ → More tools → Task Manager) to see which tab owns which process.

## Check your understanding

- What does a process own that threads within it share?
- Why does one frozen tab no longer freeze the whole browser?
- What is a context switch, and who performs it?
- Why must long computations move off the browser's main thread, and what tool does the web platform give you for that?`,
        },
      },
    ],
  },
  {
    topicSlug: 'operating-systems-basics',
    slug: 'memory-storage-and-file-systems',
    title: 'Memory, Storage, and File Systems',
    estimatedMinutes: 16,
    skillSlugs: ['memory-storage'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# Memory, Storage, and File Systems

Two kinds of "memory" live in your machine, and confusing them confuses everything else:

| | RAM (memory) | Disk (storage) |
| --- | --- | --- |
| Speed | ~100 nanoseconds | ~0.1 milliseconds (SSD) — **1000× slower** |
| Survives power off? | No | Yes |
| Size | 8–32 GB typical | 256 GB–several TB |
| Holds | running programs, open data | files: apps, documents, databases |

When you *open* an app, the OS copies its code from disk into RAM, because the CPU only executes from RAM. When you *save* a document, bytes travel the other way. Slow app start? Disk → RAM copying. Lost unsaved work in a crash? It only existed in RAM.

## The stack and the heap

Inside each process, the OS grants a private address space with two working areas your JavaScript uses constantly:

- **The stack** — small, fast, rigidly ordered. Every function call pushes a frame (its local variables); returning pops it. Infinite recursion overflows it: the literal *stack overflow*.
- **The heap** — large and flexible. Objects, arrays, and closures live here, at any lifetime. JavaScript's **garbage collector** periodically frees heap objects nothing points to anymore — that's why you never call \`free()\` yourself.

A **memory leak** in a web app is almost always a heap object you *meant* to discard but something still references — a forgotten event listener, an ever-growing cache, a closure capturing a huge array.`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'javascript',
          filename: 'leak.js',
          caption: 'The classic frontend leak: a listener that outlives its owner.',
          code: `// LEAK: every call adds a listener that references bigData forever.
function showPanel() {
  const bigData = loadHugeDataset();          // lives on the heap
  window.addEventListener('resize', () => {
    console.log('panel sees', bigData.length); // closure keeps bigData alive
  });
}
// The panel is long gone; the listener (and bigData) are not.

// FIX: remove the listener when the panel goes away.
function showPanelFixed() {
  const bigData = loadHugeDataset();
  const onResize = () => console.log(bigData.length);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize); // cleanup
}
// React's useEffect cleanup return exists for exactly this reason.`,
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## File systems: names for byte ranges

A disk is one gigantic sequence of bytes. The **file system** turns it into something humans can use: named **files** organized in a **tree of directories**, with metadata (size, timestamps, permissions) on each.

\`\`\`
/                     ← root
├── Users/
│   └── you/
│       ├── projects/academy/index.html
│       └── notes.txt
└── tmp/
\`\`\`

A **path** walks that tree: \`/Users/you/notes.txt\` is an *absolute* path (starts at root); \`projects/academy\` is *relative* to wherever you currently are. Web URLs copied this exact idea — \`/assets/logo.svg\` on a server maps to a file tree the same way — which is why paths will feel familiar when you deploy your first site.

## Check your understanding

- Why does unsaved work vanish in a power cut but saved files survive?
- What lives on the stack vs the heap in a JavaScript program?
- Explain, in one sentence each: garbage collection, memory leak, absolute vs relative path.
- Why does React's \`useEffect\` ask you to return a cleanup function?`,
        },
      },
    ],
  },
  {
    topicSlug: 'operating-systems-basics',
    slug: 'meet-the-command-line',
    title: 'Meet the Command Line',
    estimatedMinutes: 20,
    skillSlugs: ['command-line'],
    blocks: [
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `# Meet the Command Line

Every developer tool you will use — Git, Node.js, package managers, deployment scripts — speaks one common language: the **command line**. The window you type it into is a *terminal*; the program interpreting what you type is a *shell* (macOS and Linux default to **zsh** or **bash**).

A command has a simple grammar:

\`\`\`
  command   options      arguments
     ls       -la      src/components
\`\`\`

- **command** — the program to run
- **options/flags** (start with \`-\`) — switches changing its behaviour
- **arguments** — what to operate on

The shell always has a **working directory** — the folder you are "standing in" — and relative paths resolve from there.`,
        },
      },
      {
        type: 'CODE',
        payload: {
          language: 'bash',
          filename: 'survival-kit.sh',
          caption: 'The ten commands that cover 90% of daily development work.',
          code: `pwd                    # where am I? (print working directory)
ls                     # what's here?  (-la: details + hidden files)
cd projects/academy    # move into a folder (cd .. goes up one)

mkdir src              # create a directory
touch notes.md         # create an empty file
cp notes.md backup.md  # copy
mv backup.md docs/     # move (also how you rename)
rm notes.md            # delete — PERMANENT, no recycle bin

cat package.json       # print a file
grep "TODO" -r src     # search text recursively — you'll use this daily`,
        },
      },
      {
        type: 'CALLOUT',
        payload: {
          variant: 'danger',
          title: 'rm has no undo',
          markdown:
            'The command line assumes you mean what you say. `rm` deletes permanently — there is no trash to restore from. Read twice before deleting, be triple-careful with `rm -r` (recursive), and never run a deletion command you copied from the internet without understanding every character of it.',
        },
      },
      {
        type: 'MARKDOWN',
        payload: {
          markdown: `## Composing programs: pipes

The command line's superpower is composition. The \`|\` (pipe) feeds one program's output into the next:

\`\`\`
grep -r "TODO" src | wc -l     # count TODOs in the codebase
ls -la | grep ".json"          # list only JSON files
\`\`\`

Small programs, each doing one thing well, snapped together like LEGO — a design philosophy you will meet again in React components and Unix-style tooling.

## Try it now

1. Open a terminal and run \`pwd\`, then \`ls\`.
2. Create \`mkdir cli-practice && cd cli-practice\`.
3. Create a file: \`touch hello.txt\`, list it with \`ls -la\`.
4. Count files: \`ls | wc -l\`.
5. Clean up: \`cd ..\` then \`rm -r cli-practice\` (you understand every character now).

## Check your understanding

- What's the difference between a terminal and a shell?
- What does the working directory affect?
- What does \`|\` do, and why is it powerful?
- Why is \`rm -r\` worth extra caution?

**Topic complete.** You now know what the OS gives every program — processes, threads, memory, files — and you can drive it from the keyboard. Next in this module: what happens inside the browser itself.`,
        },
      },
    ],
  },
];
