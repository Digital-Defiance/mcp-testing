/**
 * Property-based tests for integration failure graceful degradation
 *
 * @packageDocumentation
 */

import fc from 'fast-check';
import {
  degradationManager,
  GracefulDegradationManager,
  FeatureStatus,
  registerCommonFeatures,
} from '../../errors/GracefulDegradation';
import { MCPTestingError, ErrorFactory } from '../../errors/MCPTestingError';
import { ErrorCode } from '../../errors/ErrorCodes';
import { CircuitBreaker, CircuitState } from '../../errors/CircuitBreaker';
import { RetryHandler } from '../../errors/RetryHandler';

/**
 * Mock integration function that can fail
 */
class MockIntegration {
  private failureCount = 0;
  private shouldFail = false;
  private failureType: 'connection' | 'timeout' | 'tool-call' | 'none' = 'none';

  setShouldFail(
    shouldFail: boolean,
    type: 'connection' | 'timeout' | 'tool-call' = 'connection'
  ): void {
    this.shouldFail = shouldFail;
    this.failureType = type;
    this.failureCount = 0;
  }

  async callIntegration(serverName: string, toolName: string): Promise<any> {
    if (this.shouldFail) {
      this.failureCount++;

      switch (this.failureType) {
        case 'connection':
          throw ErrorFactory.mcpServerConnectionFailed(serverName, 'Connection refused');
        case 'timeout':
          throw ErrorFactory.integrationTimeout(serverName, toolName, 5000);
        case 'tool-call':
          throw ErrorFactory.mcpToolCallFailed(toolName, serverName, 'Tool execution failed');
        default:
          throw new Error('Unknown failure type');
      }
    }

    return { success: true, data: 'mock-result' };
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  reset(): void {
    this.failureCount = 0;
    this.shouldFail = false;
    this.failureType = 'none';
  }
}

describe('Property-based tests for integration failure graceful degradation', () => {
  describe('Property 75: Integration failures degrade gracefully', () => {
    beforeEach(() => {
      // Reset degradation manager before each test
      degradationManager.reset();
      registerCommonFeatures();
    });

    it('should gracefully degrade when integration with another server fails', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('debugger', 'screenshot', 'process', 'filesystem'),
          fc.constantFrom('connection', 'timeout', 'tool-call'),
          async (serverType, failureType) => {
            const mockIntegration = new MockIntegration();
            const manager = new GracefulDegradationManager();

            // Register feature WITHOUT fallback so error is thrown
            const featureName = `${serverType}-integration`;
            manager.registerFeature(featureName);

            // Simulate integration failure
            mockIntegration.setShouldFail(true, failureType as any);

            let errorThrown = false;
            try {
              await manager.executeWithFallback(featureName, async () => {
                return mockIntegration.callIntegration(`mcp-${serverType}`, 'test-tool');
              });
            } catch (error) {
              errorThrown = true;
              // Error should be an MCPTestingError
              expect(error).toBeInstanceOf(MCPTestingError);

              // Feature should be degraded if error should degrade
              if ((error as MCPTestingError).shouldDegrade()) {
                const status = manager.getFeatureStatus(featureName);
                expect(status).toBe(FeatureStatus.DEGRADED);
              }
            }

            // Should have thrown an error
            expect(errorThrown).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use fallback when feature is unavailable', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (featureName, fallbackValue) => {
            const manager = new GracefulDegradationManager();

            // Register feature with fallback
            manager.registerFeature(featureName, async () => {
              return { fallback: true, value: fallbackValue };
            });

            // Mark feature as unavailable
            manager.disableFeature(featureName, 'Test unavailability');

            // Execute with fallback
            const result = await manager.executeWithFallback(featureName, async () => {
              throw new Error('Should not be called');
            });

            // Should return fallback result
            expect(result).toBeDefined();
            expect(result.fallback).toBe(true);
            expect(result.value).toBe(fallbackValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log integration errors without crashing', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('debugger', 'screenshot', 'process', 'filesystem'),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (serverType, errorMessage) => {
            const mockIntegration = new MockIntegration();
            const manager = new GracefulDegradationManager();

            const featureName = `${serverType}-integration`;
            let degradationEventReceived = false;

            // Listen for degradation events
            manager.onDegradation((event) => {
              degradationEventReceived = true;
              expect(event.feature).toBe(featureName);
              expect(event.status).toBe(FeatureStatus.DEGRADED);
              expect(event.timestamp).toBeDefined();
            });

            // Register feature
            manager.registerFeature(featureName);

            // Simulate failure
            mockIntegration.setShouldFail(true);

            try {
              await manager.executeWithFallback(featureName, async () => {
                return mockIntegration.callIntegration(`mcp-${serverType}`, 'test-tool');
              });
            } catch (error) {
              // Error should be logged but not crash the system
              expect(error).toBeInstanceOf(MCPTestingError);
            }

            // Degradation event should have been emitted
            expect(degradationEventReceived).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should retry failed integrations with exponential backoff', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2 }),
          fc.integer({ min: 100, max: 500 }),
          async (maxRetries, initialDelay) => {
            const mockIntegration = new MockIntegration();
            mockIntegration.setShouldFail(true);

            const retryHandler = new RetryHandler({
              maxRetries,
              initialDelay,
              backoffMultiplier: 2,
            });

            let attemptCount = 0;
            try {
              await retryHandler.execute(async () => {
                attemptCount++;
                return mockIntegration.callIntegration('mcp-test', 'test-tool');
              });
            } catch (error) {
              // Should have retried maxRetries times
              expect(attemptCount).toBe(maxRetries + 1); // Initial attempt + retries
              expect(error).toBeInstanceOf(MCPTestingError);
            }
          }
        ),
        { numRuns: 20 } // Reduced runs due to delays
      );
    }, 30000); // Increase timeout to 30 seconds

    it('should open circuit breaker after repeated failures', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 10 }), async (failureThreshold) => {
          const mockIntegration = new MockIntegration();
          mockIntegration.setShouldFail(true);

          const circuitBreaker = new CircuitBreaker({
            failureThreshold,
            timeout: 1000,
          });

          // Cause failures to open circuit
          for (let i = 0; i < failureThreshold; i++) {
            try {
              await circuitBreaker.execute(async () => {
                return mockIntegration.callIntegration('mcp-test', 'test-tool');
              });
            } catch (error) {
              // Expected to fail
            }
          }

          // Circuit should be open
          expect(circuitBreaker.isOpen()).toBe(true);
          expect(circuitBreaker.getFailureCount()).toBe(failureThreshold);

          // Next call should fail immediately without calling integration
          const failureCountBefore = mockIntegration.getFailureCount();
          try {
            await circuitBreaker.execute(async () => {
              return mockIntegration.callIntegration('mcp-test', 'test-tool');
            });
          } catch (error) {
            expect(error.message).toContain('Circuit breaker is OPEN');
          }

          // Integration should not have been called
          expect(mockIntegration.getFailureCount()).toBe(failureCountBefore);
        }),
        { numRuns: 50 }
      );
    });

    it('should restore feature after successful recovery', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 20 }), async (featureName) => {
          const manager = new GracefulDegradationManager();

          // Register feature
          manager.registerFeature(featureName);

          // Degrade feature
          manager.degradeFeature(featureName, 'Test degradation');
          expect(manager.getFeatureStatus(featureName)).toBe(FeatureStatus.DEGRADED);

          // Restore feature
          manager.restoreFeature(featureName);
          expect(manager.getFeatureStatus(featureName)).toBe(FeatureStatus.AVAILABLE);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple concurrent integration failures independently', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
          async (featureNames) => {
            const manager = new GracefulDegradationManager();

            // Register all features
            for (const name of featureNames) {
              manager.registerFeature(name);
            }

            // Degrade some features
            const degradedFeatures = featureNames.slice(0, Math.floor(featureNames.length / 2));
            for (const name of degradedFeatures) {
              manager.degradeFeature(name, 'Test degradation');
            }

            // Verify degraded features
            for (const name of degradedFeatures) {
              expect(manager.getFeatureStatus(name)).toBe(FeatureStatus.DEGRADED);
            }

            // Verify non-degraded features
            const availableFeatures = featureNames.slice(Math.floor(featureNames.length / 2));
            for (const name of availableFeatures) {
              expect(manager.getFeatureStatus(name)).toBe(FeatureStatus.AVAILABLE);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide meaningful error messages for integration failures', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('debugger', 'screenshot', 'process', 'filesystem'),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (serverType, toolName) => {
            const error = ErrorFactory.mcpServerConnectionFailed(
              `mcp-${serverType}`,
              'Connection refused'
            );

            // Error should have meaningful message
            expect(error.message).toContain(`mcp-${serverType}`);
            expect(error.message).toContain('Connection refused');

            // Error should have remediation
            expect(error.remediation).toBeDefined();
            expect(error.remediation.length).toBeGreaterThan(0);

            // Error should be retryable
            expect(error.isRetryable()).toBe(true);

            // Error should have proper structure
            const response = error.toMCPResponse();
            expect(response.status).toBe('error');
            expect(response.error.code).toBe(ErrorCode.MCP_SERVER_CONNECTION_FAILED);
            expect(response.error.severity).toBeDefined();
            expect(response.error.category).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track all degradation events', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          async (featureNames) => {
            const manager = new GracefulDegradationManager();
            const events: any[] = [];

            // Listen for events
            manager.onDegradation((event) => {
              events.push(event);
            });

            // Register and degrade features
            for (const name of featureNames) {
              manager.registerFeature(name);
              manager.degradeFeature(name, `Test degradation for ${name}`);
            }

            // Should have received one event per feature
            expect(events.length).toBe(featureNames.length);

            // Verify event structure
            for (let i = 0; i < events.length; i++) {
              expect(events[i].feature).toBe(featureNames[i]);
              expect(events[i].status).toBe(FeatureStatus.DEGRADED);
              expect(events[i].reason).toContain(featureNames[i]);
              expect(events[i].timestamp).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue operating with degraded functionality', async () => {
      // **Feature: mcp-testing-server, Property 75: Integration failures degrade gracefully**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (featureName, fallbackResult) => {
            const manager = new GracefulDegradationManager();

            // Register feature with fallback
            manager.registerFeature(featureName, async () => {
              return { degraded: true, result: fallbackResult };
            });

            // Degrade feature
            manager.degradeFeature(featureName, 'Test degradation');

            // Should still be able to execute with fallback
            const result = await manager.executeWithFallback(featureName, async () => {
              throw ErrorFactory.integrationUnavailable(`mcp-${featureName}`);
            });

            // Should return fallback result
            expect(result).toBeDefined();
            expect(result.degraded).toBe(true);
            expect(result.result).toBe(fallbackResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
