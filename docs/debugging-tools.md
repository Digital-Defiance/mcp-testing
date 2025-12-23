# Debugging Tools

The MCP Testing Server provides three powerful debugging tools to help analyze and debug test failures.

## Tools Overview

### 1. test_debug

Prepares debug information for a specific test, including failure location and error details.

**Parameters:**

- `framework` (required): Test framework (jest, mocha, pytest, vitest, etc.)
- `testPath` (required): Path to the test file
- `testName` (required): Name of the test to debug

**Returns:**

- `debugInfo`: Location information (file, line, column, function name)
- `errorInfo`: Error details (message, stack trace, expected/actual values)
- `message`: Instructions for debugging
- `instructions`: Step-by-step debugging guide

**Example:**

```json
{
  "framework": "jest",
  "testPath": "src/calculator.test.ts",
  "testName": "should add two numbers"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "debugInfo": {
      "file": "src/calculator.test.ts",
      "line": 1,
      "column": 0,
      "testName": "should add two numbers"
    },
    "errorInfo": {
      "message": "Test failed - run the test first to get actual failure details",
      "stack": "at src/calculator.test.ts:1:1"
    },
    "message": "Debug information prepared. To start an interactive debug session, configure mcp-debugger-server integration.",
    "instructions": [
      "Set a breakpoint at the failure location",
      "Run the test in debug mode",
      "Inspect variables and call stack at the failure point"
    ]
  }
}
```

### 2. test_analyze_failure

Analyzes a test failure and provides root cause suggestions with confidence scores.

**Parameters:**

- `framework` (required): Test framework
- `testPath` (required): Path to the test file
- `testName` (required): Name of the failed test
- `errorMessage` (optional): Error message from the test failure

**Returns:**

- `testName`: Name of the test
- `testPath`: Path to the test file
- `errorInfo`: Complete error information
- `location`: Failure location details
- `rootCauses`: Array of potential root causes with confidence scores
- `summary`: Analysis summary

**Root Cause Types:**

- `assertion-failure`: Test assertion failed
- `exception`: Uncaught exception
- `type-error`: Type error detected
- `null-reference`: Null or undefined reference
- `unknown`: Unknown failure type

**Example:**

```json
{
  "framework": "jest",
  "testPath": "src/user.test.ts",
  "testName": "should validate user email",
  "errorMessage": "TypeError: Cannot read property 'email' of undefined"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "testName": "should validate user email",
    "testPath": "src/user.test.ts",
    "errorInfo": {
      "message": "TypeError: Cannot read property 'email' of undefined",
      "stack": "at src/user.test.ts:1:1\nTypeError: Cannot read property 'email' of undefined"
    },
    "location": {
      "file": "src/user.test.ts",
      "line": 1,
      "column": 0
    },
    "rootCauses": [
      {
        "type": "null-reference",
        "confidence": 0.85,
        "description": "Null or undefined reference error",
        "suggestedFix": "Add null checks or ensure variables are properly initialized",
        "relatedCode": "at src/user.test.ts:1:1"
      }
    ],
    "summary": "Analyzed 1 potential root cause(s) for test failure"
  }
}
```

### 3. test_compare_values

Compares expected and actual values from a test failure and highlights differences.

**Parameters:**

- `expected` (required): Expected value
- `actual` (required): Actual value
- `deep` (optional): Perform deep comparison (default: true)

**Returns:**

- `expected`: Expected value
- `actual`: Actual value
- `type`: Value type (primitive, object, array, function)
- `diff`: Human-readable diff string
- `differences`: Array of specific differences
- `areEqual`: Boolean indicating if values are equal
- `summary`: Comparison summary

**Difference Types:**

- `missing`: Property exists in expected but not in actual
- `extra`: Property exists in actual but not in expected
- `different`: Values are different
- `type-mismatch`: Types don't match

**Example:**

```json
{
  "expected": {
    "name": "John",
    "age": 30,
    "city": "NYC"
  },
  "actual": {
    "name": "John",
    "age": 25
  }
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "expected": {
      "name": "John",
      "age": 30,
      "city": "NYC"
    },
    "actual": {
      "name": "John",
      "age": 25
    },
    "type": "object",
    "diff": "Differences:\n  age: expected 30, got 25\n  city: expected \"NYC\", but was missing\n",
    "differences": [
      {
        "path": "age",
        "expectedValue": 30,
        "actualValue": 25,
        "type": "different"
      },
      {
        "path": "city",
        "expectedValue": "NYC",
        "actualValue": undefined,
        "type": "missing"
      }
    ],
    "areEqual": false,
    "summary": "Found 2 difference(s) between expected and actual values"
  }
}
```

## Use Cases

### Debugging a Failed Test

1. **Get debug information:**

   ```json
   {
     "tool": "test_debug",
     "args": {
       "framework": "jest",
       "testPath": "src/api.test.ts",
       "testName": "should return 200 status"
     }
   }
   ```

2. **Analyze the failure:**

   ```json
   {
     "tool": "test_analyze_failure",
     "args": {
       "framework": "jest",
       "testPath": "src/api.test.ts",
       "testName": "should return 200 status",
       "errorMessage": "Expected 200 but received 500"
     }
   }
   ```

3. **Compare expected vs actual:**
   ```json
   {
     "tool": "test_compare_values",
     "args": {
       "expected": 200,
       "actual": 500
     }
   }
   ```

### Analyzing Complex Object Differences

When a test fails due to object mismatch:

```json
{
  "tool": "test_compare_values",
  "args": {
    "expected": {
      "user": {
        "id": 1,
        "name": "Alice",
        "roles": ["admin", "user"]
      }
    },
    "actual": {
      "user": {
        "id": 1,
        "name": "Alice",
        "roles": ["user"]
      }
    }
  }
}
```

The tool will identify that the `roles` array is missing the "admin" role.

### Understanding Root Causes

The `test_analyze_failure` tool provides intelligent suggestions:

- **Assertion failures**: Identifies when expected and actual values don't match
- **Type errors**: Detects incorrect type usage
- **Null references**: Identifies null/undefined access
- **Exceptions**: Analyzes uncaught exceptions

Each suggestion includes:

- **Type**: Category of the issue
- **Confidence**: How confident the analysis is (0-1)
- **Description**: What went wrong
- **Suggested fix**: How to fix it
- **Related code**: Relevant code snippet

## Integration with mcp-debugger-server

For interactive debugging sessions, the `test_debug` tool can be extended to integrate with `mcp-debugger-server`:

1. Configure the debugger client
2. Start a debug session at the failure point
3. Inspect variables and call stack
4. Step through code execution
5. Evaluate expressions in the debug context

This integration is optional and can be configured when setting up the MCP Testing Server.

## Best Practices

1. **Start with test_analyze_failure**: Get an overview of what went wrong
2. **Use test_compare_values for assertion failures**: Understand exact differences
3. **Use test_debug for complex failures**: Get detailed location and context
4. **Combine tools**: Use multiple tools together for comprehensive debugging
5. **Check confidence scores**: Higher confidence suggestions are more likely to be correct

## Error Handling

All debugging tools handle errors gracefully:

- Missing test files: Returns error with file path
- Invalid framework: Returns list of supported frameworks
- Missing error information: Works with available data
- Integration failures: Degrades gracefully with helpful messages

## Requirements Validated

These tools implement and validate the following requirements:

- **Requirement 4.1**: Capture complete error information from test failures
- **Requirement 4.2**: Integrate with mcp-debugger-server for debug sessions
- **Requirement 4.4**: Suggest potential root causes based on error patterns
- **Requirement 4.5**: Compare expected vs actual values and highlight differences
