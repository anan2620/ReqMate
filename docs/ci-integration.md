# ReqMate CI Integration

Run your ReqMate API tests in CI/CD pipelines.

## GitHub Actions

### Using the Reusable Workflow

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    uses: anan2620/ReqMate/.github/workflows/reqmate-action.yml@main
    with:
      collection: ./my-api-collection
      environment: staging
      reporter: junit
```

### Manual Setup

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install ReqMate CLI
        run: npm install -g @reqmate/cli

      - name: Run tests
        run: reqmate run ./my-collection --env production --reporter json

      - name: Run with JUnit output
        run: reqmate run ./my-collection --reporter junit > results.xml

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: results.xml
```

## GitLab CI

```yaml
# .gitlab-ci.yml
api-tests:
  image: node:20
  script:
    - npm install -g @reqmate/cli
    - reqmate run ./my-collection --env staging --reporter junit > results.xml
  artifacts:
    reports:
      junit: results.xml
```

## CLI Reference

```bash
# Run all requests in a collection
reqmate run <collection-path>

# With environment
reqmate run <collection-path> --env <name>

# With data file for data-driven testing
reqmate run <collection-path> --data data.csv

# Multiple iterations
reqmate run <collection-path> --iterations 5

# Output formats
reqmate run <collection-path> --reporter json
reqmate run <collection-path> --reporter junit
reqmate run <collection-path> --reporter html
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | Some tests failed |
| 2 | Collection not found |
| 3 | Invalid configuration |
| 4 | Network error |
