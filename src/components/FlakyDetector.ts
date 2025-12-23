/**
 * FlakyDetector component
 *
 * Detects flaky tests through repeated execution and analyzes causes.
 * Tracks result consistency, calculates failure rates, and suggests fixes.
 *
 * @packageDocumentation
 */

import {
  TestFramework,
  TestResult,
  TestStatus,
  FlakyTest,
  FlakyTestRun,
  FlakinessCause,
  FlakinessFix,
  FlakyDetectionOptions,
  FlakinessAnalysis,
  TestCase,
  TestRunOptions,
} from '../types';
import { TestRunnerManager } from './TestRunnerManager';

/**
 * Flaky test history storage
 */
interface FlakyTestHistory {
  testId: string;
  runs: FlakyTestRun[];
  lastUpdated: string;
}

/**
 * FlakyDetector class
 *
 * Detects and analyzes flaky tests by executing them multiple times
 * and tracking result consistency
 */
export class FlakyDetector {
  private testRunnerManager: TestRunnerManager;
  private historyStore: Map<string, FlakyTestHistory> = new Map();
  private readonly defaultIterations = 10;

  constructor(testRunnerManager?: TestRunnerManager) {
    this.testRunnerManager = testRunnerManager || new TestRunnerManager();
  }

  /**
   * Detect flaky tests
   *
   * @param options - Flaky detection options
   * @returns Promise resolving to array of flaky tests
   */
  async detectFlakyTests(options: FlakyDetectionOptions): Promise<FlakyTest[]> {
    const iterations = options.iterations || this.defaultIterations;
    const flakyTests: FlakyTest[] = [];

    // Discover tests to check
    const testsToCheck = await this.getTestsToCheck(options);

    // Run each test multiple times
    for (const testCase of testsToCheck) {
      const results = await this.runTestMultipleTimes(testCase, iterations, options);

      // Analyze results for flakiness
      const analysis = this.analyzeFlakiness(results);

      if (analysis.isFlaky) {
        // Create flaky test record
        const flakyTest: FlakyTest = {
          testId: testCase.id,
          testName: testCase.name,
          file: testCase.file,
          line: testCase.line,
          failureRate: analysis.failureRate,
          totalRuns: results.length,
          failures: results.filter((r) => r.status === TestStatus.FAILED).length,
          causes: analysis.causes,
          history: results.map((r) => ({
            timestamp: r.timestamp,
            status: r.status,
            duration: r.duration,
            error: r.error,
          })),
        };

        flakyTests.push(flakyTest);

        // Update history store
        this.updateHistory(testCase.id, flakyTest.history);
      }
    }

    return flakyTests;
  }

  /**
   * Run a test multiple times
   *
   * @param testCase - Test case to run
   * @param iterations - Number of times to run the test
   * @param options - Flaky detection options
   * @returns Promise resolving to array of test results
   */
  async runTestMultipleTimes(
    testCase: TestCase,
    iterations: number,
    options: FlakyDetectionOptions
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (let i = 0; i < iterations; i++) {
      try {
        // Create test run options
        const runOptions: TestRunOptions = {
          framework: options.framework,
          testPath: testCase.file,
          pattern: testCase.name,
          timeout: options.timeout,
        };

        // Execute the test
        const testResults = await this.testRunnerManager.runTests(runOptions);

        // Find the specific test result
        const testResult = testResults.find(
          (r) => r.id === testCase.id || r.name === testCase.name
        );

        if (testResult) {
          results.push(testResult);
        } else {
          // Test not found - create a skipped result
          results.push({
            id: testCase.id,
            name: testCase.name,
            fullName: testCase.name,
            status: TestStatus.SKIPPED,
            duration: 0,
            file: testCase.file,
            line: testCase.line,
            suite: testCase.suite,
            tags: testCase.tags,
            metadata: {
              framework: options.framework,
              retries: 0,
              flaky: false,
              slow: false,
              tags: testCase.tags,
              customData: {},
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        // Test execution failed - create a failed result
        results.push({
          id: testCase.id,
          name: testCase.name,
          fullName: testCase.name,
          status: TestStatus.FAILED,
          duration: 0,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack || '' : '',
          },
          file: testCase.file,
          line: testCase.line,
          suite: testCase.suite,
          tags: testCase.tags,
          metadata: {
            framework: options.framework,
            retries: 0,
            flaky: false,
            slow: false,
            tags: testCase.tags,
            customData: {},
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Analyze test results for flakiness
   *
   * @param results - Array of test results from multiple runs
   * @returns Flakiness analysis
   */
  analyzeFlakiness(results: TestResult[]): FlakinessAnalysis {
    if (results.length === 0) {
      return {
        isFlaky: false,
        failureRate: 0,
        causes: [],
        confidence: 0,
      };
    }

    // Count different statuses
    const statusCounts = new Map<TestStatus, number>();
    for (const result of results) {
      statusCounts.set(result.status, (statusCounts.get(result.status) || 0) + 1);
    }

    // A test is flaky if it has inconsistent results
    const uniqueStatuses = statusCounts.size;
    const isFlaky = uniqueStatuses > 1;

    // Calculate failure rate
    const failures = statusCounts.get(TestStatus.FAILED) || 0;
    const failureRate = failures / results.length;

    // Analyze causes if flaky
    const causes: FlakinessCause[] = [];
    let confidence = 0;

    if (isFlaky) {
      // Analyze timing issues
      const timingCause = this.analyzeTimingIssues(results);
      if (timingCause) {
        causes.push(timingCause);
        confidence = Math.max(confidence, timingCause.confidence);
      }

      // Analyze race conditions
      const raceCause = this.analyzeRaceConditions(results);
      if (raceCause) {
        causes.push(raceCause);
        confidence = Math.max(confidence, raceCause.confidence);
      }

      // Analyze external dependencies
      const externalCause = this.analyzeExternalDependencies(results);
      if (externalCause) {
        causes.push(externalCause);
        confidence = Math.max(confidence, externalCause.confidence);
      }

      // Analyze random data issues
      const randomCause = this.analyzeRandomData(results);
      if (randomCause) {
        causes.push(randomCause);
        confidence = Math.max(confidence, randomCause.confidence);
      }

      // If no specific cause found, mark as unknown
      if (causes.length === 0) {
        causes.push({
          type: 'unknown',
          confidence: 0.5,
          description: 'Test produces inconsistent results, but the cause is unclear',
        });
        confidence = 0.5;
      }
    }

    return {
      isFlaky,
      failureRate,
      causes,
      confidence,
    };
  }

  /**
   * Suggest fixes for a flaky test
   *
   * @param flakyTest - Flaky test to analyze
   * @returns Promise resolving to array of fix suggestions
   */
  async suggestFixes(flakyTest: FlakyTest): Promise<FlakinessFix[]> {
    const fixes: FlakinessFix[] = [];

    // Suggest fixes based on causes
    for (const cause of flakyTest.causes) {
      switch (cause.type) {
        case 'timing':
          fixes.push({
            type: 'increase-timeout',
            description: 'Increase test timeout to allow more time for async operations',
            priority: 'high',
          });
          fixes.push({
            type: 'add-wait',
            description: 'Add explicit waits for async operations to complete',
            code: 'await waitFor(() => expect(element).toBeVisible(), { timeout: 5000 });',
            priority: 'high',
          });
          break;

        case 'race-condition':
          fixes.push({
            type: 'add-synchronization',
            description: 'Add proper synchronization mechanisms (locks, semaphores)',
            priority: 'high',
          });
          fixes.push({
            type: 'use-promises',
            description: 'Use Promise.all() to ensure all async operations complete',
            code: 'await Promise.all([operation1(), operation2()]);',
            priority: 'high',
          });
          break;

        case 'external-dependency':
          fixes.push({
            type: 'mock-external',
            description: 'Mock external dependencies to make tests deterministic',
            priority: 'high',
          });
          fixes.push({
            type: 'add-retry',
            description: 'Add retry logic for external API calls',
            code: 'await retry(() => fetchData(), { retries: 3, delay: 1000 });',
            priority: 'medium',
          });
          break;

        case 'random-data':
          fixes.push({
            type: 'use-fixed-seed',
            description: 'Use a fixed seed for random number generators',
            code: 'Math.seedrandom("fixed-seed");',
            priority: 'high',
          });
          fixes.push({
            type: 'use-deterministic-data',
            description: 'Replace random data with deterministic test fixtures',
            priority: 'high',
          });
          break;

        case 'unknown':
          fixes.push({
            type: 'add-logging',
            description: 'Add detailed logging to identify the source of flakiness',
            priority: 'medium',
          });
          fixes.push({
            type: 'isolate-test',
            description: 'Run test in isolation to check for test interdependencies',
            priority: 'medium',
          });
          break;
      }
    }

    // Add general fixes
    fixes.push({
      type: 'increase-iterations',
      description: 'Run test more times to better understand failure patterns',
      priority: 'low',
    });

    return fixes;
  }

  /**
   * Get flaky test history
   *
   * @param testId - Test ID
   * @returns Flaky test history or undefined if not found
   */
  getHistory(testId: string): FlakyTestHistory | undefined {
    return this.historyStore.get(testId);
  }

  /**
   * Clear history for a test
   *
   * @param testId - Test ID
   */
  clearHistory(testId: string): void {
    this.historyStore.delete(testId);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.historyStore.clear();
  }

  /**
   * Get tests to check based on options
   *
   * @param options - Flaky detection options
   * @returns Promise resolving to array of test cases
   */
  private async getTestsToCheck(options: FlakyDetectionOptions): Promise<TestCase[]> {
    // If specific test ID provided, create a test case for it
    if (options.testId) {
      return [
        {
          id: options.testId,
          name: options.testId,
          file: options.testPath || '',
          line: 0,
          suite: [],
          tags: [],
          priority: 0,
        },
      ];
    }

    // If test path provided, discover tests in that path
    if (options.testPath) {
      // For now, create a simple test case
      // In a real implementation, this would use TestManager to discover tests
      return [
        {
          id: options.testPath,
          name: options.testPath,
          file: options.testPath,
          line: 0,
          suite: [],
          tags: [],
          priority: 0,
        },
      ];
    }

    // If pattern provided, match tests
    // For now, return empty array
    // In a real implementation, this would use TestManager to search tests
    return [];
  }

  /**
   * Update history store
   *
   * @param testId - Test ID
   * @param runs - Test runs to add to history
   */
  private updateHistory(testId: string, runs: FlakyTestRun[]): void {
    const existing = this.historyStore.get(testId);

    if (existing) {
      // Append new runs to existing history
      existing.runs.push(...runs);
      existing.lastUpdated = new Date().toISOString();
    } else {
      // Create new history entry
      this.historyStore.set(testId, {
        testId,
        runs,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze timing issues
   *
   * @param results - Test results
   * @returns Timing cause or undefined
   */
  private analyzeTimingIssues(results: TestResult[]): FlakinessCause | undefined {
    // Check for timeout-related errors
    const timeoutErrors = results.filter(
      (r) =>
        r.error &&
        (r.error.message.toLowerCase().includes('timeout') ||
          r.error.message.toLowerCase().includes('timed out'))
    );

    if (timeoutErrors.length > 0) {
      const confidence = timeoutErrors.length / results.length;
      return {
        type: 'timing',
        confidence,
        description: `Test fails due to timeouts (${timeoutErrors.length}/${results.length} runs)`,
      };
    }

    // Check for duration variance
    const durations = results.map((r) => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance =
      durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    // High variance suggests timing issues
    if (stdDev > avgDuration * 0.5) {
      return {
        type: 'timing',
        confidence: 0.6,
        description: `Test has high duration variance (avg: ${avgDuration.toFixed(0)}ms, stddev: ${stdDev.toFixed(0)}ms)`,
      };
    }

    return undefined;
  }

  /**
   * Analyze race conditions
   *
   * @param results - Test results
   * @returns Race condition cause or undefined
   */
  private analyzeRaceConditions(results: TestResult[]): FlakinessCause | undefined {
    // Check for race condition indicators in error messages
    const raceIndicators = [
      'race',
      'concurrent',
      'parallel',
      'deadlock',
      'already',
      'not ready',
      'still processing',
    ];

    const raceErrors = results.filter((r) => {
      if (!r.error) return false;
      const errorText = r.error.message.toLowerCase();
      return raceIndicators.some((indicator) => errorText.includes(indicator));
    });

    if (raceErrors.length > 0) {
      const confidence = raceErrors.length / results.length;
      return {
        type: 'race-condition',
        confidence,
        description: `Test may have race conditions (${raceErrors.length}/${results.length} runs show indicators)`,
      };
    }

    return undefined;
  }

  /**
   * Analyze external dependencies
   *
   * @param results - Test results
   * @returns External dependency cause or undefined
   */
  private analyzeExternalDependencies(results: TestResult[]): FlakinessCause | undefined {
    // Check for network/external service errors
    const externalIndicators = [
      'network',
      'connection',
      'econnrefused',
      'enotfound',
      'timeout',
      'fetch',
      'http',
      'api',
      'service unavailable',
      '503',
      '502',
      '504',
    ];

    const externalErrors = results.filter((r) => {
      if (!r.error) return false;
      const errorText = (r.error.message + ' ' + r.error.stack).toLowerCase();
      return externalIndicators.some((indicator) => errorText.includes(indicator));
    });

    if (externalErrors.length > 0) {
      const confidence = externalErrors.length / results.length;
      return {
        type: 'external-dependency',
        confidence,
        description: `Test depends on external services (${externalErrors.length}/${results.length} runs show network/service errors)`,
      };
    }

    return undefined;
  }

  /**
   * Analyze random data issues
   *
   * @param results - Test results
   * @returns Random data cause or undefined
   */
  private analyzeRandomData(results: TestResult[]): FlakinessCause | undefined {
    // Check for random/non-deterministic indicators
    const randomIndicators = ['random', 'math.random', 'uuid', 'date.now', 'timestamp'];

    const randomErrors = results.filter((r) => {
      if (!r.error) return false;
      const errorText = (r.error.message + ' ' + r.error.stack).toLowerCase();
      return randomIndicators.some((indicator) => errorText.includes(indicator));
    });

    if (randomErrors.length > 0) {
      const confidence = randomErrors.length / results.length;
      return {
        type: 'random-data',
        confidence,
        description: `Test may use non-deterministic data (${randomErrors.length}/${results.length} runs show random data indicators)`,
      };
    }

    return undefined;
  }
}
