# Project Rules

## Testing Requirements

All code changes (including but not limited to new features, bug fixes, performance optimizations, code refactoring, etc.) must follow these testing rules before submission:

### Mandatory Testing

1. **Run Full Test Suite**: Execute `npm test` before any code submission
2. **All Tests Must Pass**: All unit test cases must pass successfully
3. **Test Coverage**: Maintain minimum test coverage as defined in `jest.config.js`

### Pre-Commit Checklist

- [ ] Run `npm test` and verify all tests pass
- [ ] Check test coverage meets minimum requirements
- [ ] Update or add new tests for modified code
- [ ] Document test results in commit message

### Commit Message Format

Include test results in commit messages:

```
<type>: <description>

Test Results:
- Test Suites: X passed, X total
- Tests: X passed, X total
- Coverage: X%
```

Example:
```
feat: add dynamic provider routing

Test Results:
- Test Suites: 2 passed, 2 total
- Tests: 31 passed, 31 total
- Coverage: 85%
```

### Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch
```

### Code Review Requirements

- Test results must be included in pull request descriptions
- Failed tests must be resolved before merge
- New code requires corresponding test cases
