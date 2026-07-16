import type { AssessmentItemPayload } from '@academy/shared';

/**
 * Lesson quizzes for the deeply-authored topics. Every lesson gets a mix of
 * auto-graded items plus one reflection (exercising the manual-grading queue).
 */

export interface QuizItemSeed {
  points: number;
  skillSlugs: string[];
  item: AssessmentItemPayload;
}

export interface QuizSeed {
  lessonSlug: string;
  title: string;
  passingScorePct: number;
  items: QuizItemSeed[];
}

export const QUIZZES_SEED: QuizSeed[] = [
  {
    lessonSlug: 'how-a-computer-works',
    title: 'Quiz: How a Computer Works',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['execution-model'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'What does the CPU do in the **fetch** phase of its cycle?',
            options: [
              { id: 'a', text: 'Reads the next instruction from memory' },
              { id: 'b', text: 'Stores a result back to disk' },
              { id: 'c', text: 'Converts the instruction to source code' },
              { id: 'd', text: 'Waits for user input' },
            ],
            correctOptionId: 'a',
            explanation:
              'Fetch reads the next instruction (located by the program counter) from memory; decode works out what it is; execute performs it.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['execution-model'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt: 'Which statements about the von Neumann architecture are true?',
            options: [
              { id: 'a', text: 'Instructions and data live in the same memory' },
              { id: 'b', text: 'Code can be treated as data (e.g. downloaded like a file)' },
              { id: 'c', text: 'The CPU understands JavaScript directly' },
              { id: 'd', text: 'Running untrusted code is dangerous partly because code is data' },
            ],
            correctOptionIds: ['a', 'b', 'd'],
            explanation:
              'Storing programs as data in shared memory is the defining idea — and why code distribution (and code injection) are possible. CPUs only execute machine code, never JavaScript directly.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['execution-model', 'algorithmic-thinking'],
        item: {
          type: 'OUTPUT_PREDICTION',
          payload: {
            prompt: 'Trace the toy CPU program. What single number does it print?',
            language: 'javascript',
            code: `const memory = { a: 0, b: 0 };
const program = [
  { op: 'SET', target: 'a', value: 4 },
  { op: 'SET', target: 'b', value: 6 },
  { op: 'ADD', target: 'a', source: 'b' },
  { op: 'ADD', target: 'a', source: 'b' },
  { op: 'PRINT', source: 'a' },
];
// SET stores value; ADD adds source into target; PRINT logs it.`,
            expectedOutput: '16',
            matchMode: 'trimmed',
            explanation: 'a=4, b=6; after two ADDs a = 4+6+6 = 16.',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['execution-model'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              'In your own words: why does a slow web page ultimately mean "a CPU is doing too much work before it can paint"? Give one example of work you could remove or move elsewhere.',
            guidance:
              'Aim for 3–5 sentences connecting the fetch–decode–execute loop to UI responsiveness.',
            minWords: 30,
          },
        },
      },
    ],
  },
  {
    lessonSlug: 'bits-bytes-and-binary',
    title: 'Quiz: Bits, Bytes, and Binary',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['data-representation'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'How many distinct values can one byte represent, and why?',
            options: [
              { id: 'a', text: '8, because a byte has 8 bits' },
              { id: 'b', text: '256, because 2⁸ combinations of 8 bits exist' },
              { id: 'c', text: '255, because zero does not count' },
              { id: 'd', text: '1024, because computers use base 2' },
            ],
            correctOptionId: 'b',
            explanation: '8 bits, each 0 or 1 → 2×2×…×2 (8 times) = 256 patterns (0–255).',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['data-representation'],
        item: {
          type: 'OUTPUT_PREDICTION',
          payload: {
            prompt: 'What does this expression evaluate to?',
            language: 'javascript',
            code: `parseInt('1100', 2)`,
            expectedOutput: '12',
            matchMode: 'trimmed',
            explanation: '1×8 + 1×4 + 0×2 + 0×1 = 12.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['data-representation'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt: 'Which of these are true about encodings?',
            options: [
              {
                id: 'a',
                text: 'The same bytes can be text, pixels, or sound depending on the encoding',
              },
              { id: 'b', text: 'UTF-8 stores every character in exactly one byte' },
              { id: 'c', text: '#FF0000 encodes "red at full intensity, green and blue at zero"' },
              {
                id: 'd',
                text: '0.1 + 0.2 === 0.3 is false in JavaScript because floats have limited precision',
              },
            ],
            correctOptionIds: ['a', 'c', 'd'],
            explanation:
              'UTF-8 is variable-width: 1–4 bytes per character (Tamil characters take 3).',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['data-representation'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              'A colleague stores product prices as floating-point rupees and compares them with ===. Explain the bug waiting to happen and propose a safer approach.',
            guidance: 'Mention what floats can and cannot represent exactly.',
            minWords: 25,
          },
        },
      },
    ],
  },
  {
    lessonSlug: 'from-source-code-to-execution',
    title: 'Quiz: From Source Code to Execution',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['execution-model'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'What makes modern JavaScript engines "just-in-time" compilers?',
            options: [
              { id: 'a', text: 'They compile the whole program to machine code before running it' },
              {
                id: 'b',
                text: 'They interpret bytecode and compile only hot code paths to machine code at runtime',
              },
              { id: 'c', text: 'They send code to a server for compilation' },
              { id: 'd', text: 'They skip compilation entirely' },
            ],
            correctOptionId: 'b',
            explanation:
              'V8 starts interpreting bytecode immediately and optimizes frequently-run functions using observed type information.',
          },
        },
      },
      {
        points: 2,
        skillSlugs: ['execution-model'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'Why is TypeScript called a *transpiler* rather than a compiler?',
            options: [
              {
                id: 'a',
                text: 'It outputs another high-level language (JavaScript), not machine code',
              },
              { id: 'b', text: 'It does not check types' },
              { id: 'c', text: 'It runs only in the browser' },
              { id: 'd', text: 'It is interpreted line by line' },
            ],
            correctOptionId: 'a',
            explanation: 'Source-to-source: TS in, JS out — the types are checked and then erased.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['execution-model'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt: 'Which of these can cause a JIT de-optimization?',
            options: [
              { id: 'a', text: 'A function that always saw numbers suddenly receives a string' },
              { id: 'b', text: 'Using const instead of let' },
              { id: 'c', text: 'Object shapes changing between calls' },
              { id: 'd', text: 'Adding a code comment' },
            ],
            correctOptionIds: ['a', 'c'],
            explanation:
              'Optimized code is compiled against type/shape assumptions; breaking them forces a fall back to bytecode.',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['execution-model'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              'Your team ships .tsx source through TypeScript, a bundler, and a minifier before the browser runs it. Explain what each stage is for, in one sentence each.',
            minWords: 25,
          },
        },
      },
    ],
  },
  {
    lessonSlug: 'thinking-in-algorithms',
    title: 'Quiz: Thinking in Algorithms',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['algorithmic-thinking'],
        item: {
          type: 'MCQ',
          payload: {
            prompt:
              'Searching a **sorted** array of one million items with binary search needs at most about…',
            options: [
              { id: 'a', text: '20 comparisons' },
              { id: 'b', text: '1,000 comparisons' },
              { id: 'c', text: '500,000 comparisons' },
              { id: 'd', text: '1,000,000 comparisons' },
            ],
            correctOptionId: 'a',
            explanation: 'Each step halves the space: 2²⁰ ≈ 1,048,576, so ~20 halvings suffice.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['algorithmic-thinking'],
        item: {
          type: 'OUTPUT_PREDICTION',
          payload: {
            prompt: 'What index does this binary search return?',
            language: 'javascript',
            code: `function binarySearch(sorted, target) {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
console.log(binarySearch([2, 5, 8, 12, 16, 23, 38], 23));`,
            expectedOutput: '5',
            matchMode: 'trimmed',
            explanation: 'mid=3 (12) → right half; mid=5 (23) → found at index 5.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['algorithmic-thinking'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt:
              'A page loops over 2,000 orders and inside calls users.find() over 500 users. Which statements are correct?',
            options: [
              { id: 'a', text: 'The total work is roughly O(n×m) — about a million operations' },
              { id: 'b', text: 'Building a Map of users first reduces it to roughly O(n+m)' },
              { id: 'c', text: 'Big-O says this is fine because constants are ignored' },
              { id: 'd', text: 'The fix costs O(m) once and makes each lookup O(1)' },
            ],
            correctOptionIds: ['a', 'b', 'd'],
            explanation:
              'Lookup-in-a-loop is the classic accidental quadratic; a Map turns it linear.',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['algorithmic-thinking'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              '"Write the clear version, measure, and optimize only what measurement proves slow." Describe a situation where ignoring this rule (optimizing blindly) would hurt a codebase.',
            minWords: 30,
          },
        },
      },
    ],
  },
  {
    lessonSlug: 'processes-and-threads',
    title: 'Quiz: Processes & Threads',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['processes-threads'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'Why does one crashed browser tab usually not take down the whole browser?',
            options: [
              { id: 'a', text: 'Each tab runs (roughly) in its own process with isolated memory' },
              { id: 'b', text: 'Tabs are saved to disk continuously' },
              { id: 'c', text: 'The browser restarts instantly' },
              { id: 'd', text: 'JavaScript cannot crash' },
            ],
            correctOptionId: 'a',
            explanation: 'Process isolation: when a tab process dies, only its bubble pops.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['processes-threads'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt: 'Which statements about threads are true?',
            options: [
              { id: 'a', text: 'Threads within a process share the same memory' },
              { id: 'b', text: 'Each thread has its own completely private memory space' },
              { id: 'c', text: 'Shared mutable state across threads can cause race conditions' },
              {
                id: 'd',
                text: 'The OS scheduler rotates threads across CPU cores in tiny time slices',
              },
            ],
            correctOptionIds: ['a', 'c', 'd'],
            explanation:
              "Private memory is what separates PROCESSES; threads share their process's memory.",
          },
        },
      },
      {
        points: 2,
        skillSlugs: ['processes-threads'],
        item: {
          type: 'MCQ',
          payload: {
            prompt:
              'Your click handler runs a 2-second computation. What does the user experience, and what is the fix?',
            options: [
              { id: 'a', text: 'Nothing unusual — browsers are multi-threaded' },
              { id: 'b', text: 'The page freezes; move the work into a Web Worker' },
              { id: 'c', text: 'Only scrolling freezes; nothing needed' },
              { id: 'd', text: 'The tab crashes; add try/catch' },
            ],
            correctOptionId: 'b',
            explanation:
              'JavaScript, layout, and paint share the main thread — blocking it freezes everything. Workers run on separate threads.',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['processes-threads'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              'Web Workers pass message copies instead of sharing objects. What entire class of bugs does this design eliminate, and what does it cost?',
            minWords: 25,
          },
        },
      },
    ],
  },
  {
    lessonSlug: 'memory-storage-and-file-systems',
    title: 'Quiz: Memory, Storage & File Systems',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['memory-storage'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'You lose unsaved work in a power cut. Why?',
            options: [
              { id: 'a', text: 'It existed only in RAM, which is volatile' },
              { id: 'b', text: 'The disk erased itself' },
              { id: 'c', text: 'The CPU cache expired' },
              { id: 'd', text: 'The file system corrupted it' },
            ],
            correctOptionId: 'a',
            explanation: 'RAM needs power to hold data; disks persist without it.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['memory-storage'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt: 'Which live on the heap in a JavaScript program?',
            options: [
              { id: 'a', text: 'Objects and arrays' },
              { id: 'b', text: 'Closures capturing variables' },
              { id: 'c', text: "Each function call's frame of local primitives" },
              { id: 'd', text: 'Data kept alive by a forgotten event listener' },
            ],
            correctOptionIds: ['a', 'b', 'd'],
            explanation:
              'Call frames live on the stack; objects/closures (and leaks!) live on the heap.',
          },
        },
      },
      {
        points: 2,
        skillSlugs: ['memory-storage'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: "Why does React's useEffect ask you to return a cleanup function?",
            options: [
              {
                id: 'a',
                text: 'To remove listeners/subscriptions so closures (and what they capture) can be garbage-collected',
              },
              { id: 'b', text: 'To make the component render faster' },
              { id: 'c', text: "To save the component's state to disk" },
              { id: 'd', text: 'It is only a naming convention' },
            ],
            correctOptionId: 'a',
            explanation: 'Un-removed listeners are the classic frontend memory leak.',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['memory-storage'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              'Explain, to a junior teammate, how a "memory leak" can exist in a garbage-collected language like JavaScript.',
            guidance: 'The GC frees only what nothing references…',
            minWords: 25,
          },
        },
      },
    ],
  },
  {
    lessonSlug: 'meet-the-command-line',
    title: 'Quiz: The Command Line',
    passingScorePct: 65,
    items: [
      {
        points: 2,
        skillSlugs: ['command-line'],
        item: {
          type: 'MCQ',
          payload: {
            prompt: 'In `grep "TODO" -r src`, what is `-r`?',
            options: [
              { id: 'a', text: 'An option/flag changing how grep behaves (recursive)' },
              { id: 'b', text: 'The file to search' },
              { id: 'c', text: 'A pipe' },
              { id: 'd', text: 'An environment variable' },
            ],
            correctOptionId: 'a',
            explanation:
              'command → grep, flag → -r (recurse into directories), arguments → pattern and path.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['command-line'],
        item: {
          type: 'OUTPUT_PREDICTION',
          payload: {
            prompt:
              'A directory contains exactly: app.ts, notes.md, data.json, readme.md. What number does this print?',
            language: 'bash',
            code: `ls | grep ".md" | wc -l`,
            expectedOutput: '2',
            matchMode: 'trimmed',
            explanation:
              'ls lists 4 names → grep keeps notes.md and readme.md → wc -l counts 2 lines.',
          },
        },
      },
      {
        points: 3,
        skillSlugs: ['command-line'],
        item: {
          type: 'MULTI_SELECT',
          payload: {
            prompt: 'Which statements about `rm` are true?',
            options: [
              { id: 'a', text: 'Deletion is permanent — there is no recycle bin' },
              { id: 'b', text: 'rm -r deletes directories recursively' },
              { id: 'c', text: 'Deleted files can be restored with Ctrl+Z' },
              {
                id: 'd',
                text: 'You should understand every character of a deletion command before running it',
              },
            ],
            correctOptionIds: ['a', 'b', 'd'],
            explanation: 'The shell assumes you mean what you say; there is no undo.',
          },
        },
      },
      {
        points: 4,
        skillSlugs: ['command-line'],
        item: {
          type: 'REFLECTION',
          payload: {
            prompt:
              'The pipe (|) composes small programs into bigger tools. Where have you seen (or where do you expect) the same composition idea in frontend engineering?',
            minWords: 20,
          },
        },
      },
    ],
  },
];
