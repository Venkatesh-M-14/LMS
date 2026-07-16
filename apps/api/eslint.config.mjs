import base from '@academy/eslint-config';

export default [
  ...base,
  // The sandbox runner is plain CJS executed directly by node in a child
  // process — require() is the point.
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
];
