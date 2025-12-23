/**
 * Property-based tests for performance benchmarking
 *
 * Tests Properties 41-45 from the design document:
 * - Property 41: Test durations are measured
 * - Property 42: Slow tests are identified
 * - Property 43: Performance trends detect regressions
 * - Property 44: Optimization suggestions are provided
 * - Property 45: Performance reports are comprehensive
 *
 * Validates Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import fc from 'fast-check';
import { PerformanceBenchmarker } from '../../components/PerformanceBenchmarker';
import { TestRunnerManager } from '../../components/TestRunnerManager';
import { TestFramework, TestStatus, TestResult } from '../../types';

// Mock TestRunnerManager for controlled test execution
class MockTestRunnerManager extends TestRunnerManager {
  private mockResults: TestResult[] = [];

  setMockResults(results: TestResult[]): void {
    this.mockResults = results;
  }

  async runTests(): Promise<TestResult[]> {
    return this.mockResults;
  }
}

describe('Performance Benchmarking Properties', () => {
  describe('Property 41: Test durations are measured', () => {
    it('should measure and record execution time for any test execution', async () => {
      // **Feature: mcp-testing-server, Property 41: Test durations are measured**

      await fc.assert(
        fc.asyncProperty(
          // Generate array of test results with various durations
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              duration: fc.integer({ min: 1, max: 30000 }), // 1ms to 30s
              status: fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED, TestStatus.SKIPPED),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (testData) => {
            const mockRunner = new MockTestRunnerManager();
            const benchmarker = new PerformanceBenchmarker(mockRunner);

            // Create test results
            const testResults: TestResult[] = testData.map((data) => ({
              id: data.id,
              name: data.name,
              fullName: data.name,
              status: data.status,
              duration: data.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
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
            }));

            mockRunner.setMockResults(testResults);

            // Run benchmark
            const report = await benchmarker.runBenchmark({
              framework: TestFramework.JEST,
            });

            // Property: All test durations should be measured and recorded
            expect(report.totalTests).toBe(testResults.length);

            // Property: Each test should have its duration measured
            const allDurations = [
              ...report.slowTests,
              ...report.fastestTests,
              ...report.slowestTests,
            ];
            allDurations.forEach((result) => {
              expect(result.duration).toBeGreaterThanOrEqual(0);
              expect(typeof result.duration).toBe('number');
            });

            // Property: Total duration should equal sum of individual durations
            const expectedTotal = testResults.reduce((sum, r) => sum + r.duration, 0);
            expect(report.totalDuration).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly measure duration for individual test results', () => {
      // **Feature: mcp-testing-server, Property 41: Test durations are measured**

      fc.assert(
        fc.property(
          // Generate test result with duration
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            duration: fc.integer({ min: 0, max: 60000 }),
          }),
          (testData) => {
            const benchmarker = new PerformanceBenchmarker();

            const testResult: TestResult = {
              id: testData.id,
              name: testData.name,
              fullName: testData.name,
              status: TestStatus.PASSED,
              duration: testData.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
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

            // Property: Measured duration should match test result duration
            const measured = benchmarker.measureDuration(testResult);
            expect(measured).toBe(testData.duration);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 42: Slow tests are identified', () => {
    it('should mark test as slow when duration exceeds configured threshold', async () => {
      // **Feature: mcp-testing-server, Property 42: Slow tests are identified**

      await fc.assert(
        fc.asyncProperty(
          // Generate slow threshold
          fc.integer({ min: 1000, max: 10000 }),
          // Generate test durations (some above, some below threshold)
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              duration: fc.integer({ min: 100, max: 20000 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (threshold, testData) => {
            const mockRunner = new MockTestRunnerManager();
            const benchmarker = new PerformanceBenchmarker(mockRunner);

            // Create test results
            const testResults: TestResult[] = testData.map((data) => ({
              id: data.id,
              name: data.name,
              fullName: data.name,
              status: TestStatus.PASSED,
              duration: data.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
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
            }));

            mockRunner.setMockResults(testResults);

            // Run benchmark with custom threshold
            const report = await benchmarker.runBenchmark({
              framework: TestFramework.JEST,
              slowThreshold: threshold,
            });

            // Property: All tests exceeding threshold should be marked as slow
            const expectedSlowCount = testResults.filter((r) => r.duration > threshold).length;
            expect(report.slowTests.length).toBe(expectedSlowCount);

            // Property: All slow tests should have duration > threshold
            report.slowTests.forEach((result) => {
              expect(result.duration).toBeGreaterThan(threshold);
              expect(result.slow).toBe(true);
            });

            // Property: No test below threshold should be marked as slow
            const nonSlowTests = testResults.filter((r) => r.duration <= threshold);
            nonSlowTests.forEach((testResult) => {
              const benchmarkResult = report.slowTests.find((r) => r.testId === testResult.id);
              expect(benchmarkResult).toBeUndefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify slow tests from any array of test results', () => {
      // **Feature: mcp-testing-server, Property 42: Slow tests are identified**

      fc.assert(
        fc.property(
          // Generate threshold
          fc.integer({ min: 1000, max: 10000 }),
          // Generate test results
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              duration: fc.integer({ min: 100, max: 20000 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          (threshold, testData) => {
            const benchmarker = new PerformanceBenchmarker();

            const testResults: TestResult[] = testData.map((data) => ({
              id: data.id,
              name: 'test',
              fullName: 'test',
              status: TestStatus.PASSED,
              duration: data.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
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
            }));

            // Identify slow tests
            const slowTests = benchmarker.identifySlowTests(testResults, threshold);

            // Property: All identified slow tests should exceed threshold
            slowTests.forEach((test) => {
              expect(test.duration).toBeGreaterThan(threshold);
            });

            // Property: Count should match expected
            const expectedCount = testResults.filter((r) => r.duration > threshold).length;
            expect(slowTests.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 43: Performance trends detect regressions', () => {
    it('should detect regression when current duration significantly exceeds historical average', () => {
      // **Feature: mcp-testing-server, Property 43: Performance trends detect regressions**

      fc.assert(
        fc.property(
          // Generate test ID
          fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
          // Generate historical durations
          fc.array(fc.integer({ min: 100, max: 1000 }), { minLength: 3, maxLength: 10 }),
          // Generate regression percentage (20% or more)
          fc
            .float({ min: Math.fround(0.2), max: Math.fround(2.0) })
            .filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
          (testId, historicalDurations, regressionFactor) => {
            const benchmarker = new PerformanceBenchmarker();

            // Add historical data
            historicalDurations.forEach((duration) => {
              benchmarker['updateHistory'](testId, duration);
            });

            // Calculate average
            const average =
              historicalDurations.reduce((sum, d) => sum + d, 0) / historicalDurations.length;

            // Create regressed duration (significantly higher than average)
            const regressedDuration = Math.ceil(average * (1 + regressionFactor));

            // Calculate trend
            const trend = benchmarker.calculateTrend(testId, regressedDuration);

            // Property: Should detect regression
            expect(trend).toBeDefined();
            expect(trend!.regression).toBe(true);
            expect(trend!.regressionPercentage).toBeGreaterThan(0);

            // Property: Current duration should be higher than average
            expect(trend!.current).toBeGreaterThan(trend!.average);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect regression when duration is within acceptable range', () => {
      // **Feature: mcp-testing-server, Property 43: Performance trends detect regressions**

      fc.assert(
        fc.property(
          // Generate test ID
          fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
          // Generate historical durations
          fc.array(fc.integer({ min: 100, max: 1000 }), { minLength: 3, maxLength: 10 }),
          // Generate small variation (less than 20%)
          fc
            .float({ min: Math.fround(-0.15), max: Math.fround(0.15) })
            .filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
          (testId, historicalDurations, variation) => {
            const benchmarker = new PerformanceBenchmarker();

            // Add historical data
            historicalDurations.forEach((duration) => {
              benchmarker['updateHistory'](testId, duration);
            });

            // Calculate average
            const average =
              historicalDurations.reduce((sum, d) => sum + d, 0) / historicalDurations.length;

            // Create duration within acceptable range
            const currentDuration = Math.floor(average * (1 + variation));

            // Calculate trend
            const trend = benchmarker.calculateTrend(testId, currentDuration);

            // Property: Should not detect regression for small variations
            expect(trend).toBeDefined();
            if (variation <= 0.2) {
              expect(trend!.regression).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect regressions in test results with history', () => {
      // **Feature: mcp-testing-server, Property 43: Performance trends detect regressions**

      fc.assert(
        fc.property(
          // Generate test results with historical data
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              historicalDurations: fc.array(fc.integer({ min: 100, max: 1000 }), {
                minLength: 3,
                maxLength: 10,
              }),
              currentDuration: fc.integer({ min: 100, max: 5000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (testData) => {
            const benchmarker = new PerformanceBenchmarker();

            // Add historical data for each test
            testData.forEach((data) => {
              data.historicalDurations.forEach((duration) => {
                benchmarker['updateHistory'](data.id, duration);
              });
            });

            // Create test results
            const testResults: TestResult[] = testData.map((data) => ({
              id: data.id,
              name: 'test',
              fullName: 'test',
              status: TestStatus.PASSED,
              duration: data.currentDuration,
              file: 'test.ts',
              line: 1,
              suite: [],
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
            }));

            // Detect regressions
            const regressions = benchmarker.detectRegressions(testResults);

            // Property: All detected regressions should have trend.regression = true
            regressions.forEach((regression) => {
              expect(regression.trend).toBeDefined();
              expect(regression.trend!.regression).toBe(true);
            });

            // Property: Regression count should match tests with significant increases
            testData.forEach((data) => {
              const average =
                data.historicalDurations.reduce((sum, d) => sum + d, 0) /
                data.historicalDurations.length;
              const isRegression = data.currentDuration > average * 1.2; // 20% threshold

              const foundRegression = regressions.find((r) => r.testId === data.id);
              if (isRegression) {
                expect(foundRegression).toBeDefined();
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 44: Optimization suggestions are provided', () => {
    it('should provide optimization suggestions for any slow test', async () => {
      // **Feature: mcp-testing-server, Property 44: Optimization suggestions are provided**

      await fc.assert(
        fc.asyncProperty(
          // Generate slow test result
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            duration: fc.integer({ min: 5001, max: 30000 }), // Above default threshold
          }),
          async (testData) => {
            const benchmarker = new PerformanceBenchmarker();

            const testResult: TestResult = {
              id: testData.id,
              name: testData.name,
              fullName: testData.name,
              status: TestStatus.PASSED,
              duration: testData.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
              tags: [],
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: true,
                tags: [],
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            // Get optimization suggestions
            const suggestions = await benchmarker.suggestOptimizations(testResult, true);

            // Property: Should provide suggestions for slow tests
            expect(suggestions.length).toBeGreaterThan(0);

            // Property: Each suggestion should have required fields
            suggestions.forEach((suggestion) => {
              expect(suggestion).toHaveProperty('type');
              expect(suggestion).toHaveProperty('description');
              expect(suggestion).toHaveProperty('priority');
              expect(['high', 'medium', 'low']).toContain(suggestion.priority);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide specific suggestions based on test characteristics', async () => {
      // **Feature: mcp-testing-server, Property 44: Optimization suggestions are provided**

      await fc.assert(
        fc.asyncProperty(
          // Generate test with specific indicators
          fc.constantFrom('database', 'file', 'fetch', 'setTimeout'),
          fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (indicator, testName) => {
            const benchmarker = new PerformanceBenchmarker();

            const testResult: TestResult = {
              id: 'test-1',
              name: `${testName} ${indicator}`,
              fullName: `${testName} ${indicator}`,
              status: TestStatus.PASSED,
              duration: 6000,
              file: 'test.ts',
              line: 1,
              suite: [],
              tags: [],
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: true,
                tags: [],
                customData: { operation: indicator },
              },
              timestamp: new Date().toISOString(),
            };

            // Get optimization suggestions
            const suggestions = await benchmarker.suggestOptimizations(testResult, true);

            // Property: Should provide relevant suggestions based on indicators
            expect(suggestions.length).toBeGreaterThan(0);

            const suggestionTypes = suggestions.map((s) => s.type);

            // Check for indicator-specific suggestions
            switch (indicator) {
              case 'database':
                expect(suggestionTypes.some((t) => t.includes('db') || t.includes('memory'))).toBe(
                  true
                );
                break;
              case 'file':
                expect(
                  suggestionTypes.some((t) => t.includes('filesystem') || t.includes('mock'))
                ).toBe(true);
                break;
              case 'fetch':
                expect(
                  suggestionTypes.some((t) => t.includes('network') || t.includes('mock'))
                ).toBe(true);
                break;
              case 'setTimeout':
                expect(suggestionTypes.some((t) => t.includes('timer') || t.includes('fake'))).toBe(
                  true
                );
                break;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 45: Performance reports are comprehensive', () => {
    it('should generate comprehensive report for any test execution', async () => {
      // **Feature: mcp-testing-server, Property 45: Performance reports are comprehensive**

      await fc.assert(
        fc.asyncProperty(
          // Generate test results
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              duration: fc.integer({ min: 10, max: 30000 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          async (testData) => {
            const mockRunner = new MockTestRunnerManager();
            const benchmarker = new PerformanceBenchmarker(mockRunner);

            const testResults: TestResult[] = testData.map((data) => ({
              id: data.id,
              name: data.name,
              fullName: data.name,
              status: TestStatus.PASSED,
              duration: data.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
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
            }));

            mockRunner.setMockResults(testResults);

            // Run benchmark
            const report = await benchmarker.runBenchmark({
              framework: TestFramework.JEST,
            });

            // Property: Report should contain all required fields
            expect(report).toHaveProperty('totalTests');
            expect(report).toHaveProperty('totalDuration');
            expect(report).toHaveProperty('averageDuration');
            expect(report).toHaveProperty('slowTests');
            expect(report).toHaveProperty('fastestTests');
            expect(report).toHaveProperty('slowestTests');
            expect(report).toHaveProperty('regressions');
            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('framework');

            // Property: Total tests should match input
            expect(report.totalTests).toBe(testResults.length);

            // Property: Total duration should be sum of all durations
            const expectedTotal = testResults.reduce((sum, r) => sum + r.duration, 0);
            expect(report.totalDuration).toBe(expectedTotal);

            // Property: Average duration should be calculated correctly
            const expectedAverage = testResults.length > 0 ? expectedTotal / testResults.length : 0;
            expect(report.averageDuration).toBeCloseTo(expectedAverage, 2);

            // Property: Slowest tests should be sorted by duration (descending)
            for (let i = 0; i < report.slowestTests.length - 1; i++) {
              expect(report.slowestTests[i].duration).toBeGreaterThanOrEqual(
                report.slowestTests[i + 1].duration
              );
            }

            // Property: Fastest tests should be sorted by duration (ascending)
            for (let i = 0; i < report.fastestTests.length - 1; i++) {
              expect(report.fastestTests[i].duration).toBeLessThanOrEqual(
                report.fastestTests[i + 1].duration
              );
            }

            // Property: Framework should match input
            expect(report.framework).toBe(TestFramework.JEST);

            // Property: Timestamp should be valid ISO string
            expect(() => new Date(report.timestamp)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate report with correct metrics using generateReport method', () => {
      // **Feature: mcp-testing-server, Property 45: Performance reports are comprehensive**

      fc.assert(
        fc.property(
          // Generate test results
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              duration: fc.integer({ min: 10, max: 30000 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          (testData) => {
            const benchmarker = new PerformanceBenchmarker();

            const testResults: TestResult[] = testData.map((data) => ({
              id: data.id,
              name: 'test',
              fullName: 'test',
              status: TestStatus.PASSED,
              duration: data.duration,
              file: 'test.ts',
              line: 1,
              suite: [],
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
            }));

            // Generate report
            const report = benchmarker.generateReport(testResults, TestFramework.JEST);

            // Property: Report metrics should be accurate
            expect(report.totalTests).toBe(testResults.length);

            const expectedTotal = testResults.reduce((sum, r) => sum + r.duration, 0);
            expect(report.totalDuration).toBe(expectedTotal);

            const expectedAverage = testResults.length > 0 ? expectedTotal / testResults.length : 0;
            expect(report.averageDuration).toBe(expectedAverage);

            // Property: Slowest tests should contain the slowest durations
            if (report.slowestTests.length > 0 && testResults.length > 0) {
              const maxDuration = Math.max(...testResults.map((r) => r.duration));
              expect(report.slowestTests[0].duration).toBe(maxDuration);
            }

            // Property: Fastest tests should contain the fastest durations
            if (report.fastestTests.length > 0 && testResults.length > 0) {
              const minDuration = Math.min(...testResults.map((r) => r.duration));
              const fastestDurations = report.fastestTests.map((r) => r.duration);
              expect(fastestDurations).toContain(minDuration);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
