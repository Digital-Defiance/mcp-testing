/**
 * Property-based tests for coverage analysis
 *
 * Tests Properties 5-8 from the design document:
 * - Property 5: Coverage analysis returns all metrics
 * - Property 6: Threshold violations are reported
 * - Property 7: Coverage gaps are identified
 * - Property 8: Coverage trends are calculated
 *
 * Validates Requirements 2.1, 2.2, 2.3, 2.4
 */

import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CoverageAnalyzer } from '../../components/CoverageAnalyzer';
import { TestFramework, TestResult, TestStatus, CoverageThresholds, TimeRange } from '../../types';

describe('Coverage Analysis Properties', () => {
  let tempDir: string;
  let coverageAnalyzer: CoverageAnalyzer;

  beforeEach(async () => {
    // Create temporary directory for coverage data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-test-'));
    coverageAnalyzer = new CoverageAnalyzer(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 5: Coverage analysis returns all metrics', () => {
    it('should return line, branch, function, and statement coverage metrics for any valid coverage data', async () => {
      // **Feature: mcp-testing-server, Property 5: Coverage analysis returns all metrics**

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 10, max: 50 }),
          fc.integer({ min: 0, max: 100 }),
          async (numFiles, linesPerFile, coveragePercent) => {
            const coverageData: any = {};

            for (let fileIdx = 0; fileIdx < numFiles; fileIdx++) {
              const filePath = `src/file${fileIdx}.ts`;
              const statementMap: any = {};
              const s: any = {};
              const fnMap: any = {};
              const f: any = {};
              const branchMap: any = {};
              const b: any = {};

              for (let line = 1; line <= linesPerFile; line++) {
                const stmtId = `${line}`;
                statementMap[stmtId] = { start: { line }, end: { line } };
                s[stmtId] = Math.random() * 100 < coveragePercent ? 1 : 0;
              }

              const numFunctions = Math.max(1, Math.floor(linesPerFile / 10));
              for (let fnIdx = 0; fnIdx < numFunctions; fnIdx++) {
                const fnId = `${fnIdx}`;
                fnMap[fnId] = { name: `function${fnIdx}`, line: (fnIdx + 1) * 5 };
                f[fnId] = Math.random() * 100 < coveragePercent ? 1 : 0;
              }

              const numBranches = Math.max(1, Math.floor(linesPerFile / 5));
              for (let brIdx = 0; brIdx < numBranches; brIdx++) {
                const brId = `${brIdx}`;
                branchMap[brId] = {
                  line: (brIdx + 1) * 3,
                  locations: [
                    { start: { line: (brIdx + 1) * 3 } },
                    { start: { line: (brIdx + 1) * 3 } },
                  ],
                };
                b[brId] = [
                  Math.random() * 100 < coveragePercent ? 1 : 0,
                  Math.random() * 100 < coveragePercent ? 1 : 0,
                ];
              }

              coverageData[filePath] = { path: filePath, statementMap, s, fnMap, f, branchMap, b };
            }

            const coverageFile = path.join(tempDir, 'coverage-final.json');
            await fs.writeFile(coverageFile, JSON.stringify(coverageData));

            const testResults: TestResult[] = [
              {
                id: 'test-1',
                name: 'test 1',
                fullName: 'test 1',
                status: TestStatus.PASSED,
                duration: 100,
                file: 'test/example.test.ts',
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
              },
            ];

            const coverageReport = await coverageAnalyzer.analyzeCoverage(
              testResults,
              TestFramework.JEST
            );

            expect(coverageReport.overall).toBeDefined();
            expect(coverageReport.overall.lines).toBeDefined();
            expect(coverageReport.overall.branches).toBeDefined();
            expect(coverageReport.overall.functions).toBeDefined();
            expect(coverageReport.overall.statements).toBeDefined();

            expect(coverageReport.overall.lines).toHaveProperty('total');
            expect(coverageReport.overall.lines).toHaveProperty('covered');
            expect(coverageReport.overall.lines).toHaveProperty('percentage');

            expect(coverageReport.overall.lines.percentage).toBeGreaterThanOrEqual(0);
            expect(coverageReport.overall.lines.percentage).toBeLessThanOrEqual(100);
            expect(coverageReport.overall.lines.covered).toBeLessThanOrEqual(
              coverageReport.overall.lines.total
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Threshold violations are reported', () => {
    it('should report violations when coverage falls below configured thresholds', async () => {
      // **Feature: mcp-testing-server, Property 6: Threshold violations are reported**

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          async (actualCoverage, thresholdBase) => {
            const threshold = Math.max(actualCoverage + 1, thresholdBase);

            const coverageData: any = {
              'src/file.ts': {
                path: 'src/file.ts',
                statementMap: {},
                s: {},
                fnMap: {},
                f: {},
                branchMap: {},
                b: {},
              },
            };

            for (let i = 0; i < 100; i++) {
              coverageData['src/file.ts'].statementMap[i] = {
                start: { line: i + 1 },
                end: { line: i + 1 },
              };
              coverageData['src/file.ts'].s[i] = i < actualCoverage ? 1 : 0;
            }

            const coverageFile = path.join(tempDir, 'coverage-final.json');
            await fs.writeFile(coverageFile, JSON.stringify(coverageData));

            const testResults: TestResult[] = [];
            const coverageReport = await coverageAnalyzer.analyzeCoverage(
              testResults,
              TestFramework.JEST
            );

            const thresholds: CoverageThresholds = {
              lines: threshold,
              branches: threshold,
              functions: threshold,
              statements: threshold,
            };

            const violations = coverageAnalyzer.checkThresholds(coverageReport, thresholds);

            if (actualCoverage < threshold) {
              expect(violations.length).toBeGreaterThan(0);
              violations.forEach((violation) => {
                expect(violation).toHaveProperty('metric');
                expect(violation).toHaveProperty('actual');
                expect(violation).toHaveProperty('threshold');
                expect(violation.actual).toBeLessThan(violation.threshold);
              });
            } else {
              expect(violations.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Coverage gaps are identified', () => {
    it('should identify all uncovered code segments with file paths and line numbers', async () => {
      // **Feature: mcp-testing-server, Property 7: Coverage gaps are identified**

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 10, maxLength: 50 }),
          async (coveragePattern) => {
            const coverageData: any = {
              'src/file.ts': {
                path: 'src/file.ts',
                statementMap: {},
                s: {},
                fnMap: {},
                f: {},
                branchMap: {},
                b: {},
              },
            };

            coveragePattern.forEach((covered, i) => {
              coverageData['src/file.ts'].statementMap[i] = {
                start: { line: i + 1 },
                end: { line: i + 1 },
              };
              coverageData['src/file.ts'].s[i] = covered ? 1 : 0;
            });

            const coverageFile = path.join(tempDir, 'coverage-final.json');
            await fs.writeFile(coverageFile, JSON.stringify(coverageData));

            const testResults: TestResult[] = [];
            const coverageReport = await coverageAnalyzer.analyzeCoverage(
              testResults,
              TestFramework.JEST
            );
            const gaps = coverageAnalyzer.getCoverageGaps(coverageReport);

            gaps.forEach((gap) => {
              expect(gap.file).toBeTruthy();
              expect(typeof gap.file).toBe('string');
              expect(gap.startLine).toBeGreaterThan(0);
              expect(gap.endLine).toBeGreaterThan(0);
              expect(gap.startLine).toBeLessThanOrEqual(gap.endLine);
              expect(['line', 'branch', 'function']).toContain(gap.type);
              expect(gap.suggestion).toBeTruthy();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Coverage trends are calculated', () => {
    it('should compare current coverage with historical data and return trend analysis', async () => {
      // **Feature: mcp-testing-server, Property 8: Coverage trends are calculated**

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 10 }),
          async (numDataPoints, coveragePercentages) => {
            // Create a fresh temp directory for this test iteration
            const testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-trend-test-'));
            const testAnalyzer = new CoverageAnalyzer(testTempDir);

            try {
              const actualDataPoints = Math.min(numDataPoints, coveragePercentages.length);
              const now = Date.now();

              for (let i = 0; i < actualDataPoints; i++) {
                const coverage = coveragePercentages[i];
                const coverageData: any = {
                  'src/file.ts': {
                    path: 'src/file.ts',
                    statementMap: {},
                    s: {},
                    fnMap: {},
                    f: {},
                    branchMap: {},
                    b: {},
                  },
                };

                for (let j = 0; j < 100; j++) {
                  coverageData['src/file.ts'].statementMap[j] = {
                    start: { line: j + 1 },
                    end: { line: j + 1 },
                  };
                  coverageData['src/file.ts'].s[j] = j < coverage ? 1 : 0;
                }

                const coverageFile = path.join(testTempDir, 'coverage-final.json');
                await fs.writeFile(coverageFile, JSON.stringify(coverageData));

                const testResults: TestResult[] = [];
                await testAnalyzer.analyzeCoverage(testResults, TestFramework.JEST);
              }

              // Use a time range that includes all trends (from 1 hour ago to 1 hour in future)
              const timeRange: TimeRange = {
                start: new Date(now - 60 * 60 * 1000).toISOString(),
                end: new Date(now + 60 * 60 * 1000).toISOString(),
              };

              const trends = await testAnalyzer.getCoverageTrends(timeRange);

              // Property: Should return trends for the data points we created
              expect(trends.length).toBeGreaterThan(0);
              expect(trends.length).toBeLessThanOrEqual(actualDataPoints);

              // Property: Each trend should have required fields
              trends.forEach((trend) => {
                expect(trend).toHaveProperty('timestamp');
                expect(trend).toHaveProperty('metrics');
                expect(trend.metrics).toHaveProperty('lines');
                expect(trend.metrics).toHaveProperty('branches');
                expect(trend.metrics).toHaveProperty('functions');
                expect(trend.metrics).toHaveProperty('statements');
              });
            } finally {
              // Clean up test temp directory
              await fs.rm(testTempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
