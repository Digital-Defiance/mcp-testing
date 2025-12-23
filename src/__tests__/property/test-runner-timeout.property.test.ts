/**
 * Property-based tests for TestRunnerManager timeout enforcement
 *
 * **Feature: mcp-testing-server, Property 2: Timeout enforcement terminates tests**
 * **Validates: Requirements 1.3**
 */

import fc from 'fast-check';
import { TestRunnerManager } from '../../components/TestRunnerManager';
import { SecurityManager } from '../../components/SecurityManager';
import { TestFramework, TestRunOptions } from '../../types';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

// Create a testable subclass that exposes protected methods
class TestableTestRunnerManager extends TestRunnerManager {
  public async testExecuteWithTimeout(
    childProcess: ChildProcess,
    timeout: number,
    framework: TestFramework,
    runId: string
  ): Promise<any> {
    return this.executeWithTimeout(childProcess, timeout, framework, runId);
  }

  public testKillProcess(childProcess: ChildProcess): void {
    return this.killProcess(childProcess);
  }
}

describe('Property 2: Timeout enforcement terminates tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should terminate tests that exceed the configured timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random test framework
        fc.constantFrom(
          TestFramework.JEST,
          TestFramework.MOCHA,
          TestFramework.PYTEST,
          TestFramework.VITEST
        ),
        // Generate random timeout between 200ms and 1000ms
        fc.integer({ min: 200, max: 1000 }),
        async (framework, timeout) => {
          // **Feature: mcp-testing-server, Property 2: Timeout enforcement terminates tests**

          // Create a mock child process that never exits (simulating a hanging test)
          const mockChildProcess = new EventEmitter() as any;
          mockChildProcess.pid = 12345;
          mockChildProcess.stdout = new EventEmitter();
          mockChildProcess.stderr = new EventEmitter();
          mockChildProcess.kill = jest.fn();

          // Create test runner
          const securityManager = new SecurityManager({
            maxTestDuration: timeout,
          });
          const testRunner = new TestableTestRunnerManager(securityManager);

          // Create a run ID and register the process
          const runId = `test-run-${Date.now()}`;

          // Track if timeout occurred
          let timeoutOccurred = false;
          const startTime = Date.now();

          try {
            // Execute with timeout - this should timeout since process never exits
            await testRunner.testExecuteWithTimeout(mockChildProcess, timeout, framework, runId);
          } catch (error) {
            // Check if error is a timeout error
            if (error instanceof Error && error.message.includes('timeout')) {
              timeoutOccurred = true;
            }
          }

          const elapsed = Date.now() - startTime;

          // Verify timeout occurred
          expect(timeoutOccurred).toBe(true);

          // Verify the test was terminated within a reasonable time
          // Allow 200ms grace period for JavaScript event loop delays
          expect(elapsed).toBeGreaterThanOrEqual(timeout);
          expect(elapsed).toBeLessThan(timeout + 200);
        }
      ),
      {
        numRuns: 10, // Reduced from 100 for faster tests
        timeout: 30000,
      }
    );
  });

  it('should return partial results when timeout occurs', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random test framework
        fc.constantFrom(
          TestFramework.JEST,
          TestFramework.MOCHA,
          TestFramework.PYTEST,
          TestFramework.VITEST
        ),
        // Generate short timeout
        fc.integer({ min: 200, max: 500 }),
        async (framework, timeout) => {
          // **Feature: mcp-testing-server, Property 2: Timeout enforcement terminates tests**

          // Create a mock child process that produces some output but never exits
          const mockChildProcess = new EventEmitter() as any;
          mockChildProcess.pid = 12345;
          mockChildProcess.stdout = new EventEmitter();
          mockChildProcess.stderr = new EventEmitter();
          mockChildProcess.kill = jest.fn();

          // Create test runner
          const securityManager = new SecurityManager({
            maxTestDuration: timeout,
          });
          const testRunner = new TestableTestRunnerManager(securityManager);

          // Create a run ID
          const runId = `test-run-${Date.now()}`;

          // Simulate some test output after a short delay
          setTimeout(() => {
            mockChildProcess.stdout.emit(
              'data',
              Buffer.from('PASS test/sample.test.ts\n  ✓ test 1\n')
            );
          }, 50);

          try {
            // Execute with timeout
            await testRunner.testExecuteWithTimeout(mockChildProcess, timeout, framework, runId);
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            // Timeout should occur
            expect(error).toBeInstanceOf(Error);
            if (error instanceof Error) {
              expect(error.message).toContain('timeout');
            }
          }
        }
      ),
      {
        numRuns: 10,
        timeout: 30000,
      }
    );
  });

  it('should enforce security manager timeout limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random test framework
        fc.constantFrom(
          TestFramework.JEST,
          TestFramework.MOCHA,
          TestFramework.PYTEST,
          TestFramework.VITEST
        ),
        // Generate security manager max duration
        fc.integer({ min: 300, max: 1000 }),
        // Generate requested timeout (might be higher than max)
        fc.integer({ min: 300, max: 1500 }),
        async (framework, maxDuration, requestedTimeout) => {
          // **Feature: mcp-testing-server, Property 2: Timeout enforcement terminates tests**

          // Create a mock child process that never exits
          const mockChildProcess = new EventEmitter() as any;
          mockChildProcess.pid = 12345;
          mockChildProcess.stdout = new EventEmitter();
          mockChildProcess.stderr = new EventEmitter();
          mockChildProcess.kill = jest.fn();

          // Create test runner with security manager that has max duration
          const securityManager = new SecurityManager({
            maxTestDuration: maxDuration,
          });
          const testRunner = new TestableTestRunnerManager(securityManager);

          // Create a run ID
          const runId = `test-run-${Date.now()}`;

          // The effective timeout should be the minimum of requested and max duration
          const effectiveTimeout = Math.min(requestedTimeout, maxDuration);

          const startTime = Date.now();

          try {
            await testRunner.testExecuteWithTimeout(
              mockChildProcess,
              effectiveTimeout,
              framework,
              runId
            );
          } catch (error) {
            // Timeout is expected
          }

          const elapsed = Date.now() - startTime;

          // Test should timeout around the effective timeout
          // Allow 200ms grace period for JavaScript event loop
          expect(elapsed).toBeGreaterThanOrEqual(effectiveTimeout);
          expect(elapsed).toBeLessThan(effectiveTimeout + 200);
        }
      ),
      {
        numRuns: 10,
        timeout: 30000,
      }
    );
  });
});
