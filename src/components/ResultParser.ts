/**
 * ResultParser component
 *
 * Parses test results from different test frameworks and normalizes them
 * to a common format. Supports Jest, Mocha, Pytest, and Vitest output formats.
 *
 * @packageDocumentation
 */

import { TestFramework, TestResult, TestStatus, TestError, TestMetadata } from '../types';

/**
 * Test execution status
 */
export interface TestExecutionStatus {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  startTime: string;
  endTime?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
}

/**
 * ResultParser class
 *
 * Parses and normalizes test results from different frameworks
 */
export class ResultParser {
  /**
   * Parse test output from a framework
   *
   * @param output - Raw test output
   * @param framework - Test framework
   * @returns Array of parsed test results
   */
  parseResults(output: string, framework: TestFramework): TestResult[] {
    switch (framework) {
      case TestFramework.JEST:
        return this.parseJestResults(output);
      case TestFramework.MOCHA:
        return this.parseMochaResults(output);
      case TestFramework.PYTEST:
        return this.parsePytestResults(output);
      case TestFramework.VITEST:
        return this.parseVitestResults(output);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Parse streaming test results
   *
   * @param stream - Readable stream of test output
   * @returns Async iterator of test results
   */
  async *parseStreamingResults(stream: ReadableStream): AsyncIterator<TestResult> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Split by newlines and process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // Try to parse as JSON (for structured output)
          try {
            const result = JSON.parse(line) as TestResult;
            yield result;
          } catch {
            // Not JSON, skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Extract error details from a test result
   *
   * @param testResult - Test result
   * @returns Test error details
   */
  extractError(testResult: TestResult): TestError {
    if (!testResult.error) {
      throw new Error('Test result does not contain an error');
    }

    return testResult.error;
  }

  /**
   * Parse test metadata from output
   *
   * @param output - Raw test output
   * @returns Test metadata
   */
  parseMetadata(output: string): TestMetadata {
    // Extract metadata from output
    // This is a simplified implementation
    return {
      framework: TestFramework.JEST, // Default
      retries: 0,
      flaky: false,
      slow: false,
      tags: [],
      customData: {},
    };
  }

  /**
   * Parse Jest test results
   *
   * @param output - Jest output
   * @returns Array of test results
   */
  private parseJestResults(output: string): TestResult[] {
    const results: TestResult[] = [];

    // Try to parse as JSON first (Jest can output JSON with --json flag)
    try {
      const jsonOutput = JSON.parse(output);
      if (jsonOutput.testResults) {
        return this.parseJestJsonResults(jsonOutput);
      }
    } catch {
      // Not JSON, parse as text
    }

    // Parse text output
    const lines = output.split('\n');
    let currentSuite: string[] = [];
    let currentFile = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect test file
      const fileMatch = line.match(/PASS|FAIL\s+(.+\.(?:test|spec)\.[jt]sx?)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      // Detect test suite
      const suiteMatch = line.match(/^\s+([✓✗×])\s+(.+)/);
      if (suiteMatch) {
        const [, status, name] = suiteMatch;
        const testStatus = status === '✓' ? TestStatus.PASSED : TestStatus.FAILED;

        results.push({
          id: `${currentFile}:${name}`,
          name,
          fullName: [...currentSuite, name].join(' > '),
          status: testStatus,
          duration: 0,
          file: currentFile,
          line: 0,
          suite: currentSuite,
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
        });
      }
    }

    return results;
  }

  /**
   * Parse Jest JSON results
   *
   * @param jsonOutput - Jest JSON output
   * @returns Array of test results
   */
  private parseJestJsonResults(jsonOutput: any): TestResult[] {
    const results: TestResult[] = [];

    for (const testFile of jsonOutput.testResults || []) {
      const file = testFile.name || '';

      for (const assertionResult of testFile.assertionResults || []) {
        const status = this.mapJestStatus(assertionResult.status);
        const error = assertionResult.failureMessages?.length
          ? this.parseJestError(assertionResult.failureMessages[0])
          : undefined;

        results.push({
          id: `${file}:${assertionResult.fullName}`,
          name: assertionResult.title,
          fullName: assertionResult.fullName,
          status,
          duration: assertionResult.duration || 0,
          error,
          file,
          line: assertionResult.location?.line || 0,
          suite: assertionResult.ancestorTitles || [],
          tags: [],
          metadata: {
            framework: TestFramework.JEST,
            retries: 0,
            flaky: false,
            slow: (assertionResult.duration || 0) > 5000,
            tags: [],
            customData: {},
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Map Jest status to TestStatus
   *
   * @param jestStatus - Jest status string
   * @returns TestStatus
   */
  private mapJestStatus(jestStatus: string): TestStatus {
    switch (jestStatus) {
      case 'passed':
        return TestStatus.PASSED;
      case 'failed':
        return TestStatus.FAILED;
      case 'skipped':
      case 'pending':
        return TestStatus.SKIPPED;
      default:
        return TestStatus.PENDING;
    }
  }

  /**
   * Parse Jest error message
   *
   * @param errorMessage - Jest error message
   * @returns TestError
   */
  private parseJestError(errorMessage: string): TestError {
    const lines = errorMessage.split('\n');
    const message = lines[0] || '';
    const stack = errorMessage;

    // Try to extract expected/actual values
    const expectedMatch = errorMessage.match(/Expected:\s*(.+)/);
    const actualMatch = errorMessage.match(/Received:\s*(.+)/);

    return {
      message,
      stack,
      expected: expectedMatch ? expectedMatch[1] : undefined,
      actual: actualMatch ? actualMatch[1] : undefined,
    };
  }

  /**
   * Parse Mocha test results
   *
   * @param output - Mocha output
   * @returns Array of test results
   */
  private parseMochaResults(output: string): TestResult[] {
    const results: TestResult[] = [];

    // Try to parse as JSON first (Mocha can output JSON with --reporter json)
    try {
      const jsonOutput = JSON.parse(output);
      if (jsonOutput.tests) {
        return this.parseMochaJsonResults(jsonOutput);
      }
    } catch {
      // Not JSON, parse as text
    }

    // Parse text output
    const lines = output.split('\n');
    let currentSuite: string[] = [];

    for (const line of lines) {
      // Detect passing test
      const passMatch = line.match(/^\s+✓\s+(.+)\s+\((\d+)ms\)/);
      if (passMatch) {
        const [, name, duration] = passMatch;
        results.push(
          this.createMochaResult(name, TestStatus.PASSED, parseInt(duration), currentSuite)
        );
        continue;
      }

      // Detect failing test
      const failMatch = line.match(/^\s+\d+\)\s+(.+)/);
      if (failMatch) {
        const [, name] = failMatch;
        results.push(this.createMochaResult(name, TestStatus.FAILED, 0, currentSuite));
        continue;
      }

      // Detect skipped test
      const skipMatch = line.match(/^\s+-\s+(.+)/);
      if (skipMatch) {
        const [, name] = skipMatch;
        results.push(this.createMochaResult(name, TestStatus.SKIPPED, 0, currentSuite));
        continue;
      }
    }

    return results;
  }

  /**
   * Parse Mocha JSON results
   *
   * @param jsonOutput - Mocha JSON output
   * @returns Array of test results
   */
  private parseMochaJsonResults(jsonOutput: any): TestResult[] {
    const results: TestResult[] = [];

    for (const test of jsonOutput.tests || []) {
      const status = test.pass
        ? TestStatus.PASSED
        : test.fail
          ? TestStatus.FAILED
          : TestStatus.SKIPPED;
      const error = test.err ? this.parseMochaError(test.err) : undefined;

      results.push({
        id: test.fullTitle || test.title,
        name: test.title,
        fullName: test.fullTitle,
        status,
        duration: test.duration || 0,
        error,
        file: test.file || '',
        line: 0,
        suite: [],
        tags: [],
        metadata: {
          framework: TestFramework.MOCHA,
          retries: 0,
          flaky: false,
          slow: test.slow || false,
          tags: [],
          customData: {},
        },
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Create a Mocha test result
   *
   * @param name - Test name
   * @param status - Test status
   * @param duration - Test duration
   * @param suite - Test suite
   * @returns TestResult
   */
  private createMochaResult(
    name: string,
    status: TestStatus,
    duration: number,
    suite: string[]
  ): TestResult {
    return {
      id: name,
      name,
      fullName: [...suite, name].join(' > '),
      status,
      duration,
      file: '',
      line: 0,
      suite,
      tags: [],
      metadata: {
        framework: TestFramework.MOCHA,
        retries: 0,
        flaky: false,
        slow: duration > 2000,
        tags: [],
        customData: {},
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse Mocha error
   *
   * @param err - Mocha error object
   * @returns TestError
   */
  private parseMochaError(err: any): TestError {
    return {
      message: err.message || '',
      stack: err.stack || '',
      expected: err.expected,
      actual: err.actual,
    };
  }

  /**
   * Parse Pytest test results
   *
   * @param output - Pytest output
   * @returns Array of test results
   */
  private parsePytestResults(output: string): TestResult[] {
    const results: TestResult[] = [];

    // Try to parse as JSON first (Pytest can output JSON with --json-report)
    try {
      const jsonOutput = JSON.parse(output);
      if (jsonOutput.tests) {
        return this.parsePytestJsonResults(jsonOutput);
      }
    } catch {
      // Not JSON, parse as text
    }

    // Parse text output
    const lines = output.split('\n');

    for (const line of lines) {
      // Detect test result
      const testMatch = line.match(/^(.+\.py)::(.+)\s+(PASSED|FAILED|SKIPPED)/);
      if (testMatch) {
        const [, file, name, statusStr] = testMatch;
        const status = this.mapPytestStatus(statusStr);

        results.push({
          id: `${file}::${name}`,
          name,
          fullName: `${file}::${name}`,
          status,
          duration: 0,
          file,
          line: 0,
          suite: [],
          tags: [],
          metadata: {
            framework: TestFramework.PYTEST,
            retries: 0,
            flaky: false,
            slow: false,
            tags: [],
            customData: {},
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Parse Pytest JSON results
   *
   * @param jsonOutput - Pytest JSON output
   * @returns Array of test results
   */
  private parsePytestJsonResults(jsonOutput: any): TestResult[] {
    const results: TestResult[] = [];

    for (const test of jsonOutput.tests || []) {
      const status = this.mapPytestStatus(test.outcome);
      const error = test.call?.longrepr ? this.parsePytestError(test.call.longrepr) : undefined;

      results.push({
        id: test.nodeid,
        name: test.name,
        fullName: test.nodeid,
        status,
        duration: test.call?.duration || 0,
        error,
        file: test.file || '',
        line: test.lineno || 0,
        suite: [],
        tags: test.markers || [],
        metadata: {
          framework: TestFramework.PYTEST,
          retries: 0,
          flaky: false,
          slow: (test.call?.duration || 0) > 5,
          tags: test.markers || [],
          customData: {},
        },
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Map Pytest status to TestStatus
   *
   * @param pytestStatus - Pytest status string
   * @returns TestStatus
   */
  private mapPytestStatus(pytestStatus: string): TestStatus {
    switch (pytestStatus.toUpperCase()) {
      case 'PASSED':
        return TestStatus.PASSED;
      case 'FAILED':
        return TestStatus.FAILED;
      case 'SKIPPED':
        return TestStatus.SKIPPED;
      default:
        return TestStatus.PENDING;
    }
  }

  /**
   * Parse Pytest error
   *
   * @param longrepr - Pytest error representation
   * @returns TestError
   */
  private parsePytestError(longrepr: string): TestError {
    return {
      message: longrepr.split('\n')[0] || '',
      stack: longrepr,
    };
  }

  /**
   * Parse Vitest test results
   *
   * @param output - Vitest output
   * @returns Array of test results
   */
  private parseVitestResults(output: string): TestResult[] {
    // Vitest output is similar to Jest, so we can reuse the Jest parser
    // with some modifications
    return this.parseJestResults(output).map((result) => ({
      ...result,
      metadata: {
        ...result.metadata,
        framework: TestFramework.VITEST,
      },
    }));
  }
}
