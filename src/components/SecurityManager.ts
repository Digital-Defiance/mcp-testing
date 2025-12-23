/**
 * SecurityManager component
 *
 * Enforces security policies for test execution including framework allowlists,
 * resource limits, audit logging, and dangerous operation blocking.
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework, TestRunOptions } from '../types';
import { ValidationResult } from './FrameworkDetector';

/**
 * Security configuration
 */
export interface SecurityConfig {
  allowedFrameworks: TestFramework[];
  allowedTestPaths: string[];
  maxConcurrentTests: number;
  maxTestDuration: number;
  resourceLimits: ResourceLimits;
  enableAuditLog: boolean;
  auditLogPath?: string;
  blockShellCommands: boolean;
  blockNetworkAccess?: boolean;
  blockFileSystemWrite?: boolean;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  maxCpuPercent: number;
  maxMemoryMB: number;
  maxDiskUsageMB: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  user: string;
  parameters: unknown;
  result: 'success' | 'failure';
  error?: string;
}

/**
 * Operation type
 */
export interface Operation {
  type: string;
  description: string;
  parameters: unknown;
}

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedFrameworks: [
    TestFramework.JEST,
    TestFramework.MOCHA,
    TestFramework.PYTEST,
    TestFramework.VITEST,
  ],
  allowedTestPaths: ['test', 'tests', '__tests__', 'spec', 'specs', 'src'],
  maxConcurrentTests: 4,
  maxTestDuration: 300000, // 5 minutes
  resourceLimits: {
    maxCpuPercent: 80,
    maxMemoryMB: 2048,
    maxDiskUsageMB: 1024,
  },
  enableAuditLog: true,
  blockShellCommands: true,
  blockNetworkAccess: false,
  blockFileSystemWrite: false,
};

/**
 * SecurityManager class
 *
 * Manages security policies and enforcement for test execution
 */
export class SecurityManager {
  private config: SecurityConfig;
  private auditLog: AuditLogEntry[] = [];
  private activeProcesses: Map<number, { startTime: number; framework: TestFramework }> = new Map();

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * Validate test execution request
   *
   * @param options - Test run options
   * @returns Validation result
   */
  validateTestExecution(options: TestRunOptions): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check framework allowlist
    if (!this.isFrameworkAllowed(options.framework)) {
      result.valid = false;
      result.errors.push(
        `Framework ${options.framework} is not in the security allowlist. ` +
          `Allowed frameworks: ${this.config.allowedFrameworks.join(', ')}`
      );
    }

    // Check test path
    if (options.testPath) {
      // For absolute paths, check if any part of the path contains an allowed directory
      // For relative paths, check if it starts with an allowed path
      const isAbsolutePath = path.isAbsolute(options.testPath);
      const isPathAllowed = this.config.allowedTestPaths.some((allowedPath) => {
        if (isAbsolutePath) {
          // For absolute paths, check if the path contains the allowed directory
          return (
            options.testPath!.includes(`/${allowedPath}/`) ||
            options.testPath!.includes(`/${allowedPath}.`) ||
            options.testPath!.endsWith(`/${allowedPath}`)
          );
        } else {
          // For relative paths, check if it starts with the allowed path
          return options.testPath!.startsWith(allowedPath);
        }
      });

      if (!isPathAllowed) {
        result.warnings.push(
          `Test path ${options.testPath} does not match standard test directories. ` +
            `Recommended paths: ${this.config.allowedTestPaths.join(', ')}`
        );
      }
    }

    // Check concurrent test limit
    if (this.activeProcesses.size >= this.config.maxConcurrentTests) {
      result.valid = false;
      result.errors.push(
        `Maximum concurrent tests (${this.config.maxConcurrentTests}) reached. ` +
          `Please wait for running tests to complete.`
      );
    }

    // Check timeout
    if (options.timeout && options.timeout > this.config.maxTestDuration) {
      result.warnings.push(
        `Requested timeout ${options.timeout}ms exceeds maximum allowed ${this.config.maxTestDuration}ms. ` +
          `Timeout will be capped at maximum.`
      );
    }

    // Check for dangerous patterns in test path
    if (options.testPath) {
      const dangerousPatterns = ['../', '~/', '/etc/', '/root/', '/sys/', '/proc/'];
      const hasDangerousPattern = dangerousPatterns.some((pattern) =>
        options.testPath!.includes(pattern)
      );

      if (hasDangerousPattern) {
        result.valid = false;
        result.errors.push(
          `Test path ${options.testPath} contains dangerous patterns. ` +
            `Path traversal and system directories are not allowed.`
        );
      }
    }

    return result;
  }

  /**
   * Check if framework is allowed
   *
   * @param framework - Test framework
   * @returns True if framework is allowed
   */
  isFrameworkAllowed(framework: TestFramework): boolean {
    return this.config.allowedFrameworks.includes(framework);
  }

  /**
   * Enforce resource limits on a process
   *
   * @param processId - Process ID
   * @returns Promise that resolves when enforcement is complete
   */
  async enforceResourceLimits(processId: number): Promise<void> {
    // Register the process
    const processInfo = this.activeProcesses.get(processId);
    if (!processInfo) {
      throw new Error(`Process ${processId} not registered with SecurityManager`);
    }

    // Check if process has exceeded time limit
    const elapsed = Date.now() - processInfo.startTime;
    if (elapsed > this.config.maxTestDuration) {
      await this.terminateProcess(processId, 'timeout');
      throw new Error(
        `Process ${processId} exceeded maximum duration of ${this.config.maxTestDuration}ms`
      );
    }

    // In a real implementation, we would check CPU and memory usage here
    // For now, we'll just log that we're monitoring
    await this.auditOperation(
      {
        type: 'resource_check',
        description: 'Resource limit check',
        parameters: { processId },
      },
      'system',
      { processId, elapsed }
    );
  }

  /**
   * Register a process for monitoring
   *
   * @param processId - Process ID
   * @param framework - Test framework
   */
  registerProcess(processId: number, framework: TestFramework): void {
    this.activeProcesses.set(processId, {
      startTime: Date.now(),
      framework,
    });
  }

  /**
   * Unregister a process
   *
   * @param processId - Process ID
   */
  unregisterProcess(processId: number): void {
    this.activeProcesses.delete(processId);
  }

  /**
   * Terminate a process
   *
   * @param processId - Process ID
   * @param reason - Termination reason
   */
  private async terminateProcess(processId: number, reason: string): Promise<void> {
    try {
      // In a real implementation, we would kill the process here
      // For now, just unregister it
      this.unregisterProcess(processId);

      await this.auditOperation(
        {
          type: 'process_terminated',
          description: `Process terminated: ${reason}`,
          parameters: { processId, reason },
        },
        'system',
        { processId, reason }
      );
    } catch (error) {
      console.error(`Error terminating process ${processId}: ${error}`);
    }
  }

  /**
   * Audit an operation
   *
   * @param operation - Operation details
   * @param user - User performing the operation
   * @param params - Operation parameters
   */
  async auditOperation(operation: Operation, user: string, params: unknown): Promise<void> {
    if (!this.config.enableAuditLog) {
      return;
    }

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      operation: operation.type,
      user,
      parameters: params,
      result: 'success',
    };

    this.auditLog.push(entry);

    // Write to file if path is configured
    if (this.config.auditLogPath) {
      try {
        const logLine = JSON.stringify(entry) + '\n';
        await fs.appendFile(this.config.auditLogPath, logLine, 'utf-8');
      } catch (error) {
        console.error(`Error writing to audit log: ${error}`);
      }
    }
  }

  /**
   * Audit a failed operation
   *
   * @param operation - Operation details
   * @param user - User performing the operation
   * @param params - Operation parameters
   * @param error - Error message
   */
  async auditFailure(
    operation: Operation,
    user: string,
    params: unknown,
    error: string
  ): Promise<void> {
    if (!this.config.enableAuditLog) {
      return;
    }

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      operation: operation.type,
      user,
      parameters: params,
      result: 'failure',
      error,
    };

    this.auditLog.push(entry);

    // Write to file if path is configured
    if (this.config.auditLogPath) {
      try {
        const logLine = JSON.stringify(entry) + '\n';
        await fs.appendFile(this.config.auditLogPath, logLine, 'utf-8');
      } catch (error) {
        console.error(`Error writing to audit log: ${error}`);
      }
    }
  }

  /**
   * Load security configuration from file
   *
   * @param configPath - Path to security config file
   * @returns Security configuration
   */
  async loadSecurityConfig(configPath: string): Promise<SecurityConfig> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const loadedConfig = JSON.parse(content) as Partial<SecurityConfig>;

      // Merge with defaults
      this.config = { ...DEFAULT_SECURITY_CONFIG, ...loadedConfig };

      return this.config;
    } catch (error) {
      console.error(`Error loading security config from ${configPath}: ${error}`);
      throw new Error(`Failed to load security configuration: ${error}`);
    }
  }

  /**
   * Check if an operation is dangerous
   *
   * @param operation - Operation to check
   * @returns True if operation is dangerous
   */
  isDangerousOperation(operation: Operation): boolean {
    const dangerousOperations = [
      'shell_command',
      'exec',
      'spawn',
      'eval',
      'require',
      'import',
      'file_write',
      'file_delete',
      'network_request',
    ];

    // Check if operation type is dangerous
    if (dangerousOperations.includes(operation.type)) {
      return true;
    }

    // Check for shell command patterns
    if (this.config.blockShellCommands) {
      const params = JSON.stringify(operation.parameters);
      const shellPatterns = [
        'rm -rf',
        'sudo',
        'chmod',
        'chown',
        'kill',
        'pkill',
        '&&',
        '||',
        ';',
        '|',
        '>',
        '<',
      ];

      return shellPatterns.some((pattern) => params.includes(pattern));
    }

    return false;
  }

  /**
   * Block a dangerous operation
   *
   * @param operation - Operation to block
   * @param user - User attempting the operation
   */
  async blockDangerousOperation(operation: Operation, user: string): Promise<void> {
    const error = `Dangerous operation ${operation.type} blocked by security policy`;

    await this.auditFailure(operation, user, operation.parameters, error);

    throw new Error(error);
  }

  /**
   * Get audit log entries
   *
   * @param limit - Maximum number of entries to return
   * @returns Array of audit log entries
   */
  getAuditLog(limit?: number): AuditLogEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Get current security configuration
   *
   * @returns Security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update security configuration
   *
   * @param config - Partial security configuration to update
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get active process count
   *
   * @returns Number of active processes
   */
  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }
}
