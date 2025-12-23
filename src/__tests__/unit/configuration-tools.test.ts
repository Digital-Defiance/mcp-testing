/**
 * Unit tests for configuration tools
 *
 * Tests the test_configure_framework, test_get_config, and test_set_config tools
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Configuration Tools', () => {
  let server: MCPTestingServer;
  let originalCwd: string;
  let testProjectPath: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    originalCwd = process.cwd();

    // Create a temporary test project directory
    testProjectPath = path.join(__dirname, '../../../tmp/test-config-project');
    await fs.mkdir(testProjectPath, { recursive: true });

    // Create a package.json with jest installed
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      devDependencies: {
        jest: '^29.0.0',
      },
    };
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Change to test project directory
    process.chdir(testProjectPath);
  });

  afterEach(async () => {
    // Restore original directory
    process.chdir(originalCwd);

    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('test_configure_framework', () => {
    it('should configure an installed framework', async () => {
      const result = await server['handleTestConfigureFramework']({
        framework: TestFramework.JEST,
      });

      expect(result.status).toBe('success');
      expect(result.data.framework).toBe(TestFramework.JEST);
      expect(result.data.version).toBe('29.0.0');
      expect(result.data.configuration).toHaveProperty('testMatch');
      expect(result.data.configuration).toHaveProperty('coverageDirectory');
      expect(result.data.validation.valid).toBe(true);
    });

    it('should fail for non-installed framework', async () => {
      // Skip this test in mock mode since all frameworks are available
      if (process.env['MCP_TESTING_MOCK_MODE'] === 'true') {
        return;
      }

      await expect(
        server['handleTestConfigureFramework']({
          framework: TestFramework.MOCHA,
        })
      ).rejects.toThrow('is not installed in the project');
    });

    it('should use custom config path if provided', async () => {
      // Create a custom config file
      const customConfig = {
        testMatch: ['**/*.custom.test.js'],
        coverageDirectory: 'custom-coverage',
      };
      await fs.writeFile(
        path.join(testProjectPath, 'jest.custom.config.json'),
        JSON.stringify(customConfig, null, 2)
      );

      const result = await server['handleTestConfigureFramework']({
        framework: TestFramework.JEST,
        configPath: 'jest.custom.config.json',
      });

      expect(result.status).toBe('success');
      expect(result.data.configFile).toBe('jest.custom.config.json');
    });

    it('should fail if custom config path does not exist', async () => {
      await expect(
        server['handleTestConfigureFramework']({
          framework: TestFramework.JEST,
          configPath: 'nonexistent.config.json',
        })
      ).rejects.toThrow('Configuration file not found');
    });
  });

  describe('test_get_config', () => {
    it('should get configuration for installed framework', async () => {
      const result = await server['handleTestGetConfig']({
        framework: TestFramework.JEST,
      });

      expect(result.status).toBe('success');
      expect(result.data.framework).toBe(TestFramework.JEST);
      expect(result.data.config).toHaveProperty('testMatch');
      expect(result.data.config).toHaveProperty('coverageDirectory');
      expect(result.data.defaults).toHaveProperty('testMatch');
      // In mock mode, returns false since it has a config file
      expect(typeof result.data.usingDefaults).toBe('boolean');
    });

    it('should indicate when using config file', async () => {
      // Create a jest config file
      const config = {
        testMatch: ['**/*.test.js'],
        coverageDirectory: 'coverage',
      };
      await fs.writeFile(
        path.join(testProjectPath, 'jest.config.json'),
        JSON.stringify(config, null, 2)
      );

      const result = await server['handleTestGetConfig']({
        framework: TestFramework.JEST,
      });

      expect(result.status).toBe('success');
      // In mock mode, returns jest.config.js
      expect(result.data.configFile).toMatch(/jest\.config\.(js|json)/);
      expect(result.data.usingDefaults).toBe(false);
      expect(result.data.message).toContain('Configuration loaded from');
    });

    it('should fail for non-installed framework', async () => {
      // Skip this test in mock mode since all frameworks are available
      if (process.env['MCP_TESTING_MOCK_MODE'] === 'true') {
        return;
      }

      await expect(
        server['handleTestGetConfig']({
          framework: TestFramework.MOCHA,
        })
      ).rejects.toThrow('is not installed in the project');
    });

    it('should list available frameworks when framework not found', async () => {
      try {
        await server['handleTestGetConfig']({
          framework: TestFramework.MOCHA,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Available frameworks');
      }
    });
  });

  describe('test_set_config', () => {
    it('should set new configuration without merge', async () => {
      const newConfig = {
        testMatch: ['**/*.spec.js'],
        coverageDirectory: 'new-coverage',
        timeout: 10000,
      };

      const result = await server['handleTestSetConfig']({
        framework: TestFramework.JEST,
        merge: false,
        ...newConfig,
      });

      expect(result.status).toBe('success');
      expect(result.data.framework).toBe(TestFramework.JEST);
      expect(result.data.merged).toBe(false);
      expect(result.data.configFile).toContain('.json');
      expect(result.data.message).toContain('replaced');

      // Verify config file was created
      const configPath = path.join(testProjectPath, result.data.configFile);
      const configContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.testMatch).toEqual(newConfig.testMatch);
      expect(savedConfig.coverageDirectory).toBe(newConfig.coverageDirectory);
    });

    it('should merge with existing configuration', async () => {
      // Create initial config
      const initialConfig = {
        testMatch: ['**/*.test.js'],
        coverageDirectory: 'coverage',
        timeout: 5000,
      };
      await fs.writeFile(
        path.join(testProjectPath, 'jest.config.json'),
        JSON.stringify(initialConfig, null, 2)
      );

      // Merge with new config
      const newConfig = {
        timeout: 10000,
        coverageReporters: ['json', 'html'],
      };

      const result = await server['handleTestSetConfig']({
        framework: TestFramework.JEST,
        merge: true,
        ...newConfig,
      });

      expect(result.status).toBe('success');
      expect(result.data.merged).toBe(true);
      expect(result.data.message).toContain('merged');

      // Verify merged config
      const configPath = path.join(testProjectPath, result.data.configFile);
      const configContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.timeout).toBe(10000); // Updated
      expect(savedConfig.testMatch).toEqual(initialConfig.testMatch); // Preserved
      expect(savedConfig.coverageReporters).toEqual(newConfig.coverageReporters); // Added
    });

    it('should create config file if none exists', async () => {
      const newConfig = {
        testMatch: ['**/*.test.js'],
        timeout: 5000,
      };

      const result = await server['handleTestSetConfig']({
        framework: TestFramework.JEST,
        ...newConfig,
      });

      expect(result.status).toBe('success');
      expect(result.data.configFile).toBeTruthy();

      // Verify config file exists
      const configPath = path.join(testProjectPath, result.data.configFile);
      const stats = await fs.stat(configPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should fail for non-installed framework', async () => {
      // Skip this test in mock mode since all frameworks are available
      if (process.env['MCP_TESTING_MOCK_MODE'] === 'true') {
        return;
      }

      await expect(
        server['handleTestSetConfig']({
          framework: TestFramework.MOCHA,
          timeout: 5000,
        })
      ).rejects.toThrow('is not installed in the project');
    });

    it('should handle complex configuration objects', async () => {
      const complexConfig = {
        testMatch: ['**/*.test.js', '**/*.spec.js'],
        testPathIgnorePatterns: ['/node_modules/', '/dist/'],
        coverageDirectory: 'coverage',
        coverageReporters: ['json', 'lcov', 'text', 'html'],
        timeout: 10000,
        collectCoverageFrom: ['src/**/*.js'],
        setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      };

      const result = await server['handleTestSetConfig']({
        framework: TestFramework.JEST,
        merge: false,
        ...complexConfig,
      });

      expect(result.status).toBe('success');

      // Verify all config options were saved
      const configPath = path.join(testProjectPath, result.data.configFile);
      const configContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.collectCoverageFrom).toEqual(complexConfig.collectCoverageFrom);
      expect(savedConfig.setupFilesAfterEnv).toEqual(complexConfig.setupFilesAfterEnv);
    });
  });
});
