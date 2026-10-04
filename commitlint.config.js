// Conventional Commits, e.g. "feat(auth): add refresh token rotation (RUP-66)"
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
