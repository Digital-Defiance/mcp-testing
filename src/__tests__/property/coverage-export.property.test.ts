/**
 * Property-based tests for coverage export
 *
 * Tests Property 9 from the design document:
 * - Property 9: Coverage export supports multiple formats
 *
 * Validates Requirements 2.5
 */

import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CoverageAnalyzer } from '../../components/CoverageAnalyzer';
import { TestFramework, TestResult, ReportFormat } from '../../types';

describe('Coverage Export Properties', () => {
  let tempDir: string;
  let coverageAnalyzer: CoverageAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-export-test-'));
    coverageAnalyzer = new CoverageAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 9: Coverage export supports multiple formats', () => {
    it('should successfully generate coverage reports in JSON, HTML, LCOV, and Cobertura formats', async () => {
      // **Feature: mcp-testing-server, Property 9: Coverage export supports multiple formats**

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

            const testResults: TestResult[] = [];
            const coverageReport = await coverageAnalyzer.analyzeCoverage(
              testResults,
              TestFramework.JEST
            );

            // Property: JSON format should be valid JSON
            const jsonReport = await coverageAnalyzer.generateReport(
              coverageReport,
              ReportFormat.JSON
            );
            expect(() => JSON.parse(jsonReport)).not.toThrow();
            const parsedJson = JSON.parse(jsonReport);
            expect(parsedJson).toHaveProperty('overall');
            expect(parsedJson).toHaveProperty('files');
            expect(parsedJson).toHaveProperty('timestamp');
            expect(parsedJson).toHaveProperty('framework');

            // Property: HTML format should contain HTML tags
            const htmlReport = await coverageAnalyzer.generateReport(
              coverageReport,
              ReportFormat.HTML
            );
            expect(htmlReport).toContain('<!DOCTYPE html>');
            expect(htmlReport).toContain('<html>');
            expect(htmlReport).toContain('</html>');
            expect(htmlReport).toContain('Coverage Report');

            // Property: LCOV format should contain LCOV markers
            const lcovReport = await coverageAnalyzer.generateReport(
              coverageReport,
              ReportFormat.LCOV
            );
            expect(lcovReport).toContain('TN:');
            expect(lcovReport).toContain('SF:');
            expect(lcovReport).toContain('end_of_record');

            // Property: Cobertura format should be valid XML
            const coberturaReport = await coverageAnalyzer.generateReport(
              coverageReport,
              ReportFormat.COBERTURA
            );
            expect(coberturaReport).toContain('<?xml version="1.0"');
            expect(coberturaReport).toContain('<coverage');
            expect(coberturaReport).toContain('</coverage>');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all coverage metrics in exported reports', async () => {
      // **Feature: mcp-testing-server, Property 9: Coverage export supports multiple formats**

      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 50, max: 100 }), async (coveragePercent) => {
          const coverageData: any = {
            'src/file.ts': {
              path: 'src/file.ts',
              statementMap: {},
              s: {},
              fnMap: { '0': { name: 'testFunc', line: 5 } },
              f: { '0': 1 },
              branchMap: {},
              b: {},
            },
          };

          for (let i = 0; i < 100; i++) {
            coverageData['src/file.ts'].statementMap[i] = {
              start: { line: i + 1 },
              end: { line: i + 1 },
            };
            coverageData['src/file.ts'].s[i] = i < coveragePercent ? 1 : 0;
          }

          const coverageFile = path.join(tempDir, 'coverage-final.json');
          await fs.writeFile(coverageFile, JSON.stringify(coverageData));

          const testResults: TestResult[] = [];
          const coverageReport = await coverageAnalyzer.analyzeCoverage(
            testResults,
            TestFramework.JEST
          );

          // Property: JSON report should include all metrics
          const jsonReport = await coverageAnalyzer.generateReport(
            coverageReport,
            ReportFormat.JSON
          );
          const parsedJson = JSON.parse(jsonReport);
          expect(parsedJson.overall.lines.percentage).toBeGreaterThanOrEqual(0);
          expect(parsedJson.overall.lines.percentage).toBeLessThanOrEqual(100);

          // Property: HTML report should display metrics
          const htmlReport = await coverageAnalyzer.generateReport(
            coverageReport,
            ReportFormat.HTML
          );
          expect(htmlReport).toContain('Lines');
          expect(htmlReport).toContain('Branches');
          expect(htmlReport).toContain('Functions');
          expect(htmlReport).toContain('Statements');

          // Property: LCOV report should include line and function data
          const lcovReport = await coverageAnalyzer.generateReport(
            coverageReport,
            ReportFormat.LCOV
          );
          expect(lcovReport).toContain('LF:'); // Lines found
          expect(lcovReport).toContain('LH:'); // Lines hit
          expect(lcovReport).toContain('FNF:'); // Functions found
          expect(lcovReport).toContain('FNH:'); // Functions hit

          // Property: Cobertura report should include line-rate and branch-rate
          const coberturaReport = await coverageAnalyzer.generateReport(
            coverageReport,
            ReportFormat.COBERTURA
          );
          expect(coberturaReport).toContain('line-rate=');
          expect(coberturaReport).toContain('branch-rate=');
        }),
        { numRuns: 100 }
      );
    });
  });
});
