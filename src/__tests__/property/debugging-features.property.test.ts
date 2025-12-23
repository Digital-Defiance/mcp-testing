/**
 * Property-based tests for debugging features
 *
 * @packageDocumentation
 */

import fc from 'fast-check';
import {
  DebugIntegration,
  DebuggerOperations,
  DebugSession,
  StackFrame,
} from '../../components/DebugIntegration';
import { TestResult, TestStatus, TestError, TestFramework } from '../../types';

/**
 * Mock debugger operations for testing
 */
class MockDebuggerOperations implements DebuggerOperations {
  private sessions: Map<string, DebugSession> = new Map();
  private sessionCounter = 0;

  async startDebugSession(options: any): Promise<DebugSession> {
    const sessionId = `session-${++this.sessionCounter}`;
    const session: DebugSession = {
      id: sessionId,
      file: options.file,
      line: options.line,
      column: options.column || 0,
      testName: options.testName,
      status: 'active',
      startTime: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  async stopDebugSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
    }
  }

  async getVariableValues(
    sessionId: string,
    variableNames: string[]
  ): Promise<Record<string, unknown>> {
    return {
      testVar: 'test-value',
      counter: 42,
      flag: true,
    };
  }

  async getCallStack(sessionId: string): Promise<StackFrame[]> {
    return [
      {
        file: 'test.ts',
        line: 10,
        column: 5,
        functionName: 'testFunction',
      },
      {
        file: 'main.ts',
        line: 20,
        column: 10,
        functionName: 'main',
      },
    ];
  }

  async evaluateExpression(sessionId: string, expression: string): Promise<unknown> {
    return `result of ${expression}`;
  }

  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }
}

describe('Property-based tests for debugging features', () => {
  describe('Property 15: Test failures capture complete error information', () => {
    it('should capture complete error information for any failed test', () => {
      // **Feature: mcp-testing-server, Property 15: Test failures capture complete error information**
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.option(fc.anything(), { nil: undefined }),
          fc.option(fc.anything(), { nil: undefined }),
          (testName, errorMessage, stackTrace, expected, actual) => {
            const debugIntegration = new DebugIntegration();

            const testResult: TestResult = {
              id: 'test-1',
              name: testName,
              fullName: `suite > ${testName}`,
              status: TestStatus.FAILED,
              duration: 100,
              error: {
                message: errorMessage,
                stack: stackTrace,
                expected,
                actual,
              },
              file: 'test.ts',
              line: 10,
              suite: ['suite'],
              tags: [],
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: [],
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            const capturedError = debugIntegration.captureErrorInformation(testResult);

            // Verify complete error information is captured
            expect(capturedError).not.toBeNull();
            expect(capturedError?.message).toBe(errorMessage);
            expect(capturedError?.stack).toBe(stackTrace);
            expect(capturedError?.expected).toBe(expected);
            expect(capturedError?.actual).toBe(actual);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for tests without errors', () => {
      // **Feature: mcp-testing-server, Property 15: Test failures capture complete error information**
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (testName) => {
          const debugIntegration = new DebugIntegration();

          const testResult: TestResult = {
            id: 'test-1',
            name: testName,
            fullName: `suite > ${testName}`,
            status: TestStatus.PASSED,
            duration: 100,
            file: 'test.ts',
            line: 10,
            suite: ['suite'],
            tags: [],
            metadata: {
              framework: TestFramework.JEST,
              retries: 0,
              flaky: false,
              slow: false,
              tags: [],
              customData: {},
            },
            timestamp: new Date().toISOString(),
          };

          const capturedError = debugIntegration.captureErrorInformation(testResult);

          expect(capturedError).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Debugger integration starts at failure point', () => {
    it('should start debug session at exact failure location for any failed test', async () => {
      // **Feature: mcp-testing-server, Property 16: Debugger integration starts at failure point**
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter(
              (s) => s.trim().length > 0 && !s.includes(':') && !s.includes('(') && !s.includes(')')
            ),
          fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0 && !s.includes(' ')),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 0, max: 100 }),
          async (fileName, testName, lineNumber, columnNumber) => {
            const mockDebugger = new MockDebuggerOperations();
            const debugIntegration = new DebugIntegration(mockDebugger);

            const stackTrace = `at ${testName} (${fileName}:${lineNumber}:${columnNumber})`;

            const testResult: TestResult = {
              id: 'test-1',
              name: testName,
              fullName: `suite > ${testName}`,
              status: TestStatus.FAILED,
              duration: 100,
              error: {
                message: 'Test failed',
                stack: stackTrace,
              },
              file: fileName,
              line: lineNumber,
              suite: ['suite'],
              tags: [],
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: [],
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            const session = await debugIntegration.startDebugSession(testResult);

            // Verify debug session starts at failure location
            expect(session).toBeDefined();
            expect(session.file).toBe(fileName);
            expect(session.line).toBe(lineNumber);
            expect(session.column).toBe(columnNumber);
            expect(session.testName).toBe(testName);
            expect(session.status).toBe('active');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17: Debug sessions provide execution context', () => {
    it('should provide variable values, call stack, and execution context for any active debug session', async () => {
      // **Feature: mcp-testing-server, Property 17: Debug sessions provide execution context**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (fileName, testName) => {
            const mockDebugger = new MockDebuggerOperations();
            const debugIntegration = new DebugIntegration(mockDebugger);

            const testResult: TestResult = {
              id: 'test-1',
              name: testName,
              fullName: `suite > ${testName}`,
              status: TestStatus.FAILED,
              duration: 100,
              error: {
                message: 'Test failed',
                stack: `at ${testName} (${fileName}:10:5)`,
              },
              file: fileName,
              line: 10,
              suite: ['suite'],
              tags: [],
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: [],
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            const session = await debugIntegration.startDebugSession(testResult);
            const context = await debugIntegration.getExecutionContext(session.id);

            // Verify execution context is provided
            expect(context).toBeDefined();
            expect(context.variables).toBeDefined();
            expect(typeof context.variables).toBe('object');
            expect(context.callStack).toBeDefined();
            expect(Array.isArray(context.callStack)).toBe(true);
            expect(context.scope).toBeDefined();
            expect(context.timestamp).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: Root cause suggestions are provided', () => {
    it('should provide root cause suggestions for any test failure', () => {
      // **Feature: mcp-testing-server, Property 18: Root cause suggestions are provided**
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(
            'Expected true to be false',
            'TypeError: Cannot read property of undefined',
            'ReferenceError: variable is not defined',
            'Error: Timeout exceeded',
            'AssertionError: expected 5 to equal 10',
            'Uncaught exception in test'
          ),
          (testName, errorMessage) => {
            const debugIntegration = new DebugIntegration();

            const testResult: TestResult = {
              id: 'test-1',
              name: testName,
              fullName: `suite > ${testName}`,
              status: TestStatus.FAILED,
              duration: 100,
              error: {
                message: errorMessage,
                stack: `at ${testName} (test.ts:10:5)`,
              },
              file: 'test.ts',
              line: 10,
              suite: ['suite'],
              tags: [],
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: [],
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            const suggestions = debugIntegration.analyzeRootCause(testResult);

            // Verify root cause suggestions are provided
            expect(suggestions).toBeDefined();
            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions.length).toBeGreaterThan(0);

            // Verify each suggestion has required properties
            for (const suggestion of suggestions) {
              expect(suggestion.type).toBeDefined();
              expect(suggestion.confidence).toBeGreaterThan(0);
              expect(suggestion.confidence).toBeLessThanOrEqual(1);
              expect(suggestion.description).toBeDefined();
              expect(typeof suggestion.description).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19: Failure comparison highlights differences', () => {
    it('should compare expected and actual values and highlight differences for any value types', () => {
      // **Feature: mcp-testing-server, Property 19: Failure comparison highlights differences**
      fc.assert(
        fc.property(fc.anything(), fc.anything(), (expected, actual) => {
          const debugIntegration = new DebugIntegration();

          const comparison = debugIntegration.compareValues(expected, actual);

          // Verify comparison result
          expect(comparison).toBeDefined();
          expect(comparison.expected).toBe(expected);
          expect(comparison.actual).toBe(actual);
          expect(comparison.type).toBeDefined();
          expect(['primitive', 'object', 'array', 'function']).toContain(comparison.type);
          expect(comparison.diff).toBeDefined();
          expect(typeof comparison.diff).toBe('string');
          expect(Array.isArray(comparison.differences)).toBe(true);

          // If values are different, differences should be found
          if (expected !== actual) {
            // For non-equal values, we should have either differences or a diff string
            expect(comparison.differences.length > 0 || comparison.diff.length > 0).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify differences in objects', () => {
      // **Feature: mcp-testing-server, Property 19: Failure comparison highlights differences**
      fc.assert(
        fc.property(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.integer()),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.integer()),
          (expected, actual) => {
            const debugIntegration = new DebugIntegration();

            const comparison = debugIntegration.compareValues(expected, actual);

            // Verify comparison for objects
            expect(comparison.type).toBe('object');
            expect(Array.isArray(comparison.differences)).toBe(true);

            // Check if differences are correctly identified
            const expectedKeys = Object.keys(expected);
            const actualKeys = Object.keys(actual);

            // If keys are different, differences should be found
            const keysDifferent =
              expectedKeys.length !== actualKeys.length ||
              expectedKeys.some((key) => !actualKeys.includes(key)) ||
              actualKeys.some((key) => !expectedKeys.includes(key));

            // If values are different, differences should be found
            const valuesDifferent = expectedKeys.some((key) => expected[key] !== actual[key]);

            if (keysDifferent || valuesDifferent) {
              expect(comparison.differences.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify differences in arrays', () => {
      // **Feature: mcp-testing-server, Property 19: Failure comparison highlights differences**
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { maxLength: 10 }),
          fc.array(fc.integer(), { maxLength: 10 }),
          (expected, actual) => {
            const debugIntegration = new DebugIntegration();

            const comparison = debugIntegration.compareValues(expected, actual);

            // Verify comparison for arrays
            expect(comparison.type).toBe('array');
            expect(Array.isArray(comparison.differences)).toBe(true);

            // If arrays are different, differences should be found
            const arraysDifferent =
              expected.length !== actual.length || expected.some((val, idx) => val !== actual[idx]);

            if (arraysDifferent) {
              expect(comparison.differences.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
