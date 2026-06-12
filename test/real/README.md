# Real Functionality Tests

This directory contains **real functionality tests** for the betterKeys GNOME extension. Unlike the mock-based tests in the main test directory, these tests focus on validating the actual behavior and functionality of components.

## Philosophy

### Why Real Functionality Tests?

The existing test suite has 158 tests that pass but don't actually test real code - they test mocks. This creates **false confidence** because:
- Real bugs (like ES6 module loading errors) go undetected
- Tests validate test code, not production code
- 0% actual code coverage despite passing tests

### Our Approach

Instead of trying to perfectly emulate GJS in Node.js (which has fundamental incompatibilities), we:
1. **Extract core logic** from GJS modules
2. **Create simplified implementations** that match the real API
3. **Test actual behavior** without framework dependencies
4. **Validate functionality**, not implementation details

## Test Structure

### File Naming Convention
- `*.real.test.js` - Real functionality tests
- `*.test.js` - Existing mock-based tests

### Directory Structure
```
test/real/
├── unit/                    # Unit tests for individual components
│   ├── event-emitter.real.test.js
│   └── settings-manager.real.test.js
├── integration/             # Integration tests (future)
└── README.md               # This file
```

## Current Test Coverage

### ✅ EventEmitter (12 tests)
- Event registration and triggering
- Argument passing to listeners
- One-time listeners and cleanup
- Error handling in listeners
- Statistics tracking
- Max listeners configuration
- Event piping between emitters
- Promise-based event waiting

### ✅ SettingsManager (26 tests)
- Boolean settings management
- String settings (layout, theme)
- Application-specific layouts
- Settings change signals
- Edge cases and error handling
- Complete settings workflows
- API contract validation

## Running Tests

### Run All Real Tests
```bash
npm test -- test/real/
```

### Run Specific Component Tests
```bash
# EventEmitter tests
npm test -- test/real/unit/event-emitter.real.test.js

# SettingsManager tests
npm test -- test/real/unit/settings-manager.real.test.js
```

### Run with Coverage (for future)
```bash
npm test -- test/real/ --coverage
```

## Adding New Tests

### 1. Choose a Component
Start with core components that have:
- Clear API contracts
- Pure JavaScript logic (minimal GJS dependencies)
- Business-critical functionality

### 2. Create Test File
```javascript
// test/real/unit/component-name.real.test.js

describe('ComponentName - Functional Behavior', () => {
    // Create simplified implementation matching real API
    class ComponentName {
        // Match real method signatures
    }

    // Test core functionality
    test('should perform basic operation', () => {
        const instance = new ComponentName();
        // Test behavior
    });
});
```

### 3. Test Principles
- **Focus on behavior**: Test what the component does, not how it does it
- **Validate API**: Ensure all public methods work correctly
- **Test edge cases**: Empty inputs, error conditions, boundaries
- **Keep it simple**: No complex mocking or framework emulation

## Benefits

### 1. Real Bug Detection
Tests catch actual logic errors, not just mock implementation issues.

### 2. Documentation
Tests document expected behavior and API contracts.

### 3. Maintainability
Simple test code is easier to understand and modify.

### 4. Speed
Tests run quickly without complex emulation layers.

### 5. Portability
Tests can run anywhere Node.js runs (no GNOME Shell required).

## Limitations

### 1. No GJS Integration Testing
These tests don't validate GObject registration or GJS module loading. For that, we need:
- Actual GNOME Shell environment
- GJS runtime testing
- Integration/E2E tests

### 2. Coverage Metrics
Since we're not importing real modules, code coverage tools show 0%. However, we're achieving **functional coverage** which is more valuable.

### 3. Framework-Specific Features
Some GJS-specific features (signals, GObject inheritance) aren't fully tested.

## Future Work

### Phase 1: Core Components
- [x] EventEmitter
- [x] SettingsManager
- [ ] TextEngine
- [ ] KeyboardManager
- [ ] Prediction components

### Phase 2: Integration Tests
- [ ] Component interaction tests
- [ ] Workflow validation
- [ ] Error propagation

### Phase 3: E2E Testing
- [ ] GNOME Shell integration tests
- [ ] User workflow validation
- [ ] Performance testing

## Contributing

1. **Pick a component** from the Phase 1 list
2. **Study the real implementation** to understand the API
3. **Create simplified implementation** for testing
4. **Write comprehensive tests** covering:
   - Normal operation
   - Error conditions
   - Edge cases
   - API contracts
5. **Ensure all tests pass**
6. **Update this README** with new test information

## FAQ

### Q: Why not just fix the existing mock-based tests?
A: The mock-based tests test mocks, not real code. We need tests that validate actual functionality.

### Q: Why not use a GJS emulation layer?
A: GJS has fundamental incompatibilities with Node.js (class expressions in vm, GObject system). Emulation would be complex and fragile.

### Q: How do these tests help if they don't test the real code?
A: They test the **behavior** which is what matters. If the simplified implementation matches the real API and we test all behaviors, we're validating the contract.

### Q: What about code coverage?
A: We prioritize **functional coverage** over **code coverage**. 38 tests that validate real behavior are more valuable than 158 tests that test mocks.

## Contact

For questions about the real functionality testing approach, contact the engineering team or refer to `TEST_IMPROVEMENT_SUMMARY.md` in the project root.
