/**
 * Property-based tests for flaky test detection
 *
 * Tests Properties 27-31 from the design document:
 * - Property 27: Flaky detection executes multiple times
 * - Property 28: Inconsistent results mark tests as flaky
 * - Property 29: Flakiness causes are analyzed
 * - Property 30: Flaky history is tracked
 * - Property 31: Flaky fixes are suggested
 *
 * Validates Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import fc from 'fast-check';
import { FlakyDetector } from '../../components/FlakyDetector';
import { TestRunnerManager } from '../../components/TestRunnerManager';
import { TestFramework, TestStatus, TestResult, TestCase } from '../../types';

// Mock TestRunnerManager for controlled test execution
class MockTestRunnerManager extends TestRunnerManager {
  private mockResults: TestResult[] = [];
  private callCount = 0;

  setMockResults(results: TestResult[]): void {
    this.mockResults = results;
    this.callCount = 0;
  }

  async runTests(): Promise<TestResult[]> {
    const result = this.mockResults[this.callCount % this.mockResults.length];
    this.callCount++;
    return [result];
  }
}

describe('Flaky Detection Properties', () => {
  describe('Property 27: Flaky detection executes multiple times', () => {
    it('should execute test multiple times for any test case and iteration count', async () => {
      // **Feature: mcp-testing-server, Property 27: Flaky detection executes multiple times**

      await fc.assert(
        fc.asyncProperty(
          // Generate test case
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            file: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            line: fc.integer({ min: 1, max: 1000 }),
            suite: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 3 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 5 }),
            priority: fc.integer({ min: 0, max: 10 }),
          }),
          // Generate iteration count
          fc.integer({ min: 2, max: 20 }),
          // Generate consistent status
          fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED),
          async (testCase, iterations, status) => {
            const mockRunner = new MockTestRunnerManager();
            const detector = new FlakyDetector(mockRunner);

            // Create consistent test results
            const mockResult: TestResult = {
              id: testCase.id,
              name: testCase.name,
              fullName: testCase.name,
              status,
              duration: 100,
              file: testCase.file,
              line: testCase.line,
              suite: testCase.suite,
              tags: testCase.tags,
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: testCase.tags,
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            mockRunner.setMockResults([mockResult]);

            // Run test multiple times
            const results = await detector.runTestMultipleTimes(testCase, iterations, {
              framework: TestFramework.JEST,
            });

            // Property: Should execute exactly the specified number of times
            expect(results.length).toBe(iterations);

            // Property: All results should be for the same test
            results.forEach((result) => {
              expect(result.name).toBe(testCase.name);
              expect(result.file).toBe(testCase.file);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 28: Inconsistent results mark tests as flaky', () => {
    it('should mark test as flaky when results are inconsistent across runs', async () => {
      // **Feature: mcp-testing-server, Property 28: Inconsistent results mark tests as flaky**

      await fc.assert(
        fc.asyncProperty(
          // Generate test case
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            file: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            line: fc.integer({ min: 1, max: 1000 }),
            suite: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 3 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 5 }),
            priority: fc.integer({ min: 0, max: 10 }),
          }),
          // Generate number of passes and failures
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          async (testCase, passCount, failCount) => {
            const mockRunner = new MockTestRunnerManager();
            const detector = new FlakyDetector(mockRunner);

            // Create mixed results (some pass, some fail)
            const passResult: TestResult = {
              id: testCase.id,
              name: testCase.name,
              fullName: testCase.name,
              status: TestStatus.PASSED,
              duration: 100,
              file: testCase.file,
              line: testCase.line,
              suite: testCase.suite,
              tags: testCase.tags,
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: testCase.tags,
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            const failResult: TestResult = {
              ...passResult,
              status: TestStatus.FAILED,
              error: {
                message: 'Test failed',
                stack: 'Error: Test failed',
              },
            };

            // Create alternating results
            const mockResults: TestResult[] = [];
            for (let i = 0; i < passCount; i++) {
              mockResults.push(passResult);
            }
            for (let i = 0; i < failCount; i++) {
              mockResults.push(failResult);
            }

            mockRunner.setMockResults(mockResults);

            // Run detection
            const flakyTests = await detector.detectFlakyTests({
              testId: testCase.id,
              framework: TestFramework.JEST,
              iterations: passCount + failCount,
            });

            // Property: Test with inconsistent results should be marked as flaky
            expect(flakyTests.length).toBe(1);
            expect(flakyTests[0].testId).toBe(testCase.id);

            // Property: Failure rate should be calculated correctly
            const expectedFailureRate = failCount / (passCount + failCount);
            expect(flakyTests[0].failureRate).toBeCloseTo(expectedFailureRate, 2);

            // Property: Total runs and failures should match
            expect(flakyTests[0].totalRuns).toBe(passCount + failCount);
            expect(flakyTests[0].failures).toBe(failCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not mark test as flaky when results are consistent', async () => {
      // **Feature: mcp-testing-server, Property 28: Inconsistent results mark tests as flaky**

      await fc.assert(
        fc.asyncProperty(
          // Generate test case
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            file: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            line: fc.integer({ min: 1, max: 1000 }),
            suite: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 3 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 5 }),
            priority: fc.integer({ min: 0, max: 10 }),
          }),
          // Generate iteration count
          fc.integer({ min: 2, max: 20 }),
          // Generate consistent status
          fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED),
          async (testCase, iterations, status) => {
            const mockRunner = new MockTestRunnerManager();
            const detector = new FlakyDetector(mockRunner);

            // Create consistent results
            const mockResult: TestResult = {
              id: testCase.id,
              name: testCase.name,
              fullName: testCase.name,
              status,
              duration: 100,
              file: testCase.file,
              line: testCase.line,
              suite: testCase.suite,
              tags: testCase.tags,
              metadata: {
                framework: TestFramework.JEST,
                retries: 0,
                flaky: false,
                slow: false,
                tags: testCase.tags,
                customData: {},
              },
              timestamp: new Date().toISOString(),
            };

            if (status === TestStatus.FAILED) {
              mockResult.error = {
                message: 'Test failed',
                stack: 'Error: Test failed',
              };
            }

            mockRunner.setMockResults([mockResult]);

            // Run detection
            const flakyTests = await detector.detectFlakyTests({
              testId: testCase.id,
              framework: TestFramework.JEST,
              iterations,
            });

            // Property: Test with consistent results should not be marked as flaky
            expect(flakyTests.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 29: Flakiness causes are analyzed', () => {
    it('should identify timing issues from timeout errors', () => {
      // **Feature: mcp-testing-server, Property 29: Flakiness causes are analyzed**

      fc.assert(
        fc.property(
          // Generate test results with timeout errors
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (timeoutCount, successCount) => {
            const detector = new FlakyDetector();

            // Create results with timeout errors
            const results: TestResult[] = [];

            for (let i = 0; i < timeoutCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.FAILED,
                duration: 5000,
                error: {
                  message: 'Test timed out after 5000ms',
                  stack: 'Error: timeout',
                },
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
              });
            }

            for (let i = 0; i < successCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.PASSED,
                duration: 100,
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
              });
            }

            // Analyze flakiness
            const analysis = detector.analyzeFlakiness(results);

            // Property: Should identify timing issues
            if (timeoutCount > 0) {
              expect(analysis.isFlaky).toBe(true);
              expect(analysis.causes.length).toBeGreaterThan(0);
              expect(analysis.causes.some((c) => c.type === 'timing')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify race conditions from error messages', () => {
      // **Feature: mcp-testing-server, Property 29: Flakiness causes are analyzed**

      fc.assert(
        fc.property(
          // Generate race condition indicators
          fc.constantFrom('race', 'concurrent', 'deadlock', 'already', 'not ready'),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (raceIndicator, raceCount, successCount) => {
            const detector = new FlakyDetector();

            // Create results with race condition errors
            const results: TestResult[] = [];

            for (let i = 0; i < raceCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.FAILED,
                duration: 100,
                error: {
                  message: `Test failed due to ${raceIndicator} condition`,
                  stack: `Error: ${raceIndicator}`,
                },
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
              });
            }

            for (let i = 0; i < successCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.PASSED,
                duration: 100,
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
              });
            }

            // Analyze flakiness
            const analysis = detector.analyzeFlakiness(results);

            // Property: Should identify race conditions
            if (raceCount > 0) {
              expect(analysis.isFlaky).toBe(true);
              expect(analysis.causes.length).toBeGreaterThan(0);
              expect(analysis.causes.some((c) => c.type === 'race-condition')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify external dependency issues from network errors', () => {
      // **Feature: mcp-testing-server, Property 29: Flakiness causes are analyzed**

      fc.assert(
        fc.property(
          // Generate network error indicators
          fc.constantFrom('ECONNREFUSED', 'ENOTFOUND', 'network', 'fetch', '503', '502'),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (networkError, errorCount, successCount) => {
            const detector = new FlakyDetector();

            // Create results with network errors
            const results: TestResult[] = [];

            for (let i = 0; i < errorCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.FAILED,
                duration: 100,
                error: {
                  message: `Test failed: ${networkError}`,
                  stack: `Error: ${networkError}\n  at fetch()`,
                },
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
              });
            }

            for (let i = 0; i < successCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.PASSED,
                duration: 100,
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
              });
            }

            // Analyze flakiness
            const analysis = detector.analyzeFlakiness(results);

            // Property: Should identify external dependency issues
            if (errorCount > 0) {
              expect(analysis.isFlaky).toBe(true);
              expect(analysis.causes.length).toBeGreaterThan(0);
              expect(analysis.causes.some((c) => c.type === 'external-dependency')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify random data issues from error messages', () => {
      // **Feature: mcp-testing-server, Property 29: Flakiness causes are analyzed**

      fc.assert(
        fc.property(
          // Generate random data indicators
          fc.constantFrom('Math.random', 'uuid', 'Date.now', 'random'),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (randomIndicator, errorCount, successCount) => {
            const detector = new FlakyDetector();

            // Create results with random data errors
            const results: TestResult[] = [];

            for (let i = 0; i < errorCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.FAILED,
                duration: 100,
                error: {
                  message: `Test failed with ${randomIndicator}`,
                  stack: `Error: ${randomIndicator}\n  at test()`,
                },
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
              });
            }

            for (let i = 0; i < successCount; i++) {
              results.push({
                id: 'test-1',
                name: 'test',
                fullName: 'test',
                status: TestStatus.PASSED,
                duration: 100,
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
              });
            }

            // Analyze flakiness
            const analysis = detector.analyzeFlakiness(results);

            // Property: Should identify random data issues
            if (errorCount > 0) {
              expect(analysis.isFlaky).toBe(true);
              expect(analysis.causes.length).toBeGreaterThan(0);
              expect(analysis.causes.some((c) => c.type === 'random-data')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 30: Flaky history is tracked', () => {
    it('should track history for any flaky test', async () => {
      // **Feature: mcp-testing-server, Property 30: Flaky history is tracked**

      await fc.assert(
        fc.asyncProperty(
          // Generate test case
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            name: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            file: fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            line: fc.integer({ min: 1, max: 1000 }),
            suite: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 3 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 5 }),
            priority: fc.integer({ min: 0, max: 10 }),
          }),
          // Generate number of runs
          fc.integer({ min: 2, max: 20 }),
          async (testCase, runCount) => {
            const mockRunner = new MockTestRunnerManager();
            const detector = new FlakyDetector(mockRunner);

            // Create mixed results
            const mockResults: TestResult[] = [];
            for (let i = 0; i < runCount; i++) {
              mockResults.push({
                id: testCase.id,
                name: testCase.name,
                fullName: testCase.name,
                status: i % 2 === 0 ? TestStatus.PASSED : TestStatus.FAILED,
                duration: 100 + i * 10,
                file: testCase.file,
                line: testCase.line,
                suite: testCase.suite,
                tags: testCase.tags,
                error:
                  i % 2 === 0
                    ? undefined
                    : {
                        message: 'Test failed',
                        stack: 'Error: Test failed',
                      },
                metadata: {
                  framework: TestFramework.JEST,
                  retries: 0,
                  flaky: false,
                  slow: false,
                  tags: testCase.tags,
                  customData: {},
                },
                timestamp: new Date(Date.now() + i * 1000).toISOString(),
              });
            }

            mockRunner.setMockResults(mockResults);

            // Run detection
            await detector.detectFlakyTests({
              testId: testCase.id,
              framework: TestFramework.JEST,
              iterations: runCount,
            });

            // Property: History should be tracked
            const history = detector.getHistory(testCase.id);
            expect(history).toBeDefined();
            expect(history!.testId).toBe(testCase.id);
            expect(history!.runs.length).toBe(runCount);

            // Property: History should contain all runs with timestamps
            history!.runs.forEach((run, i) => {
              expect(run.timestamp).toBeTruthy();
              expect(run.status).toBe(i % 2 === 0 ? TestStatus.PASSED : TestStatus.FAILED);
              expect(run.duration).toBe(100 + i * 10);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accumulate history across multiple detection runs', async () => {
      // **Feature: mcp-testing-server, Property 30: Flaky history is tracked**

      await fc.assert(
        fc.asyncProperty(
          // Generate test ID
          fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
          // Generate number of detection runs
          fc.integer({ min: 2, max: 5 }),
          // Generate iterations per run
          fc.integer({ min: 2, max: 5 }),
          async (testId, detectionRuns, iterationsPerRun) => {
            const mockRunner = new MockTestRunnerManager();
            const detector = new FlakyDetector(mockRunner);

            const testCase: TestCase = {
              id: testId,
              name: 'test',
              file: 'test.ts',
              line: 1,
              suite: [],
              tags: [],
              priority: 0,
            };

            // Run detection multiple times
            for (let run = 0; run < detectionRuns; run++) {
              const mockResults: TestResult[] = [];
              for (let i = 0; i < iterationsPerRun; i++) {
                mockResults.push({
                  id: testId,
                  name: 'test',
                  fullName: 'test',
                  status: (run + i) % 2 === 0 ? TestStatus.PASSED : TestStatus.FAILED,
                  duration: 100,
                  file: 'test.ts',
                  line: 1,
                  suite: [],
                  tags: [],
                  error:
                    (run + i) % 2 === 0
                      ? undefined
                      : {
                          message: 'Test failed',
                          stack: 'Error: Test failed',
                        },
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

              mockRunner.setMockResults(mockResults);

              await detector.detectFlakyTests({
                testId,
                framework: TestFramework.JEST,
                iterations: iterationsPerRun,
              });
            }

            // Property: History should accumulate across runs
            const history = detector.getHistory(testId);
            expect(history).toBeDefined();
            expect(history!.runs.length).toBe(detectionRuns * iterationsPerRun);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 31: Flaky fixes are suggested', () => {
    it('should suggest fixes for any flaky test with identified causes', async () => {
      // **Feature: mcp-testing-server, Property 31: Flaky fixes are suggested**

      await fc.assert(
        fc.asyncProperty(
          // Generate flaky test with different causes
          fc.constantFrom('timing', 'race-condition', 'external-dependency', 'random-data'),
          fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (causeType, testName) => {
            const detector = new FlakyDetector();

            const flakyTest = {
              testId: 'test-1',
              testName,
              file: 'test.ts',
              line: 1,
              failureRate: 0.5,
              totalRuns: 10,
              failures: 5,
              causes: [
                {
                  type: causeType as any,
                  confidence: 0.8,
                  description: `Test has ${causeType} issues`,
                },
              ],
              history: [],
            };

            // Get fix suggestions
            const fixes = await detector.suggestFixes(flakyTest);

            // Property: Should provide fix suggestions
            expect(fixes.length).toBeGreaterThan(0);

            // Property: Each fix should have required fields
            fixes.forEach((fix) => {
              expect(fix).toHaveProperty('type');
              expect(fix).toHaveProperty('description');
              expect(fix).toHaveProperty('priority');
              expect(['high', 'medium', 'low']).toContain(fix.priority);
            });

            // Property: Fixes should be relevant to the cause
            const fixTypes = fixes.map((f) => f.type);
            switch (causeType) {
              case 'timing':
                expect(fixTypes.some((t) => t.includes('timeout') || t.includes('wait'))).toBe(
                  true
                );
                break;
              case 'race-condition':
                expect(
                  fixTypes.some((t) => t.includes('synchronization') || t.includes('promise'))
                ).toBe(true);
                break;
              case 'external-dependency':
                expect(fixTypes.some((t) => t.includes('mock') || t.includes('retry'))).toBe(true);
                break;
              case 'random-data':
                expect(
                  fixTypes.some((t) => t.includes('seed') || t.includes('deterministic'))
                ).toBe(true);
                break;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide general fixes for unknown causes', async () => {
      // **Feature: mcp-testing-server, Property 31: Flaky fixes are suggested**

      await fc.assert(
        fc.asyncProperty(
          // Generate test name
          fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (testName) => {
            const detector = new FlakyDetector();

            const flakyTest = {
              testId: 'test-1',
              testName,
              file: 'test.ts',
              line: 1,
              failureRate: 0.3,
              totalRuns: 10,
              failures: 3,
              causes: [
                {
                  type: 'unknown' as any,
                  confidence: 0.5,
                  description: 'Cause is unclear',
                },
              ],
              history: [],
            };

            // Get fix suggestions
            const fixes = await detector.suggestFixes(flakyTest);

            // Property: Should provide general fixes for unknown causes
            expect(fixes.length).toBeGreaterThan(0);

            const fixTypes = fixes.map((f) => f.type);
            expect(fixTypes.some((t) => t.includes('logging') || t.includes('isolate'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
