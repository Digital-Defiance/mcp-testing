/**
 * DebugIntegration component for debugging test failures
 *
 * @packageDocumentation
 */

import { TestResult, TestError } from '../types';

/**
 * Debugger operations interface for integration with mcp-debugger-server
 */
export interface DebuggerOperations {
  startDebugSession(options: DebugSessionOptions): Promise<DebugSession>;
  stopDebugSession(sessionId: string): Promise<void>;
  getVariableValues(sessionId: string, variableNames: string[]): Promise<Record<string, unknown>>;
  getCallStack(sessionId: string): Promise<StackFrame[]>;
  evaluateExpression(sessionId: string, expression: string): Promise<unknown>;
}

/**
 * Default debugger operations (no-op implementation)
 */
class DefaultDebuggerOperations implements DebuggerOperations {
  async startDebugSession(options: DebugSessionOptions): Promise<DebugSession> {
    throw new Error(
      'Debugger operations not configured. Please provide DebuggerOperations implementation.'
    );
  }

  async stopDebugSession(sessionId: string): Promise<void> {
    throw new Error('Debugger operations not configured.');
  }

  async getVariableValues(
    sessionId: string,
    variableNames: string[]
  ): Promise<Record<string, unknown>> {
    throw new Error('Debugger operations not configured.');
  }

  async getCallStack(sessionId: string): Promise<StackFrame[]> {
    throw new Error('Debugger operations not configured.');
  }

  async evaluateExpression(sessionId: string, expression: string): Promise<unknown> {
    throw new Error('Debugger operations not configured.');
  }
}

/**
 * Debug session options
 */
export interface DebugSessionOptions {
  file: string;
  line: number;
  column?: number;
  testName: string;
  breakOnFailure: boolean;
  captureVariables?: string[];
}

/**
 * Debug session information
 */
export interface DebugSession {
  id: string;
  file: string;
  line: number;
  column?: number;
  testName: string;
  status: 'active' | 'paused' | 'stopped';
  startTime: string;
}

/**
 * Stack frame information
 */
export interface StackFrame {
  file: string;
  line: number;
  column: number;
  functionName: string;
  source?: string;
}

/**
 * Failure location details
 */
export interface FailureLocation {
  file: string;
  line: number;
  column: number;
  functionName?: string;
  source?: string;
}

/**
 * Execution context at failure point
 */
export interface ExecutionContext {
  variables: Record<string, unknown>;
  callStack: StackFrame[];
  scope: 'local' | 'closure' | 'global';
  timestamp: string;
}

/**
 * Root cause suggestion
 */
export interface RootCauseSuggestion {
  type: 'assertion-failure' | 'exception' | 'timeout' | 'type-error' | 'null-reference' | 'unknown';
  confidence: number;
  description: string;
  suggestedFix?: string;
  relatedCode?: string;
}

/**
 * Value comparison result
 */
export interface ValueComparison {
  expected: unknown;
  actual: unknown;
  diff: string;
  type: 'primitive' | 'object' | 'array' | 'function';
  differences: Difference[];
}

/**
 * Difference between expected and actual values
 */
export interface Difference {
  path: string;
  expectedValue: unknown;
  actualValue: unknown;
  type: 'missing' | 'extra' | 'different' | 'type-mismatch';
}

/**
 * DebugIntegration class for debugging test failures
 */
export class DebugIntegration {
  private debuggerOps: DebuggerOperations;
  private activeSessions: Map<string, DebugSession>;

  constructor(debuggerOps?: DebuggerOperations) {
    this.debuggerOps = debuggerOps || new DefaultDebuggerOperations();
    this.activeSessions = new Map();
  }

  /**
   * Capture complete error information from test failure
   */
  captureErrorInformation(testResult: TestResult): TestError | null {
    if (!testResult.error) {
      return null;
    }

    // Extract complete error information
    const error: TestError = {
      message: testResult.error.message || 'Unknown error',
      stack: testResult.error.stack || '',
      expected: testResult.error.expected,
      actual: testResult.error.actual,
      diff: testResult.error.diff,
      code: testResult.error.code,
    };

    return error;
  }

  /**
   * Extract failure location from test result
   */
  extractFailureLocation(testResult: TestResult): FailureLocation {
    // Start with default location from test result
    const location: FailureLocation = {
      file: testResult.file,
      line: testResult.line,
      column: 0,
    };

    // Try to extract more precise location from stack trace
    if (testResult.error?.stack) {
      const stackLocation = this.parseStackTrace(testResult.error.stack);
      if (stackLocation && stackLocation.line > 0) {
        // Only use stack location if it has valid data
        location.file = stackLocation.file;
        location.line = stackLocation.line;
        location.column = stackLocation.column;
        location.functionName = stackLocation.functionName;
        location.source = stackLocation.source;
      }
    }

    return location;
  }

  /**
   * Start debug session at failure point
   */
  async startDebugSession(testResult: TestResult): Promise<DebugSession> {
    const location = this.extractFailureLocation(testResult);

    const options: DebugSessionOptions = {
      file: location.file,
      line: location.line,
      column: location.column,
      testName: testResult.name,
      breakOnFailure: true,
      captureVariables: this.extractVariableNames(testResult),
    };

    const session = await this.debuggerOps.startDebugSession(options);
    this.activeSessions.set(session.id, session);

    return session;
  }

  /**
   * Stop debug session
   */
  async stopDebugSession(sessionId: string): Promise<void> {
    await this.debuggerOps.stopDebugSession(sessionId);
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get execution context at failure point
   */
  async getExecutionContext(sessionId: string): Promise<ExecutionContext> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session ${sessionId} not found`);
    }

    // Get variable values
    const variables = await this.debuggerOps.getVariableValues(sessionId, []);

    // Get call stack
    const callStack = await this.debuggerOps.getCallStack(sessionId);

    return {
      variables,
      callStack,
      scope: 'local',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze root cause of test failure
   */
  analyzeRootCause(testResult: TestResult): RootCauseSuggestion[] {
    const suggestions: RootCauseSuggestion[] = [];

    if (!testResult.error) {
      return suggestions;
    }

    const error = testResult.error;

    // Analyze assertion failures
    if (this.isAssertionFailure(error)) {
      suggestions.push({
        type: 'assertion-failure',
        confidence: 0.9,
        description: 'Test assertion failed - expected and actual values do not match',
        suggestedFix: 'Review the expected value and ensure the code produces the correct output',
        relatedCode: this.extractRelevantCode(error.stack),
      });
    }

    // Analyze exceptions
    if (this.isException(error)) {
      suggestions.push({
        type: 'exception',
        confidence: 0.85,
        description: `Uncaught exception: ${error.message}`,
        suggestedFix: 'Add error handling or fix the code that throws the exception',
        relatedCode: this.extractRelevantCode(error.stack),
      });
    }

    // Analyze type errors
    if (this.isTypeError(error)) {
      suggestions.push({
        type: 'type-error',
        confidence: 0.8,
        description: 'Type error detected - incorrect type usage',
        suggestedFix: 'Check variable types and ensure correct type conversions',
        relatedCode: this.extractRelevantCode(error.stack),
      });
    }

    // Analyze null/undefined references
    if (this.isNullReference(error)) {
      suggestions.push({
        type: 'null-reference',
        confidence: 0.85,
        description: 'Null or undefined reference error',
        suggestedFix: 'Add null checks or ensure variables are properly initialized',
        relatedCode: this.extractRelevantCode(error.stack),
      });
    }

    // If no specific pattern matched, provide generic suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'unknown',
        confidence: 0.5,
        description: `Test failed with error: ${error.message}`,
        suggestedFix: 'Review the error message and stack trace for more details',
        relatedCode: this.extractRelevantCode(error.stack),
      });
    }

    return suggestions;
  }

  /**
   * Compare expected and actual values
   */
  compareValues(expected: unknown, actual: unknown): ValueComparison {
    const type = this.determineValueType(expected, actual);
    const differences = this.findDifferences(expected, actual);
    const diff = this.generateDiffString(expected, actual, differences);

    return {
      expected,
      actual,
      diff,
      type,
      differences,
    };
  }

  /**
   * Parse stack trace to extract location information
   */
  private parseStackTrace(stack: string): FailureLocation | null {
    // Match common stack trace formats
    // Example: "at functionName (file.ts:10:5)"
    // Example: "at file.ts:10:5"
    const patterns = [
      /at\s+(\S+)\s+\(([^():]+):(\d+):(\d+)\)/, // with function name - more strict
      /at\s+([^:\s]+):(\d+):(\d+)/, // without function name - more strict
    ];

    const lines = stack.split('\n');
    for (const stackLine of lines) {
      for (const pattern of patterns) {
        const match = stackLine.match(pattern);
        if (match) {
          if (match.length === 5) {
            // Format with function name: at functionName (file:line:col)
            const file = match[2]; // Don't trim - preserve exact file path
            const lineNum = parseInt(match[3], 10);
            const column = parseInt(match[4], 10);

            // Validate parsed values - file must not be empty
            if (file.length > 0 && lineNum > 0 && column >= 0) {
              return {
                file,
                line: lineNum,
                column,
                functionName: match[1].trim(),
                source: stackLine.trim(),
              };
            }
          } else if (match.length === 4) {
            // Format without function name: at file:line:col
            const file = match[1]; // Don't trim - preserve exact file path
            const lineNum = parseInt(match[2], 10);
            const column = parseInt(match[3], 10);

            // Validate parsed values - file must not be empty
            if (file.length > 0 && lineNum > 0 && column >= 0) {
              return {
                file,
                line: lineNum,
                column,
                source: stackLine.trim(),
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract variable names from test result
   */
  private extractVariableNames(testResult: TestResult): string[] {
    const variables: string[] = [];

    // Extract from error message
    if (testResult.error?.message) {
      const varPattern = /\b([a-z_][a-z0-9_]*)\b/gi;
      const matches = testResult.error.message.match(varPattern);
      if (matches) {
        variables.push(...matches);
      }
    }

    // Remove duplicates
    return Array.from(new Set(variables));
  }

  /**
   * Check if error is an assertion failure
   */
  private isAssertionFailure(error: TestError): boolean {
    const assertionKeywords = ['expect', 'assert', 'should', 'toBe', 'toEqual', 'toMatch'];
    const message = error.message.toLowerCase();
    return assertionKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Check if error is an exception
   */
  private isException(error: TestError): boolean {
    const exceptionKeywords = ['error', 'exception', 'throw', 'thrown'];
    const message = error.message.toLowerCase();
    return exceptionKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Check if error is a type error
   */
  private isTypeError(error: TestError): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('type') ||
      message.includes('is not a function') ||
      message.includes('is not defined')
    );
  }

  /**
   * Check if error is a null reference
   */
  private isNullReference(error: TestError): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('null') ||
      message.includes('undefined') ||
      message.includes('cannot read property') ||
      message.includes('cannot read properties')
    );
  }

  /**
   * Extract relevant code from stack trace
   */
  private extractRelevantCode(stack?: string): string | undefined {
    if (!stack) {
      return undefined;
    }

    // Get the first few lines of the stack trace
    const lines = stack.split('\n').slice(0, 3);
    return lines.join('\n');
  }

  /**
   * Determine value type
   */
  private determineValueType(
    expected: unknown,
    actual: unknown
  ): 'primitive' | 'object' | 'array' | 'function' {
    if (Array.isArray(expected) || Array.isArray(actual)) {
      return 'array';
    }

    if (typeof expected === 'function' || typeof actual === 'function') {
      return 'function';
    }

    if (typeof expected === 'object' || typeof actual === 'object') {
      return 'object';
    }

    return 'primitive';
  }

  /**
   * Find differences between expected and actual values
   */
  private findDifferences(expected: unknown, actual: unknown, path = ''): Difference[] {
    const differences: Difference[] = [];

    // Handle null/undefined
    if (expected === null || expected === undefined || actual === null || actual === undefined) {
      if (expected !== actual) {
        differences.push({
          path: path || 'root',
          expectedValue: expected,
          actualValue: actual,
          type: 'different',
        });
      }
      return differences;
    }

    // Handle primitives
    if (typeof expected !== 'object' || typeof actual !== 'object') {
      if (expected !== actual) {
        differences.push({
          path: path || 'root',
          expectedValue: expected,
          actualValue: actual,
          type: typeof expected !== typeof actual ? 'type-mismatch' : 'different',
        });
      }
      return differences;
    }

    // Handle arrays
    if (Array.isArray(expected) && Array.isArray(actual)) {
      const maxLength = Math.max(expected.length, actual.length);
      for (let i = 0; i < maxLength; i++) {
        const currentPath = `${path}[${i}]`;
        if (i >= expected.length) {
          differences.push({
            path: currentPath,
            expectedValue: undefined,
            actualValue: actual[i],
            type: 'extra',
          });
        } else if (i >= actual.length) {
          differences.push({
            path: currentPath,
            expectedValue: expected[i],
            actualValue: undefined,
            type: 'missing',
          });
        } else {
          differences.push(...this.findDifferences(expected[i], actual[i], currentPath));
        }
      }
      return differences;
    }

    // Handle objects
    const expectedKeys = Object.keys(expected as object);
    const actualKeys = Object.keys(actual as object);
    const allKeys = new Set([...expectedKeys, ...actualKeys]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const expectedValue = (expected as Record<string, unknown>)[key];
      const actualValue = (actual as Record<string, unknown>)[key];

      if (!(key in (expected as object))) {
        differences.push({
          path: currentPath,
          expectedValue: undefined,
          actualValue,
          type: 'extra',
        });
      } else if (!(key in (actual as object))) {
        differences.push({
          path: currentPath,
          expectedValue,
          actualValue: undefined,
          type: 'missing',
        });
      } else {
        differences.push(...this.findDifferences(expectedValue, actualValue, currentPath));
      }
    }

    return differences;
  }

  /**
   * Generate diff string
   */
  private generateDiffString(
    expected: unknown,
    actual: unknown,
    differences: Difference[]
  ): string {
    if (differences.length === 0) {
      return 'No differences found';
    }

    let diff = 'Differences:\n';
    for (const difference of differences) {
      diff += `  ${difference.path}: `;
      if (difference.type === 'missing') {
        diff += `expected ${JSON.stringify(difference.expectedValue)}, but was missing\n`;
      } else if (difference.type === 'extra') {
        diff += `unexpected value ${JSON.stringify(difference.actualValue)}\n`;
      } else if (difference.type === 'type-mismatch') {
        diff += `type mismatch - expected ${typeof difference.expectedValue}, got ${typeof difference.actualValue}\n`;
      } else {
        diff += `expected ${JSON.stringify(difference.expectedValue)}, got ${JSON.stringify(difference.actualValue)}\n`;
      }
    }

    return diff;
  }

  /**
   * Get all active debug sessions
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get debug session by ID
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.activeSessions.get(sessionId);
  }
}
