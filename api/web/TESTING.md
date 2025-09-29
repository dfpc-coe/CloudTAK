# CloudTAK Web Frontend Testing

This document describes the Vitest testing framework setup for the CloudTAK web frontend located in `api/web/`.

## Setup

The testing framework uses:
- **Vitest** as the test runner and framework
- **@vue/test-utils** for Vue component testing utilities
- **jsdom** as the test environment
- **@testing-library/vue** for additional testing utilities
- **happy-dom** as an alternative DOM implementation

### Dependencies

The following testing dependencies have been added to `package.json`:

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@vitest/ui": "^3.2.4", 
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "@testing-library/vue": "^8.1.0",
    "happy-dom": "^15.11.6"
  }
}
```

### Configuration

The Vitest configuration is included in `vite.config.ts`:

```typescript
export default defineConfig({
  // ... other config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@tak-ps/vue-tabler': '/src/test/__mocks__/@tak-ps/vue-tabler.ts',
    },
  },
})
```

### Scripts

Testing scripts have been added to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

## Running Tests

- **Run tests in watch mode**: `npm test`
- **Run tests once**: `npm run test:run`
- **Run tests with UI**: `npm run test:ui`

## Test Structure

### Test Files

Test files are located in `src/test/` and follow the naming convention `*.test.ts`.

### Setup Files

- `src/test/setup.ts` - Global test setup and mocks
- `src/test/__mocks__/@tak-ps/vue-tabler.ts` - Mock implementations for vue-tabler components

### Mocks

The test setup includes mocks for:
- `localStorage` (with both direct property access and setItem/getItem methods)
- `window.location`
- `process.env` (for API_URL)
- `@tak-ps/vue-tabler` components (TablerLoading, TablerInput)
- The `std.ts` utility module

## Login Component Tests

The `Login.test.ts` file provides comprehensive testing for the Login.vue component with 30 test cases covering:

### Component Rendering (6 tests)
- Loading state when brand store is not loaded
- Login form when brand store is loaded
- Custom logo display
- Default logo fallback
- Forgot password link visibility
- Signup link visibility

### Form Input Handling (3 tests)
- Username input updates
- Password input updates
- Input types and placeholders validation

### Login Submission (4 tests)
- API calls with correct parameters for email login
- API calls with correct parameters for username login
- Token storage in localStorage
- Login event emission
- Loading state during login

### Error Handling (3 tests)
- Loading state reset on login failure
- Form data preservation on failure
- Error re-throwing for external handling

### Email Detection (9 tests)
- Email format validation and lowercase conversion
- Username format preservation
- Various email/username combinations

### Brand Store Integration (1 test)
- Brand store initialization on mount

### Navigation After Login (3 tests)
- Redirect URL navigation
- Login page redirect prevention
- Default home navigation

### Key Testing Patterns

1. **Mocking Dependencies**: Router, Pinia store, API calls, and external components are properly mocked
2. **Component Isolation**: Each test creates a fresh component instance with clean state
3. **Async Operations**: Proper handling of async login operations and state updates
4. **Event Testing**: Verification of emitted events and user interactions
5. **State Management**: Testing of reactive state changes and store interactions

### Example Test Structure

```typescript
describe('Component Feature', () => {
  it('should behave correctly', async () => {
    await createWrapper()
    
    // Setup test data
    wrapper!.vm.body.username = 'test@example.com'
    
    // Trigger action
    await wrapper!.vm.createLogin()
    
    // Assert expectations
    expect(mockStd).toHaveBeenCalledWith('/api/login', {
      method: 'POST',
      body: { username: 'test@example.com', password: '' }
    })
  })
})
```

## Best Practices

1. **Use TypeScript**: All test files are written in TypeScript for better type safety
2. **Mock External Dependencies**: Mock all external dependencies to ensure test isolation
3. **Test User Interactions**: Test both programmatic and user-triggered events
4. **Comprehensive Coverage**: Cover success cases, error cases, and edge cases
5. **Clear Test Names**: Use descriptive test names that explain the expected behavior
6. **Setup and Teardown**: Properly initialize and clean up test state

## Extending Tests

To add more tests:

1. Create new test files in `src/test/` with `.test.ts` extension
2. Follow the existing patterns for component mounting and mocking
3. Use the shared setup utilities and mocks where appropriate
4. Add new mocks to the setup files as needed for additional dependencies

## Integration with Build Pipeline

The testing framework integrates with the existing build pipeline:
- Tests run alongside linting and building in CI/CD
- No conflicts with existing Vite configuration
- Compatible with existing ESLint rules and TypeScript configuration
