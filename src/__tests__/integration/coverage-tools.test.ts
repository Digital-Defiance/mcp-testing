/**
 * Integration tests for coverage tools
 *
 * Tests the coverage tools through the MCP server interface
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';

describe('Coverage Tools Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-integration-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('test_coverage_analyze', () => {
    it('should analyze coverage and return metrics', async () => {
      // Create mock coverage data
      const coverageData = {
        'src/example.ts': {
          path: 'src/example.ts',
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } },
            '1': { start: { line: 2 }, end: { line: 2 } },
            '2': { start: { line: 3 }, end: { line: 3 } },
          },
          s: { '0': 1, '1': 1, '2': 0 },
          fnMap: {
            '0': { name: 'testFunc', line: 1 },
          },
          f: { '0': 1 },
          branchMap: {},
          b: {},
        },
      };

      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(coverageData));

      const server = new MCPTestingServer();
      const result = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('overall');
      expect(result.data.overall).toHaveProperty('lines');
      expect(result.data.overall).toHaveProperty('branches');
      expect(result.data.overall).toHaveProperty('functions');
      expect(result.data.overall).toHaveProperty('statements');
    });
  });

  describe('test_coverage_report', () => {
    it('should generate coverage report in JSON format', async () => {
      const coverageData = {
        'src/example.ts': {
          path: 'src/example.ts',
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } },
          },
          s: { '0': 1 },
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      };

      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(coverageData));

      const server = new MCPTestingServer();
      const result = await (server as any).handleCoverageReport({
        framework: TestFramework.JEST,
        format: 'json',
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('format');
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('metrics');
      expect(result.data.format).toBe('json');
    });
  });

  describe('test_coverage_gaps', () => {
    it('should identify coverage gaps', async () => {
      const coverageData = {
        'src/example.ts': {
          path: 'src/example.ts',
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } },
            '1': { start: { line: 2 }, end: { line: 2 } },
            '2': { start: { line: 3 }, end: { line: 3 } },
          },
          s: { '0': 1, '1': 0, '2': 0 },
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      };

      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(coverageData));

      const server = new MCPTestingServer();
      const result = await (server as any).handleCoverageGaps({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('gaps');
      expect(result.data).toHaveProperty('totalGaps');
      expect(result.data).toHaveProperty('gapsByType');
      expect(Array.isArray(result.data.gaps)).toBe(true);
    });
  });

  describe('test_coverage_trends', () => {
    it('should return coverage trends', async () => {
      const server = new MCPTestingServer();
      const result = await (server as any).handleCoverageTrends({
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('trends');
      expect(result.data).toHaveProperty('totalDataPoints');
      expect(result.data).toHaveProperty('timeRange');
      expect(Array.isArray(result.data.trends)).toBe(true);
    });
  });

  describe('test_coverage_export', () => {
    it('should export coverage to file', async () => {
      const coverageData = {
        'src/example.ts': {
          path: 'src/example.ts',
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } },
          },
          s: { '0': 1 },
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      };

      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(coverageData));

      const outputPath = path.join(tempDir, 'coverage-report.json');

      const server = new MCPTestingServer();
      const result = await (server as any).handleCoverageExport({
        framework: TestFramework.JEST,
        format: 'json',
        outputPath,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('outputPath');
      expect(result.data).toHaveProperty('format');
      expect(result.data).toHaveProperty('fileSize');
      expect(result.data).toHaveProperty('metrics');

      // Verify file was created
      const fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });
});
