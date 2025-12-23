/**
 * PerformanceBenchmarker component
 *
 * Measures test execution times, identifies slow tests, tracks performance trends,
 * detects regressions, and suggests optimization opportunities.
 *
 * @packageDocumentation
 */

import {
  TestFramework,
  TestResult,
  TestRunOptions,
  PerformanceBenchmarkOptions,
  PerformanceBenchmarkResult,
  PerformanceReport,
  PerformanceTrend,
  PerformanceDataPoint,
  OptimizationSuggestion,
} from '../types';
import { TestRunnerManager } from './TestRunnerManager';

/**
 * Performance history storage
 */
interface PerformanceHistory {
  testId: string;
  dataPoints: PerformanceDataPoint[];
  lastUpdated: string;
}

/**
 * PerformanceBenchmarker class
 *
 * Benchmarks test performance, tracks trends, and suggests optimizations
 */
export class PerformanceBenchmarker {
  private testRunnerManager: TestRunnerManager;
  private historyStore: Map<string, PerformanceHistory> = new Map();
  private readonly defaultSlowThreshold = 5000; // 5 seconds
  private readonly regressionThreshold = 0.2; // 20% slower is a regression

  constructor(testRunnerManager?: TestRunnerManager) {
    this.testRunnerManager = testRunnerManager || new TestRunnerManager();
  }

  /**
   * Run performance benchmark
   *
   * @param options - Performance benchmark options
   * @returns Promise resolving to performance report
   */
  async runBenchmark(options: PerformanceBenchmarkOptions): Promise<PerformanceReport> {
    const slowThreshold = options.slowThreshold || this.defaultSlowThreshold;

    // Execute tests and measure performance
    const runOptions: TestRunOptions = {
      framework: options.framework,
      testPath: options.testPath,
      pattern: options.pattern,
      timeout: options.timeout,
    };

    const testResults = await this.testRunnerManager.runTests(runOptions);

    // Analyze performance for each test
    const benchmarkResults: PerformanceBenchmarkResult[] = [];
    let totalDuration = 0;

    for (const testResult of testResults) {
      totalDuration += testResult.duration;

      // Check if test is slow
      const isSlow = testResult.duration > slowThreshold;

      // Get performance trend if history is requested
      let trend: PerformanceTrend | undefined;
      if (options.includeHistory) {
        trend = this.calculateTrend(testResult.id, testResult.duration);
      }

      // Generate optimization suggestions
      const suggestions = await this.suggestOptimizations(testResult, isSlow);

      const benchmarkResult: PerformanceBenchmarkResult = {
        testId: testResult.id,
        testName: testResult.name,
        file: testResult.file,
        line: testResult.line,
        duration: testResult.duration,
        slow: isSlow,
        trend,
        optimizationSuggestions: suggestions,
      };

      benchmarkResults.push(benchmarkResult);

      // Update history
      if (options.includeHistory) {
        this.updateHistory(testResult.id, testResult.duration);
      }
    }

    // Identify slow tests
    const slowTests = benchmarkResults.filter((r) => r.slow);

    // Identify regressions
    const regressions = benchmarkResults.filter((r) => r.trend?.regression);

    // Sort by duration
    const sortedByDuration = [...benchmarkResults].sort((a, b) => b.duration - a.duration);

    // Create performance report
    const report: PerformanceReport = {
      totalTests: testResults.length,
      totalDuration,
      averageDuration: testResults.length > 0 ? totalDuration / testResults.length : 0,
      slowTests,
      fastestTests: sortedByDuration.slice(-5).reverse(),
      slowestTests: sortedByDuration.slice(0, 5),
      regressions,
      timestamp: new Date().toISOString(),
      framework: options.framework,
    };

    return report;
  }

  /**
   * Measure test duration
   *
   * @param testResult - Test result with duration
   * @returns Test duration in milliseconds
   */
  measureDuration(testResult: TestResult): number {
    return testResult.duration;
  }

  /**
   * Identify slow tests
   *
   * @param testResults - Array of test results
   * @param threshold - Duration threshold in milliseconds
   * @returns Array of slow test results
   */
  identifySlowTests(testResults: TestResult[], threshold?: number): TestResult[] {
    const slowThreshold = threshold || this.defaultSlowThreshold;
    return testResults.filter((result) => result.duration > slowThreshold);
  }

  /**
   * Calculate performance trend
   *
   * @param testId - Test ID
   * @param currentDuration - Current test duration
   * @returns Performance trend or undefined if no history
   */
  calculateTrend(testId: string, currentDuration: number): PerformanceTrend | undefined {
    const history = this.historyStore.get(testId);

    if (!history || history.dataPoints.length === 0) {
      return undefined;
    }

    const durations = history.dataPoints.map((dp) => dp.duration);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    // Check for regression (current duration is significantly higher than average)
    const regression = currentDuration >= average * (1 + this.regressionThreshold);
    const regressionPercentage = regression
      ? ((currentDuration - average) / average) * 100
      : undefined;

    return {
      current: currentDuration,
      average,
      min,
      max,
      history: history.dataPoints,
      regression,
      regressionPercentage,
    };
  }

  /**
   * Detect performance regressions
   *
   * @param testResults - Array of test results
   * @returns Array of test results with regressions
   */
  detectRegressions(testResults: TestResult[]): PerformanceBenchmarkResult[] {
    const regressions: PerformanceBenchmarkResult[] = [];

    for (const testResult of testResults) {
      const trend = this.calculateTrend(testResult.id, testResult.duration);

      if (trend?.regression) {
        regressions.push({
          testId: testResult.id,
          testName: testResult.name,
          file: testResult.file,
          line: testResult.line,
          duration: testResult.duration,
          slow: testResult.duration > this.defaultSlowThreshold,
          trend,
          optimizationSuggestions: [],
        });
      }
    }

    return regressions;
  }

  /**
   * Suggest optimization opportunities
   *
   * @param testResult - Test result to analyze
   * @param isSlow - Whether the test is slow
   * @returns Promise resolving to array of optimization suggestions
   */
  async suggestOptimizations(
    testResult: TestResult,
    isSlow: boolean
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // If test is slow, suggest general optimizations
    if (isSlow) {
      suggestions.push({
        type: 'reduce-scope',
        description: 'Consider reducing test scope or splitting into smaller tests',
        priority: 'high',
        estimatedImprovement: '30-50% faster',
      });

      suggestions.push({
        type: 'parallel-execution',
        description: 'Run independent tests in parallel to reduce total execution time',
        priority: 'medium',
        code: 'test.concurrent("test name", async () => { ... });',
        estimatedImprovement: '50-70% faster for suite',
      });

      suggestions.push({
        type: 'mock-dependencies',
        description: 'Mock slow external dependencies (databases, APIs, file I/O)',
        priority: 'high',
        code: 'jest.mock("./slowModule", () => ({ fetchData: jest.fn() }));',
        estimatedImprovement: '60-80% faster',
      });

      suggestions.push({
        type: 'optimize-setup',
        description: 'Move expensive setup to beforeAll() instead of beforeEach()',
        priority: 'medium',
        code: 'beforeAll(async () => { await expensiveSetup(); });',
        estimatedImprovement: '20-40% faster',
      });
    }

    // Analyze test metadata for specific suggestions
    if (testResult.metadata.customData) {
      // Check for database operations
      if (this.hasIndicator(testResult, ['database', 'db', 'sql', 'query'])) {
        suggestions.push({
          type: 'use-in-memory-db',
          description: 'Use in-memory database for faster test execution',
          priority: 'high',
          code: 'const db = new Database(":memory:");',
          estimatedImprovement: '70-90% faster',
        });
      }

      // Check for file I/O
      if (this.hasIndicator(testResult, ['file', 'fs', 'readFile', 'writeFile'])) {
        suggestions.push({
          type: 'mock-filesystem',
          description: 'Mock filesystem operations to avoid disk I/O',
          priority: 'high',
          code: 'jest.mock("fs");',
          estimatedImprovement: '80-95% faster',
        });
      }

      // Check for network operations
      if (this.hasIndicator(testResult, ['fetch', 'http', 'api', 'request'])) {
        suggestions.push({
          type: 'mock-network',
          description: 'Mock network requests to avoid external API calls',
          priority: 'high',
          code: 'nock("https://api.example.com").get("/data").reply(200, mockData);',
          estimatedImprovement: '90-99% faster',
        });
      }

      // Check for sleep/wait operations
      if (this.hasIndicator(testResult, ['sleep', 'wait', 'delay', 'setTimeout'])) {
        suggestions.push({
          type: 'use-fake-timers',
          description: 'Use fake timers to skip actual waiting time',
          priority: 'high',
          code: 'jest.useFakeTimers(); jest.advanceTimersByTime(1000);',
          estimatedImprovement: '95-99% faster',
        });
      }
    }

    // Add general best practices
    if (suggestions.length === 0 && isSlow) {
      suggestions.push({
        type: 'profile-test',
        description: 'Profile the test to identify performance bottlenecks',
        priority: 'medium',
        estimatedImprovement: 'Varies',
      });
    }

    return suggestions;
  }

  /**
   * Generate performance report
   *
   * @param testResults - Array of test results
   * @param framework - Test framework
   * @returns Performance report
   */
  generateReport(testResults: TestResult[], framework: TestFramework): PerformanceReport {
    const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = testResults.length > 0 ? totalDuration / testResults.length : 0;

    // Identify slow tests
    const slowTests: PerformanceBenchmarkResult[] = this.identifySlowTests(testResults).map(
      (r) => ({
        testId: r.id,
        testName: r.name,
        file: r.file,
        line: r.line,
        duration: r.duration,
        slow: true,
        optimizationSuggestions: [],
      })
    );

    // Sort by duration
    const sortedByDuration = [...testResults].sort((a, b) => b.duration - a.duration);

    return {
      totalTests: testResults.length,
      totalDuration,
      averageDuration,
      slowTests,
      fastestTests: sortedByDuration
        .slice(-5)
        .reverse()
        .map((r) => ({
          testId: r.id,
          testName: r.name,
          file: r.file,
          line: r.line,
          duration: r.duration,
          slow: false,
          optimizationSuggestions: [],
        })),
      slowestTests: sortedByDuration.slice(0, 5).map((r) => ({
        testId: r.id,
        testName: r.name,
        file: r.file,
        line: r.line,
        duration: r.duration,
        slow: r.duration > this.defaultSlowThreshold,
        optimizationSuggestions: [],
      })),
      regressions: [],
      timestamp: new Date().toISOString(),
      framework,
    };
  }

  /**
   * Get performance history
   *
   * @param testId - Test ID
   * @returns Performance history or undefined if not found
   */
  getHistory(testId: string): PerformanceHistory | undefined {
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
   * Update performance history
   *
   * @param testId - Test ID
   * @param duration - Test duration
   * @param commit - Optional commit hash
   * @param branch - Optional branch name
   */
  private updateHistory(testId: string, duration: number, commit?: string, branch?: string): void {
    const existing = this.historyStore.get(testId);

    const dataPoint: PerformanceDataPoint = {
      timestamp: new Date().toISOString(),
      duration,
      commit,
      branch,
    };

    if (existing) {
      // Append new data point
      existing.dataPoints.push(dataPoint);
      existing.lastUpdated = new Date().toISOString();

      // Keep only last 100 data points to avoid memory issues
      if (existing.dataPoints.length > 100) {
        existing.dataPoints = existing.dataPoints.slice(-100);
      }
    } else {
      // Create new history entry
      this.historyStore.set(testId, {
        testId,
        dataPoints: [dataPoint],
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  /**
   * Check if test has specific indicators in name or metadata
   *
   * @param testResult - Test result
   * @param indicators - Array of indicator strings
   * @returns True if any indicator is found
   */
  private hasIndicator(testResult: TestResult, indicators: string[]): boolean {
    const searchText = (
      testResult.name +
      ' ' +
      testResult.fullName +
      ' ' +
      JSON.stringify(testResult.metadata.customData)
    ).toLowerCase();

    return indicators.some((indicator) => searchText.includes(indicator.toLowerCase()));
  }
}
