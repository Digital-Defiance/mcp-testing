/**
 * Property-based tests for security enforcement
 *
 * Tests Properties 46-49 from the design document:
 * - Property 46: Non-allowlisted frameworks are rejected
 * - Property 47: Resource limits terminate processes
 * - Property 48: Operations are audit logged
 * - Property 49: Dangerous operations are blocked
 *
 * Validates Requirements 11.2, 11.3, 11.4, 11.5
 */

import fc from 'fast-check';
import { SecurityManager, Operation } from '../../components/SecurityManager';
import { TestFramework, TestRunOptions } from '../../types';

describe('Security Enforcement Properties', () => {
  describe('Property 46: Non-allowlisted frameworks are rejected', () => {
    it('should reject test execution requests with frameworks not in the allowlist', () => {
      // **Feature: mcp-testing-server, Property 46: Non-allowlisted frameworks are rejected**

      fc.assert(
        fc.property(
          // Generate test frameworks
          fc.constantFrom(
            TestFramework.JEST,
            TestFramework.MOCHA,
            TestFramework.PYTEST,
            TestFramework.VITEST,
            TestFramework.JASMINE,
            TestFramework.AVA
          ),
          // Generate allowed frameworks list (subset of all frameworks)
          fc.array(
            fc.constantFrom(
              TestFramework.JEST,
              TestFramework.MOCHA,
              TestFramework.PYTEST,
              TestFramework.VITEST
            ),
            { minLength: 1, maxLength: 4 }
          ),
          // Generate test path
          fc.constantFrom('test', 'tests', '__tests__', 'spec'),
          (framework, allowedFrameworks, testPath) => {
            // Create security manager with specific allowlist
            const securityManager = new SecurityManager({
              allowedFrameworks: allowedFrameworks,
            });

            const options: TestRunOptions = {
              framework,
              testPath: `${testPath}/example.test.ts`,
            };

            const result = securityManager.validateTestExecution(options);

            // Property: If framework is not in allowlist, validation should fail
            const isAllowed = allowedFrameworks.includes(framework);
            if (!isAllowed) {
              expect(result.valid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);
              expect(result.errors[0]).toContain('not in the security allowlist');
            } else {
              // If framework is allowed, this specific check should pass
              // (other checks might still fail, but not the framework check)
              const hasFrameworkError = result.errors.some((err) =>
                err.includes('not in the security allowlist')
              );
              expect(hasFrameworkError).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 47: Resource limits terminate processes', () => {
    it('should terminate processes that exceed resource limits', async () => {
      // **Feature: mcp-testing-server, Property 47: Resource limits terminate processes**

      await fc.assert(
        fc.asyncProperty(
          // Generate process IDs
          fc.integer({ min: 1000, max: 9999 }),
          // Generate test frameworks
          fc.constantFrom(
            TestFramework.JEST,
            TestFramework.MOCHA,
            TestFramework.PYTEST,
            TestFramework.VITEST
          ),
          // Generate max test duration (in milliseconds)
          fc.integer({ min: 100, max: 1000 }),
          // Generate elapsed time (in milliseconds)
          fc.integer({ min: 0, max: 2000 }),
          async (processId, framework, maxDuration, elapsedTime) => {
            const securityManager = new SecurityManager({
              maxTestDuration: maxDuration,
            });

            // Register the process with a start time in the past
            const startTime = Date.now() - elapsedTime;
            securityManager.registerProcess(processId, framework);

            // Manually set the start time by accessing the private field
            // In a real scenario, this would be set when the process starts
            (securityManager as any).activeProcesses.set(processId, {
              startTime,
              framework,
            });

            // Property: If elapsed time exceeds max duration, enforceResourceLimits should throw
            if (elapsedTime > maxDuration) {
              await expect(securityManager.enforceResourceLimits(processId)).rejects.toThrow(
                /exceeded maximum duration/
              );
              // Process should be unregistered after termination
              expect(securityManager.getActiveProcessCount()).toBe(0);
            } else {
              // If within limits, should not throw
              await expect(securityManager.enforceResourceLimits(processId)).resolves.not.toThrow();
              // Process should still be registered
              expect(securityManager.getActiveProcessCount()).toBe(1);
              // Clean up
              securityManager.unregisterProcess(processId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 48: Operations are audit logged', () => {
    it('should record all operations in the audit log with timestamp, user, and parameters', async () => {
      // **Feature: mcp-testing-server, Property 48: Operations are audit logged**

      await fc.assert(
        fc.asyncProperty(
          // Generate operation types
          fc.constantFrom(
            'test_execution',
            'coverage_analysis',
            'test_generation',
            'mutation_testing',
            'flaky_detection'
          ),
          // Generate user names
          fc.string({ minLength: 3, maxLength: 20 }),
          // Generate parameters
          fc.record({
            framework: fc.constantFrom('jest', 'mocha', 'pytest', 'vitest'),
            testPath: fc.string({ minLength: 5, maxLength: 50 }),
            timeout: fc.integer({ min: 1000, max: 60000 }),
          }),
          async (operationType, user, params) => {
            const securityManager = new SecurityManager({
              enableAuditLog: true,
            });

            // Clear any existing audit log
            securityManager.clearAuditLog();

            const operation: Operation = {
              type: operationType,
              description: `Test operation: ${operationType}`,
              parameters: params,
            };

            // Audit the operation
            await securityManager.auditOperation(operation, user, params);

            // Property: Operation should be recorded in audit log
            const auditLog = securityManager.getAuditLog();
            expect(auditLog.length).toBe(1);

            const entry = auditLog[0];
            expect(entry.operation).toBe(operationType);
            expect(entry.user).toBe(user);
            expect(entry.parameters).toEqual(params);
            expect(entry.result).toBe('success');
            expect(entry.timestamp).toBeDefined();
            expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should record failed operations with error details', async () => {
      // **Feature: mcp-testing-server, Property 48: Operations are audit logged**

      await fc.assert(
        fc.asyncProperty(
          // Generate operation types
          fc.constantFrom('test_execution', 'coverage_analysis', 'test_generation'),
          // Generate user names
          fc.string({ minLength: 3, maxLength: 20 }),
          // Generate parameters
          fc.record({
            framework: fc.constantFrom('jest', 'mocha'),
          }),
          // Generate error messages
          fc.string({ minLength: 10, maxLength: 100 }),
          async (operationType, user, params, errorMessage) => {
            const securityManager = new SecurityManager({
              enableAuditLog: true,
            });

            securityManager.clearAuditLog();

            const operation: Operation = {
              type: operationType,
              description: `Failed operation: ${operationType}`,
              parameters: params,
            };

            // Audit the failure
            await securityManager.auditFailure(operation, user, params, errorMessage);

            // Property: Failed operation should be recorded with error
            const auditLog = securityManager.getAuditLog();
            expect(auditLog.length).toBe(1);

            const entry = auditLog[0];
            expect(entry.operation).toBe(operationType);
            expect(entry.user).toBe(user);
            expect(entry.result).toBe('failure');
            expect(entry.error).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 49: Dangerous operations are blocked', () => {
    it('should block dangerous operations and alert administrators', async () => {
      // **Feature: mcp-testing-server, Property 49: Dangerous operations are blocked**

      await fc.assert(
        fc.asyncProperty(
          // Generate dangerous operation types
          fc.constantFrom(
            'shell_command',
            'exec',
            'spawn',
            'eval',
            'require',
            'file_delete',
            'network_request'
          ),
          // Generate user names
          fc.string({ minLength: 3, maxLength: 20 }),
          // Generate dangerous parameters
          fc.record({
            command: fc.constantFrom('rm -rf /', 'sudo rm', 'chmod 777', 'kill -9'),
          }),
          async (operationType, user, params) => {
            const securityManager = new SecurityManager({
              blockShellCommands: true,
              enableAuditLog: true,
            });

            securityManager.clearAuditLog();

            const operation: Operation = {
              type: operationType,
              description: `Dangerous operation: ${operationType}`,
              parameters: params,
            };

            // Property: Dangerous operation should be identified
            expect(securityManager.isDangerousOperation(operation)).toBe(true);

            // Property: Blocking dangerous operation should throw error
            await expect(securityManager.blockDangerousOperation(operation, user)).rejects.toThrow(
              /blocked by security policy/
            );

            // Property: Blocked operation should be audit logged as failure
            const auditLog = securityManager.getAuditLog();
            expect(auditLog.length).toBe(1);
            expect(auditLog[0].result).toBe('failure');
            expect(auditLog[0].error).toContain('blocked by security policy');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect dangerous patterns in operation parameters', () => {
      // **Feature: mcp-testing-server, Property 49: Dangerous operations are blocked**

      fc.assert(
        fc.property(
          // Generate operation types
          fc.constantFrom('test_execution', 'file_operation', 'command'),
          // Generate dangerous patterns
          fc.constantFrom('rm -rf', 'sudo', 'chmod', '&&', '||', ';', '|', 'kill'),
          (operationType, dangerousPattern) => {
            const securityManager = new SecurityManager({
              blockShellCommands: true,
            });

            const operation: Operation = {
              type: operationType,
              description: 'Operation with dangerous pattern',
              parameters: {
                command: `some command ${dangerousPattern} other stuff`,
              },
            };

            // Property: Operations with dangerous patterns should be detected
            expect(securityManager.isDangerousOperation(operation)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow safe operations when shell commands are not blocked', () => {
      // **Feature: mcp-testing-server, Property 49: Dangerous operations are blocked**

      fc.assert(
        fc.property(
          // Generate safe operation types
          fc.constantFrom('test_execution', 'coverage_analysis', 'test_generation'),
          // Generate safe parameters
          fc.record({
            framework: fc.constantFrom('jest', 'mocha', 'pytest'),
            testPath: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          (operationType, params) => {
            const securityManager = new SecurityManager({
              blockShellCommands: false,
            });

            const operation: Operation = {
              type: operationType,
              description: 'Safe operation',
              parameters: params,
            };

            // Property: Safe operations should not be flagged as dangerous
            // when shell command blocking is disabled
            const isDangerous = securityManager.isDangerousOperation(operation);

            // Only inherently dangerous operation types should be flagged
            const inherentlyDangerous = [
              'shell_command',
              'exec',
              'spawn',
              'eval',
              'require',
              'import',
              'file_write',
              'file_delete',
              'network_request',
            ].includes(operationType);

            expect(isDangerous).toBe(inherentlyDangerous);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
