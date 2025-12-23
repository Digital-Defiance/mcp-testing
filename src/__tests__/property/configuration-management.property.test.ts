/**
 * Property-based tests for configuration management
 *
 * Tests Properties 67-70 from the design document:
 * - Property 67: Configuration loading works for all frameworks
 * - Property 68: Custom configuration merges correctly
 * - Property 69: Invalid configuration returns errors
 * - Property 70: Configuration changes trigger reload
 *
 * Validates Requirements 19.1, 19.3, 19.4, 19.5
 */

import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FrameworkDetector, FrameworkConfig } from '../../components/FrameworkDetector';
import { TestFramework } from '../../types';

describe('Configuration Management Properties', () => {
  describe('Property 67: Configuration loading works for all frameworks', () => {
    it('should load configuration from framework-specific files for any supported framework', async () => {
      // **Feature: mcp-testing-server, Property 67: Configuration loading works for all frameworks**

      await fc.assert(
        fc.asyncProperty(
          // Generate test frameworks
          fc.constantFrom(
            TestFramework.JEST,
            TestFramework.MOCHA,
            TestFramework.PYTEST,
            TestFramework.VITEST,
            TestFramework.JASMINE,
            TestFramework.AVA
          ),
          async (framework) => {
            // Create a temporary project directory
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

            try {
              // Create package.json with the framework
              const packageJson = {
                name: 'test-project',
                version: '1.0.0',
                devDependencies: {
                  [framework]: '^1.0.0',
                },
              };
              await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
              );

              // Create a basic JSON config file for frameworks that support it
              const configFileName = getConfigFileName(framework);
              if (configFileName.endsWith('.json')) {
                const basicConfig = {
                  testMatch: ['**/*.test.js'],
                  timeout: 3000,
                };
                await fs.writeFile(
                  path.join(tempDir, configFileName),
                  JSON.stringify(basicConfig, null, 2)
                );
              }

              const detector = new FrameworkDetector();

              // Property: Should successfully load configuration for any framework
              const config = await detector.getFrameworkConfig(framework, tempDir);

              // Verify configuration has required fields
              expect(config).toBeDefined();
              expect(config.framework).toBe(framework);
              expect(Array.isArray(config.testMatch)).toBe(true);
              expect(config.testMatch.length).toBeGreaterThan(0);
              expect(Array.isArray(config.testPathIgnorePatterns)).toBe(true);
              expect(typeof config.coverageDirectory).toBe('string');
              expect(config.coverageDirectory.length).toBeGreaterThan(0);
              expect(Array.isArray(config.coverageReporters)).toBe(true);
              expect(config.coverageReporters.length).toBeGreaterThan(0);
              expect(typeof config.timeout).toBe('number');
              expect(config.timeout).toBeGreaterThanOrEqual(0);
              expect(typeof config.customConfig).toBe('object');
            } finally {
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use framework defaults when no config file exists', async () => {
      // **Feature: mcp-testing-server, Property 67: Configuration loading works for all frameworks**

      await fc.assert(
        fc.asyncProperty(
          // Generate test frameworks
          fc.constantFrom(
            TestFramework.JEST,
            TestFramework.MOCHA,
            TestFramework.PYTEST,
            TestFramework.VITEST,
            TestFramework.JASMINE,
            TestFramework.AVA
          ),
          async (framework) => {
            // Create a temporary project directory without config files
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

            try {
              // Create package.json with the framework
              const packageJson = {
                name: 'test-project',
                version: '1.0.0',
                devDependencies: {
                  [framework]: '^1.0.0',
                },
              };
              await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
              );

              const detector = new FrameworkDetector();

              // Get defaults
              const defaults = detector.getFrameworkDefaults(framework);

              // Get config (should use defaults)
              const config = await detector.getFrameworkConfig(framework, tempDir);

              // Property: When no config file exists, should use framework defaults
              expect(config.testMatch).toEqual(defaults.testMatch);
              expect(config.testPathIgnorePatterns).toEqual(defaults.testPathIgnorePatterns);
              expect(config.coverageDirectory).toBe(defaults.coverageDirectory);
              expect(config.coverageReporters).toEqual(defaults.coverageReporters);
              expect(config.timeout).toBe(defaults.timeout);
            } finally {
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 68: Custom configuration merges correctly', () => {
    it('should merge custom configuration with existing configuration without losing settings', async () => {
      // **Feature: mcp-testing-server, Property 68: Custom configuration merges correctly**

      await fc.assert(
        fc.asyncProperty(
          // Generate test frameworks that support JSON config
          fc.constantFrom(TestFramework.JEST, TestFramework.MOCHA),
          // Generate custom test match patterns
          fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
          // Generate custom timeout
          fc.integer({ min: 1000, max: 30000 }),
          // Generate custom coverage directory
          fc.constantFrom('coverage', 'test-coverage', 'cov', 'reports/coverage'),
          async (framework, customTestMatch, customTimeout, customCoverageDir) => {
            // Create a temporary project directory
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

            try {
              // Create package.json with the framework
              const packageJson = {
                name: 'test-project',
                version: '1.0.0',
                devDependencies: {
                  [framework]: '^1.0.0',
                },
              };
              await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
              );

              // Create config file with custom settings
              const configFileName = getConfigFileName(framework);
              const customConfig = {
                testMatch: customTestMatch,
                timeout: customTimeout,
                coverageDirectory: customCoverageDir,
              };
              await fs.writeFile(
                path.join(tempDir, configFileName),
                JSON.stringify(customConfig, null, 2)
              );

              const detector = new FrameworkDetector();

              // Get defaults
              const defaults = detector.getFrameworkDefaults(framework);

              // Get merged config
              const config = await detector.getFrameworkConfig(framework, tempDir);

              // Property: Custom settings should override defaults
              expect(config.testMatch).toEqual(customTestMatch);
              expect(config.timeout).toBe(customTimeout);
              expect(config.coverageDirectory).toBe(customCoverageDir);

              // Property: Non-overridden settings should retain defaults
              expect(config.testPathIgnorePatterns).toEqual(defaults.testPathIgnorePatterns);
              expect(config.coverageReporters).toEqual(defaults.coverageReporters);

              // Property: Custom config should be preserved in customConfig field
              expect(config.customConfig).toMatchObject(customConfig);
            } finally {
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all default settings when custom config only overrides some fields', async () => {
      // **Feature: mcp-testing-server, Property 68: Custom configuration merges correctly**

      await fc.assert(
        fc.asyncProperty(
          // Generate test frameworks that support JSON config
          fc.constantFrom(TestFramework.JEST, TestFramework.MOCHA),
          // Generate which field to override
          fc.constantFrom('testMatch', 'timeout', 'coverageDirectory', 'coverageReporters'),
          async (framework, fieldToOverride) => {
            // Create a temporary project directory
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

            try {
              // Create package.json with the framework
              const packageJson = {
                name: 'test-project',
                version: '1.0.0',
                devDependencies: {
                  [framework]: '^1.0.0',
                },
              };
              await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
              );

              // Create config file with only one custom setting
              const configFileName = getConfigFileName(framework);
              const customConfig: Record<string, unknown> = {};

              if (fieldToOverride === 'testMatch') {
                customConfig.testMatch = ['**/*.custom.test.js'];
              } else if (fieldToOverride === 'timeout') {
                customConfig.timeout = 12345;
              } else if (fieldToOverride === 'coverageDirectory') {
                customConfig.coverageDirectory = 'custom-coverage';
              } else if (fieldToOverride === 'coverageReporters') {
                customConfig.coverageReporters = ['json', 'html'];
              }

              await fs.writeFile(
                path.join(tempDir, configFileName),
                JSON.stringify(customConfig, null, 2)
              );

              const detector = new FrameworkDetector();

              // Get defaults
              const defaults = detector.getFrameworkDefaults(framework);

              // Get merged config
              const config = await detector.getFrameworkConfig(framework, tempDir);

              // Property: Only the overridden field should differ from defaults
              if (fieldToOverride === 'testMatch') {
                expect(config.testMatch).toEqual(['**/*.custom.test.js']);
                expect(config.timeout).toBe(defaults.timeout);
                expect(config.coverageDirectory).toBe(defaults.coverageDirectory);
                expect(config.coverageReporters).toEqual(defaults.coverageReporters);
              } else if (fieldToOverride === 'timeout') {
                expect(config.timeout).toBe(12345);
                expect(config.testMatch).toEqual(defaults.testMatch);
                expect(config.coverageDirectory).toBe(defaults.coverageDirectory);
                expect(config.coverageReporters).toEqual(defaults.coverageReporters);
              } else if (fieldToOverride === 'coverageDirectory') {
                expect(config.coverageDirectory).toBe('custom-coverage');
                expect(config.testMatch).toEqual(defaults.testMatch);
                expect(config.timeout).toBe(defaults.timeout);
                expect(config.coverageReporters).toEqual(defaults.coverageReporters);
              } else if (fieldToOverride === 'coverageReporters') {
                expect(config.coverageReporters).toEqual(['json', 'html']);
                expect(config.testMatch).toEqual(defaults.testMatch);
                expect(config.timeout).toBe(defaults.timeout);
                expect(config.coverageDirectory).toBe(defaults.coverageDirectory);
              }

              expect(config.testPathIgnorePatterns).toEqual(defaults.testPathIgnorePatterns);
            } finally {
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 69: Invalid configuration returns errors', () => {
    it('should return validation errors for invalid framework versions', () => {
      // **Feature: mcp-testing-server, Property 69: Invalid configuration returns errors**

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
          // Generate invalid version strings
          fc.constantFrom(
            'invalid',
            '',
            'v1.0.0',
            '1',
            '1.0',
            'abc.def.ghi',
            '1.0.0-beta',
            '1.0.0+build'
          ),
          (framework, invalidVersion) => {
            const detector = new FrameworkDetector();

            // Property: Invalid versions should produce warnings
            const result = detector.validateFramework(framework, invalidVersion);

            // Should still be valid (just warnings) unless version is completely unparseable
            if (invalidVersion.match(/^\d+\.\d+\.\d+/)) {
              expect(result.valid).toBe(true);
            } else {
              // Completely invalid versions should produce warnings
              expect(result.warnings.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return validation errors for unsupported frameworks', () => {
      // **Feature: mcp-testing-server, Property 69: Invalid configuration returns errors**

      fc.assert(
        fc.property(
          // Generate invalid framework names
          fc.constantFrom(
            'invalid-framework',
            'unknown',
            'test-framework',
            'custom',
            'my-test-tool'
          ),
          // Generate valid version
          fc.constantFrom('1.0.0', '2.5.3', '10.0.0'),
          (invalidFramework, version) => {
            const detector = new FrameworkDetector();

            // Property: Unsupported frameworks should be rejected
            const result = detector.validateFramework(invalidFramework as TestFramework, version);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('not supported');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn about versions below minimum requirements', () => {
      // **Feature: mcp-testing-server, Property 69: Invalid configuration returns errors**

      fc.assert(
        fc.property(
          // Generate test frameworks with their minimum versions
          fc.constantFrom(
            { framework: TestFramework.JEST, minMajor: 27, testMajor: 26 },
            { framework: TestFramework.MOCHA, minMajor: 8, testMajor: 7 },
            { framework: TestFramework.PYTEST, minMajor: 6, testMajor: 5 },
            { framework: TestFramework.JASMINE, minMajor: 3, testMajor: 2 },
            { framework: TestFramework.AVA, minMajor: 4, testMajor: 3 }
          ),
          (testCase) => {
            const detector = new FrameworkDetector();

            // Test with version below minimum
            const belowMinVersion = `${testCase.testMajor}.0.0`;
            const result = detector.validateFramework(testCase.framework, belowMinVersion);

            // Property: Versions below minimum should produce warnings
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('below recommended minimum');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 70: Configuration changes trigger reload', () => {
    it('should detect configuration file changes and reload configuration', async () => {
      // **Feature: mcp-testing-server, Property 70: Configuration changes trigger reload**

      await fc.assert(
        fc.asyncProperty(
          // Generate test frameworks that support JSON config
          fc.constantFrom(TestFramework.JEST, TestFramework.MOCHA),
          // Generate initial timeout
          fc.integer({ min: 1000, max: 5000 }),
          // Generate updated timeout
          fc.integer({ min: 6000, max: 10000 }),
          async (framework, initialTimeout, updatedTimeout) => {
            // Create a temporary project directory
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

            try {
              // Create package.json with the framework
              const packageJson = {
                name: 'test-project',
                version: '1.0.0',
                devDependencies: {
                  [framework]: '^1.0.0',
                },
              };
              await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
              );

              // Create initial config file
              const configFileName = getConfigFileName(framework);
              const configPath = path.join(tempDir, configFileName);
              const initialConfig = {
                timeout: initialTimeout,
              };
              await fs.writeFile(configPath, JSON.stringify(initialConfig, null, 2));

              const detector = new FrameworkDetector();

              // Load initial config
              const config1 = await detector.getFrameworkConfig(framework, tempDir);
              expect(config1.timeout).toBe(initialTimeout);

              // Update config file
              const updatedConfig = {
                timeout: updatedTimeout,
              };
              await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));

              // Small delay to ensure file system has updated
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Reload config
              const config2 = await detector.getFrameworkConfig(framework, tempDir);

              // Property: Configuration changes should be reflected in reloaded config
              expect(config2.timeout).toBe(updatedTimeout);
              expect(config2.timeout).not.toBe(config1.timeout);
            } finally {
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reload configuration when config file is added after initial load', async () => {
      // **Feature: mcp-testing-server, Property 70: Configuration changes trigger reload**

      await fc.assert(
        fc.asyncProperty(
          // Generate test frameworks that support JSON config
          fc.constantFrom(TestFramework.JEST, TestFramework.MOCHA),
          // Generate custom timeout
          fc.integer({ min: 1000, max: 10000 }),
          async (framework, customTimeout) => {
            // Create a temporary project directory
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

            try {
              // Create package.json with the framework
              const packageJson = {
                name: 'test-project',
                version: '1.0.0',
                devDependencies: {
                  [framework]: '^1.0.0',
                },
              };
              await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
              );

              const detector = new FrameworkDetector();

              // Get defaults (no config file exists)
              const defaults = detector.getFrameworkDefaults(framework);

              // Load config (should use defaults)
              const config1 = await detector.getFrameworkConfig(framework, tempDir);
              expect(config1.timeout).toBe(defaults.timeout);

              // Create config file
              const configFileName = getConfigFileName(framework);
              const configPath = path.join(tempDir, configFileName);
              const newConfig = {
                timeout: customTimeout,
              };
              await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));

              // Small delay to ensure file system has updated
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Reload config
              const config2 = await detector.getFrameworkConfig(framework, tempDir);

              // Property: New configuration file should be detected and loaded
              expect(config2.timeout).toBe(customTimeout);
              expect(config2.timeout).not.toBe(defaults.timeout);
            } finally {
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Helper function to get config file name for a framework
 */
function getConfigFileName(framework: TestFramework): string {
  const configFiles: Record<TestFramework, string> = {
    [TestFramework.JEST]: 'jest.config.json',
    [TestFramework.MOCHA]: '.mocharc.json',
    [TestFramework.PYTEST]: 'pytest.ini',
    [TestFramework.VITEST]: 'vitest.config.json',
    [TestFramework.JASMINE]: 'jasmine.json',
    [TestFramework.AVA]: 'ava.config.json',
  };
  return configFiles[framework];
}
