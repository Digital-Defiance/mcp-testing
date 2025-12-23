/**
 * Property-based tests for test execution and result parsing
 *
 * Tests Property 1 from the design document:
 * - Property 1: Test execution produces structured results
 *
 * Validates Requirements 1.1, 1.2
 */

import fc from 'fast-check';
import { ResultParser } from '../../components/ResultParser';
import { TestFramework, TestStatus } from '../../types';

describe('Test Execution Properties', () => {
  describe('Property 1: Test execution produces structured results', () => {
    it('should parse Jest output and return structured results with passed, failed, and skipped tests', () => {
      // **Feature: mcp-testing-server, Property 1: Test execution produces structured results**

      fc.assert(
        fc.property(
          // Generate test names
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          // Generate test statuses
          fc.array(fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED, TestStatus.SKIPPED), {
            minLength: 1,
            maxLength: 10,
          }),
          // Generate test durations
          fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 10 }),
          (testNames, testStatuses, testDurations) => {
            // Ensure arrays are same length
            const length = Math.min(testNames.length, testStatuses.length, testDurations.length);
            const names = testNames.slice(0, length);
            const statuses = testStatuses.slice(0, length);
            const durations = testDurations.slice(0, length);

            // Generate Jest JSON output
            const jestOutput = {
              testResults: [
                {
                  name: 'test/example.test.ts',
                  assertionResults: names.map((name, i) => ({
                    title: name,
                    fullName: name,
                    status:
                      statuses[i] === TestStatus.PASSED
                        ? 'passed'
                        : statuses[i] === TestStatus.FAILED
                          ? 'failed'
                          : 'skipped',
                    duration: durations[i],
                    ancestorTitles: [],
                    location: { line: i + 1 },
                    failureMessages: statuses[i] === TestStatus.FAILED ? ['Test failed'] : [],
                  })),
                },
              ],
            };

            const parser = new ResultParser();
            const results = parser.parseResults(JSON.stringify(jestOutput), TestFramework.JEST);

            // Property: Parser should return structured results
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(length);

            // Property: Each result should have required fields
            results.forEach((result, i) => {
              expect(result).toHaveProperty('id');
              expect(result).toHaveProperty('name');
              expect(result).toHaveProperty('fullName');
              expect(result).toHaveProperty('status');
              expect(result).toHaveProperty('duration');
              expect(result).toHaveProperty('file');
              expect(result).toHaveProperty('line');
              expect(result).toHaveProperty('suite');
              expect(result).toHaveProperty('tags');
              expect(result).toHaveProperty('metadata');
              expect(result).toHaveProperty('timestamp');

              // Verify status matches
              expect(result.status).toBe(statuses[i]);

              // Verify duration matches
              expect(result.duration).toBe(durations[i]);
            });

            // Property: Results should be categorizable by status
            const passed = results.filter((r) => r.status === TestStatus.PASSED);
            const failed = results.filter((r) => r.status === TestStatus.FAILED);
            const skipped = results.filter((r) => r.status === TestStatus.SKIPPED);

            expect(passed.length + failed.length + skipped.length).toBe(length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse Mocha output and return structured results with passed, failed, and skipped tests', () => {
      // **Feature: mcp-testing-server, Property 1: Test execution produces structured results**

      fc.assert(
        fc.property(
          // Generate test names
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          // Generate test statuses
          fc.array(fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED, TestStatus.SKIPPED), {
            minLength: 1,
            maxLength: 10,
          }),
          // Generate test durations
          fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 10 }),
          (testNames, testStatuses, testDurations) => {
            // Ensure arrays are same length
            const length = Math.min(testNames.length, testStatuses.length, testDurations.length);
            const names = testNames.slice(0, length);
            const statuses = testStatuses.slice(0, length);
            const durations = testDurations.slice(0, length);

            // Generate Mocha JSON output
            const mochaOutput = {
              tests: names.map((name, i) => ({
                title: name,
                fullTitle: name,
                pass: statuses[i] === TestStatus.PASSED,
                fail: statuses[i] === TestStatus.FAILED,
                pending: statuses[i] === TestStatus.SKIPPED,
                duration: durations[i],
                file: 'test/example.test.js',
                err:
                  statuses[i] === TestStatus.FAILED
                    ? { message: 'Test failed', stack: '' }
                    : undefined,
              })),
            };

            const parser = new ResultParser();
            const results = parser.parseResults(JSON.stringify(mochaOutput), TestFramework.MOCHA);

            // Property: Parser should return structured results
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(length);

            // Property: Each result should have required fields
            results.forEach((result, i) => {
              expect(result).toHaveProperty('id');
              expect(result).toHaveProperty('name');
              expect(result).toHaveProperty('fullName');
              expect(result).toHaveProperty('status');
              expect(result).toHaveProperty('duration');
              expect(result).toHaveProperty('file');
              expect(result).toHaveProperty('line');
              expect(result).toHaveProperty('suite');
              expect(result).toHaveProperty('tags');
              expect(result).toHaveProperty('metadata');
              expect(result).toHaveProperty('timestamp');

              // Verify status matches
              expect(result.status).toBe(statuses[i]);

              // Verify duration matches
              expect(result.duration).toBe(durations[i]);
            });

            // Property: Results should be categorizable by status
            const passed = results.filter((r) => r.status === TestStatus.PASSED);
            const failed = results.filter((r) => r.status === TestStatus.FAILED);
            const skipped = results.filter((r) => r.status === TestStatus.SKIPPED);

            expect(passed.length + failed.length + skipped.length).toBe(length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse Pytest output and return structured results with passed, failed, and skipped tests', () => {
      // **Feature: mcp-testing-server, Property 1: Test execution produces structured results**

      fc.assert(
        fc.property(
          // Generate test names
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          // Generate test statuses
          fc.array(fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED, TestStatus.SKIPPED), {
            minLength: 1,
            maxLength: 10,
          }),
          // Generate test durations
          fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 10 }),
          (testNames, testStatuses, testDurations) => {
            // Ensure arrays are same length
            const length = Math.min(testNames.length, testStatuses.length, testDurations.length);
            const names = testNames.slice(0, length);
            const statuses = testStatuses.slice(0, length);
            const durations = testDurations.slice(0, length);

            // Generate Pytest JSON output
            const pytestOutput = {
              tests: names.map((name, i) => ({
                name: name,
                nodeid: `test_example.py::${name}`,
                outcome:
                  statuses[i] === TestStatus.PASSED
                    ? 'passed'
                    : statuses[i] === TestStatus.FAILED
                      ? 'failed'
                      : 'skipped',
                call: {
                  duration: durations[i] / 1000, // Pytest uses seconds
                  longrepr: statuses[i] === TestStatus.FAILED ? 'Test failed' : undefined,
                },
                file: 'test_example.py',
                lineno: i + 1,
                markers: [],
              })),
            };

            const parser = new ResultParser();
            const results = parser.parseResults(JSON.stringify(pytestOutput), TestFramework.PYTEST);

            // Property: Parser should return structured results
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(length);

            // Property: Each result should have required fields
            results.forEach((result, i) => {
              expect(result).toHaveProperty('id');
              expect(result).toHaveProperty('name');
              expect(result).toHaveProperty('fullName');
              expect(result).toHaveProperty('status');
              expect(result).toHaveProperty('duration');
              expect(result).toHaveProperty('file');
              expect(result).toHaveProperty('line');
              expect(result).toHaveProperty('suite');
              expect(result).toHaveProperty('tags');
              expect(result).toHaveProperty('metadata');
              expect(result).toHaveProperty('timestamp');

              // Verify status matches
              expect(result.status).toBe(statuses[i]);

              // Verify duration matches (convert back to milliseconds)
              expect(result.duration).toBe(durations[i] / 1000);
            });

            // Property: Results should be categorizable by status
            const passed = results.filter((r) => r.status === TestStatus.PASSED);
            const failed = results.filter((r) => r.status === TestStatus.FAILED);
            const skipped = results.filter((r) => r.status === TestStatus.SKIPPED);

            expect(passed.length + failed.length + skipped.length).toBe(length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse Vitest output and return structured results with passed, failed, and skipped tests', () => {
      // **Feature: mcp-testing-server, Property 1: Test execution produces structured results**

      fc.assert(
        fc.property(
          // Generate test names
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          // Generate test statuses
          fc.array(fc.constantFrom(TestStatus.PASSED, TestStatus.FAILED, TestStatus.SKIPPED), {
            minLength: 1,
            maxLength: 10,
          }),
          // Generate test durations
          fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 10 }),
          (testNames, testStatuses, testDurations) => {
            // Ensure arrays are same length
            const length = Math.min(testNames.length, testStatuses.length, testDurations.length);
            const names = testNames.slice(0, length);
            const statuses = testStatuses.slice(0, length);
            const durations = testDurations.slice(0, length);

            // Generate Vitest JSON output (similar to Jest)
            const vitestOutput = {
              testResults: [
                {
                  name: 'test/example.test.ts',
                  assertionResults: names.map((name, i) => ({
                    title: name,
                    fullName: name,
                    status:
                      statuses[i] === TestStatus.PASSED
                        ? 'passed'
                        : statuses[i] === TestStatus.FAILED
                          ? 'failed'
                          : 'skipped',
                    duration: durations[i],
                    ancestorTitles: [],
                    location: { line: i + 1 },
                    failureMessages: statuses[i] === TestStatus.FAILED ? ['Test failed'] : [],
                  })),
                },
              ],
            };

            const parser = new ResultParser();
            const results = parser.parseResults(JSON.stringify(vitestOutput), TestFramework.VITEST);

            // Property: Parser should return structured results
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(length);

            // Property: Each result should have required fields
            results.forEach((result, i) => {
              expect(result).toHaveProperty('id');
              expect(result).toHaveProperty('name');
              expect(result).toHaveProperty('fullName');
              expect(result).toHaveProperty('status');
              expect(result).toHaveProperty('duration');
              expect(result).toHaveProperty('file');
              expect(result).toHaveProperty('line');
              expect(result).toHaveProperty('suite');
              expect(result).toHaveProperty('tags');
              expect(result).toHaveProperty('metadata');
              expect(result).toHaveProperty('timestamp');

              // Verify status matches
              expect(result.status).toBe(statuses[i]);

              // Verify duration matches
              expect(result.duration).toBe(durations[i]);

              // Verify framework is Vitest
              expect(result.metadata.framework).toBe(TestFramework.VITEST);
            });

            // Property: Results should be categorizable by status
            const passed = results.filter((r) => r.status === TestStatus.PASSED);
            const failed = results.filter((r) => r.status === TestStatus.FAILED);
            const skipped = results.filter((r) => r.status === TestStatus.SKIPPED);

            expect(passed.length + failed.length + skipped.length).toBe(length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle error information in failed tests', () => {
      // **Feature: mcp-testing-server, Property 1: Test execution produces structured results**

      fc.assert(
        fc.property(
          // Generate test name
          fc.string({ minLength: 5, maxLength: 50 }),
          // Generate error message
          fc.string({ minLength: 10, maxLength: 200 }),
          // Generate expected/actual values
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (testName, errorMessage, expected, actual) => {
            // Generate Jest JSON output with error
            const jestOutput = {
              testResults: [
                {
                  name: 'test/example.test.ts',
                  assertionResults: [
                    {
                      title: testName,
                      fullName: testName,
                      status: 'failed',
                      duration: 100,
                      ancestorTitles: [],
                      location: { line: 1 },
                      failureMessages: [
                        `${errorMessage}\nExpected: ${expected}\nReceived: ${actual}`,
                      ],
                    },
                  ],
                },
              ],
            };

            const parser = new ResultParser();
            const results = parser.parseResults(JSON.stringify(jestOutput), TestFramework.JEST);

            // Property: Failed tests should include error information
            expect(results.length).toBe(1);
            expect(results[0].status).toBe(TestStatus.FAILED);
            expect(results[0].error).toBeDefined();
            expect(results[0].error?.message).toBeTruthy();
            expect(results[0].error?.stack).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve test metadata across all frameworks', () => {
      // **Feature: mcp-testing-server, Property 1: Test execution produces structured results**

      fc.assert(
        fc.property(
          // Generate framework
          fc.constantFrom(
            TestFramework.JEST,
            TestFramework.MOCHA,
            TestFramework.PYTEST,
            TestFramework.VITEST
          ),
          // Generate test name
          fc.string({ minLength: 5, maxLength: 50 }),
          // Generate duration
          fc.integer({ min: 0, max: 10000 }),
          (framework, testName, duration) => {
            let output: string;

            // Generate appropriate output for each framework
            switch (framework) {
              case TestFramework.JEST:
              case TestFramework.VITEST:
                output = JSON.stringify({
                  testResults: [
                    {
                      name: 'test/example.test.ts',
                      assertionResults: [
                        {
                          title: testName,
                          fullName: testName,
                          status: 'passed',
                          duration: duration,
                          ancestorTitles: [],
                          location: { line: 1 },
                          failureMessages: [],
                        },
                      ],
                    },
                  ],
                });
                break;
              case TestFramework.MOCHA:
                output = JSON.stringify({
                  tests: [
                    {
                      title: testName,
                      fullTitle: testName,
                      pass: true,
                      fail: false,
                      pending: false,
                      duration: duration,
                      file: 'test/example.test.js',
                    },
                  ],
                });
                break;
              case TestFramework.PYTEST:
                output = JSON.stringify({
                  tests: [
                    {
                      name: testName,
                      nodeid: `test_example.py::${testName}`,
                      outcome: 'passed',
                      call: {
                        duration: duration / 1000,
                      },
                      file: 'test_example.py',
                      lineno: 1,
                      markers: [],
                    },
                  ],
                });
                break;
            }

            const parser = new ResultParser();
            const results = parser.parseResults(output, framework);

            // Property: All results should have metadata with framework information
            expect(results.length).toBeGreaterThan(0);
            results.forEach((result) => {
              expect(result.metadata).toBeDefined();
              expect(result.metadata.framework).toBe(framework);
              expect(result.metadata).toHaveProperty('retries');
              expect(result.metadata).toHaveProperty('flaky');
              expect(result.metadata).toHaveProperty('slow');
              expect(result.metadata).toHaveProperty('tags');
              expect(result.metadata).toHaveProperty('customData');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
