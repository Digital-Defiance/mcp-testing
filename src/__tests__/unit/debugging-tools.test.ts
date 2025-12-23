/**
 * Unit tests for debugging tools
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';

describe('Debugging Tools', () => {
  let server: MCPTestingServer;

  beforeEach(() => {
    server = new MCPTestingServer();
  });

  describe('test_debug', () => {
    it('should prepare debug information for a test', async () => {
      const args = {
        framework: TestFramework.JEST,
        testPath: 'src/example.test.ts',
        testName: 'should do something',
      };

      const result = await (server as any).handleTestDebug(args);

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('debugInfo');
      expect(result.data.debugInfo).toHaveProperty('file');
      expect(result.data.debugInfo).toHaveProperty('line');
      expect(result.data.debugInfo).toHaveProperty('testName');
      expect(result.data.debugInfo.testName).toBe('should do something');
      expect(result.data).toHaveProperty('message');
      expect(result.data).toHaveProperty('instructions');
      expect(Array.isArray(result.data.instructions)).toBe(true);
    });

    it('should include error information when available', async () => {
      const args = {
        framework: TestFramework.JEST,
        testPath: 'src/example.test.ts',
        testName: 'should fail',
      };

      const result = await (server as any).handleTestDebug(args);

      expect(result.status).toBe('success');
      expect(result.data.errorInfo).toBeTruthy();
      expect(result.data.errorInfo).toHaveProperty('message');
      expect(result.data.errorInfo).toHaveProperty('stack');
    });
  });

  describe('test_analyze_failure', () => {
    it('should analyze test failure without error message', async () => {
      const args = {
        framework: TestFramework.JEST,
        testPath: 'src/example.test.ts',
        testName: 'should fail',
      };

      const result = await (server as any).handleTestAnalyzeFailure(args);

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('testName');
      expect(result.data).toHaveProperty('testPath');
      expect(result.data).toHaveProperty('location');
      expect(result.data).toHaveProperty('rootCauses');
      expect(result.data).toHaveProperty('summary');
      expect(Array.isArray(result.data.rootCauses)).toBe(true);
    });

    it('should analyze test failure with error message', async () => {
      const args = {
        framework: TestFramework.JEST,
        testPath: 'src/example.test.ts',
        testName: 'should fail',
        errorMessage: 'Expected 5 to equal 10',
      };

      const result = await (server as any).handleTestAnalyzeFailure(args);

      expect(result.status).toBe('success');
      expect(result.data.errorInfo).toBeTruthy();
      expect(result.data.errorInfo.message).toBe('Expected 5 to equal 10');
      expect(result.data.rootCauses.length).toBeGreaterThan(0);
    });

    it('should extract failure location from stack trace', async () => {
      const args = {
        framework: TestFramework.JEST,
        testPath: 'src/example.test.ts',
        testName: 'should fail',
        errorMessage: 'Test failed at line 42',
      };

      const result = await (server as any).handleTestAnalyzeFailure(args);

      expect(result.status).toBe('success');
      expect(result.data.location).toHaveProperty('file');
      expect(result.data.location).toHaveProperty('line');
      expect(result.data.location).toHaveProperty('column');
    });

    it('should provide root cause suggestions', async () => {
      const args = {
        framework: TestFramework.JEST,
        testPath: 'src/example.test.ts',
        testName: 'should fail',
        errorMessage: 'TypeError: Cannot read property "foo" of undefined',
      };

      const result = await (server as any).handleTestAnalyzeFailure(args);

      expect(result.status).toBe('success');
      expect(result.data.rootCauses.length).toBeGreaterThan(0);
      const rootCause = result.data.rootCauses[0];
      expect(rootCause).toHaveProperty('type');
      expect(rootCause).toHaveProperty('confidence');
      expect(rootCause).toHaveProperty('description');
      expect(rootCause).toHaveProperty('suggestedFix');
    });
  });

  describe('test_compare_values', () => {
    it('should compare primitive values', async () => {
      const args = {
        expected: 5,
        actual: 10,
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('expected');
      expect(result.data).toHaveProperty('actual');
      expect(result.data).toHaveProperty('type');
      expect(result.data).toHaveProperty('diff');
      expect(result.data).toHaveProperty('differences');
      expect(result.data).toHaveProperty('areEqual');
      expect(result.data.areEqual).toBe(false);
      expect(result.data.differences.length).toBeGreaterThan(0);
    });

    it('should compare equal values', async () => {
      const args = {
        expected: 'hello',
        actual: 'hello',
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.areEqual).toBe(true);
      expect(result.data.differences.length).toBe(0);
    });

    it('should compare objects', async () => {
      const args = {
        expected: { name: 'John', age: 30 },
        actual: { name: 'John', age: 25 },
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.type).toBe('object');
      expect(result.data.areEqual).toBe(false);
      expect(result.data.differences.length).toBeGreaterThan(0);
      expect(result.data.differences[0].path).toContain('age');
    });

    it('should compare arrays', async () => {
      const args = {
        expected: [1, 2, 3],
        actual: [1, 2, 4],
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.type).toBe('array');
      expect(result.data.areEqual).toBe(false);
      expect(result.data.differences.length).toBeGreaterThan(0);
    });

    it('should detect missing properties', async () => {
      const args = {
        expected: { name: 'John', age: 30, city: 'NYC' },
        actual: { name: 'John', age: 30 },
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.differences.length).toBeGreaterThan(0);
      const missingDiff = result.data.differences.find((d: any) => d.type === 'missing');
      expect(missingDiff).toBeTruthy();
      expect(missingDiff.path).toContain('city');
    });

    it('should detect extra properties', async () => {
      const args = {
        expected: { name: 'John' },
        actual: { name: 'John', age: 30 },
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.differences.length).toBeGreaterThan(0);
      const extraDiff = result.data.differences.find((d: any) => d.type === 'extra');
      expect(extraDiff).toBeTruthy();
      expect(extraDiff.path).toContain('age');
    });

    it('should detect type mismatches', async () => {
      const args = {
        expected: '5',
        actual: 5,
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.differences.length).toBeGreaterThan(0);
      const typeMismatch = result.data.differences.find((d: any) => d.type === 'type-mismatch');
      expect(typeMismatch).toBeTruthy();
    });

    it('should handle null and undefined', async () => {
      const args = {
        expected: null,
        actual: undefined,
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.areEqual).toBe(false);
      expect(result.data.differences.length).toBeGreaterThan(0);
    });

    it('should generate readable diff string', async () => {
      const args = {
        expected: { x: 1, y: 2 },
        actual: { x: 1, y: 3 },
      };

      const result = await (server as any).handleTestCompareValues(args);

      expect(result.status).toBe('success');
      expect(result.data.diff).toBeTruthy();
      expect(typeof result.data.diff).toBe('string');
      expect(result.data.diff).toContain('y');
    });
  });
});
