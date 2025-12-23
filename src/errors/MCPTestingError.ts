/**
 * Custom error class for MCP Testing Server
 *
 * @packageDocumentation
 */

import {
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  ERROR_CATEGORY_MAP,
  ERROR_SEVERITY_MAP,
} from './ErrorCodes';

/**
 * Error details interface
 */
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: unknown;
  remediation: string;
  timestamp: string;
  requestId?: string;
  cause?: Error;
}

/**
 * Custom error class for MCP Testing Server
 */
export class MCPTestingError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly details?: unknown;
  public readonly remediation: string;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      details?: unknown;
      remediation?: string;
      requestId?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'MCPTestingError';
    this.code = code;
    this.severity = ERROR_SEVERITY_MAP[code];
    this.category = ERROR_CATEGORY_MAP[code];
    this.details = options?.details;
    this.remediation = options?.remediation || this.getDefaultRemediation(code);
    this.timestamp = new Date().toISOString();
    this.requestId = options?.requestId;
    this.cause = options?.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPTestingError);
    }
  }

  /**
   * Get default remediation message for error code
   */
  private getDefaultRemediation(code: ErrorCode): string {
    const remediations: Record<ErrorCode, string> = {
      // Test Execution
      [ErrorCode.FRAMEWORK_NOT_FOUND]:
        'Install the test framework via npm/pip or verify package.json dependencies',
      [ErrorCode.TEST_FILE_NOT_FOUND]: 'Verify the file path and ensure the file exists',
      [ErrorCode.TEST_EXECUTION_TIMEOUT]: 'Increase timeout or optimize slow tests',
      [ErrorCode.TEST_RUNNER_CRASH]: 'Check test code for infinite loops or memory leaks',
      [ErrorCode.TEST_EXECUTION_FAILED]: 'Review test output and fix failing tests',

      // Coverage
      [ErrorCode.COVERAGE_TOOL_NOT_FOUND]: 'Install coverage tool (e.g., nyc, coverage.py)',
      [ErrorCode.COVERAGE_PARSING_FAILED]: 'Verify coverage report format',
      [ErrorCode.COVERAGE_THRESHOLD_VIOLATION]: 'Write additional tests to improve coverage',
      [ErrorCode.COVERAGE_GENERATION_FAILED]: 'Check test framework coverage configuration',

      // Security
      [ErrorCode.FRAMEWORK_NOT_ALLOWED]: 'Add framework to allowlist in security configuration',
      [ErrorCode.RESOURCE_LIMIT_EXCEEDED]: 'Optimize tests or increase resource limits',
      [ErrorCode.DANGEROUS_OPERATION_BLOCKED]: 'Review security policy and operation necessity',
      [ErrorCode.SECURITY_VALIDATION_FAILED]:
        'Review security configuration and request parameters',

      // Integration
      [ErrorCode.MCP_SERVER_CONNECTION_FAILED]: 'Verify server is running and accessible',
      [ErrorCode.MCP_TOOL_CALL_FAILED]: 'Check server logs and tool parameters',
      [ErrorCode.INTEGRATION_TIMEOUT]: 'Increase timeout or check server performance',
      [ErrorCode.INTEGRATION_UNAVAILABLE]: 'Functionality will be limited without this integration',

      // Configuration
      [ErrorCode.INVALID_CONFIGURATION]: 'Fix configuration errors listed in message',
      [ErrorCode.CONFIGURATION_FILE_NOT_FOUND]: 'Create configuration file or use defaults',
      [ErrorCode.CONFIGURATION_PARSE_ERROR]: 'Fix syntax errors in configuration file',
      [ErrorCode.CONFIGURATION_VALIDATION_FAILED]:
        'Review configuration schema and fix validation errors',

      // Test Generation
      [ErrorCode.CODE_ANALYSIS_FAILED]: 'Verify code syntax and structure',
      [ErrorCode.TEST_TEMPLATE_NOT_FOUND]: 'Verify framework support or provide custom template',
      [ErrorCode.TEST_GENERATION_FAILED]: 'Simplify code or provide more context',
      [ErrorCode.FIXTURE_GENERATION_FAILED]: 'Review data schema and requirements',

      // General
      [ErrorCode.UNKNOWN_ERROR]: 'Contact support with error details',
      [ErrorCode.INTERNAL_ERROR]: 'Contact support with error details',
      [ErrorCode.INVALID_REQUEST]: 'Review request parameters and try again',
      [ErrorCode.OPERATION_CANCELLED]: 'Operation was cancelled by user or system',
    };

    return remediations[code] || 'Contact support for assistance';
  }

  /**
   * Convert error to JSON format
   */
  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      remediation: this.remediation,
      timestamp: this.timestamp,
      requestId: this.requestId,
      cause: this.cause,
    };
  }

  /**
   * Convert error to MCP error response format
   */
  toMCPResponse(): {
    status: 'error';
    error: {
      code: string;
      message: string;
      details?: unknown;
      remediation: string;
      timestamp: string;
      requestId?: string;
      severity: string;
      category: string;
    };
  } {
    return {
      status: 'error',
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        remediation: this.remediation,
        timestamp: this.timestamp,
        requestId: this.requestId,
        severity: this.severity,
        category: this.category,
      },
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.MCP_SERVER_CONNECTION_FAILED,
      ErrorCode.MCP_TOOL_CALL_FAILED,
      ErrorCode.INTEGRATION_TIMEOUT,
      ErrorCode.TEST_EXECUTION_TIMEOUT,
    ];
    return retryableCodes.includes(this.code);
  }

  /**
   * Check if error should trigger graceful degradation
   */
  shouldDegrade(): boolean {
    const degradableCodes = [
      ErrorCode.INTEGRATION_UNAVAILABLE,
      ErrorCode.MCP_SERVER_CONNECTION_FAILED,
      ErrorCode.COVERAGE_TOOL_NOT_FOUND,
      ErrorCode.TEST_TEMPLATE_NOT_FOUND,
    ];
    return degradableCodes.includes(this.code);
  }
}

/**
 * Factory functions for creating specific errors
 */
export class ErrorFactory {
  /**
   * Create framework not found error
   */
  static frameworkNotFound(framework: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.FRAMEWORK_NOT_FOUND,
      `Test framework '${framework}' not found or not installed`,
      { details: { framework }, requestId }
    );
  }

  /**
   * Create test file not found error
   */
  static testFileNotFound(path: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.TEST_FILE_NOT_FOUND,
      `Test file '${path}' does not exist`,
      {
        details: { path },
        requestId,
      }
    );
  }

  /**
   * Create test execution timeout error
   */
  static testExecutionTimeout(timeout: number, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.TEST_EXECUTION_TIMEOUT,
      `Test execution exceeded timeout of ${timeout}ms`,
      { details: { timeout }, requestId }
    );
  }

  /**
   * Create test runner crash error
   */
  static testRunnerCrash(error: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.TEST_RUNNER_CRASH,
      `Test runner process crashed: ${error}`,
      {
        details: { error },
        requestId,
      }
    );
  }

  /**
   * Create coverage tool not found error
   */
  static coverageToolNotFound(framework: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.COVERAGE_TOOL_NOT_FOUND,
      `Coverage tool for '${framework}' not found`,
      { details: { framework }, requestId }
    );
  }

  /**
   * Create coverage threshold violation error
   */
  static coverageThresholdViolation(
    metric: string,
    actual: number,
    threshold: number,
    requestId?: string
  ): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.COVERAGE_THRESHOLD_VIOLATION,
      `Coverage ${metric} is ${actual}%, below threshold of ${threshold}%`,
      { details: { metric, actual, threshold }, requestId }
    );
  }

  /**
   * Create framework not allowed error
   */
  static frameworkNotAllowed(framework: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.FRAMEWORK_NOT_ALLOWED,
      `Test framework '${framework}' is not in the security allowlist`,
      { details: { framework }, requestId }
    );
  }

  /**
   * Create resource limit exceeded error
   */
  static resourceLimitExceeded(
    resource: string,
    limit: number,
    requestId?: string
  ): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.RESOURCE_LIMIT_EXCEEDED,
      `Test execution exceeded ${resource} limit of ${limit}`,
      { details: { resource, limit }, requestId }
    );
  }

  /**
   * Create dangerous operation blocked error
   */
  static dangerousOperationBlocked(operation: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.DANGEROUS_OPERATION_BLOCKED,
      `Operation '${operation}' blocked for security reasons`,
      { details: { operation }, requestId }
    );
  }

  /**
   * Create MCP server connection failed error
   */
  static mcpServerConnectionFailed(
    server: string,
    error: string,
    requestId?: string
  ): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.MCP_SERVER_CONNECTION_FAILED,
      `Failed to connect to ${server}: ${error}`,
      { details: { server, error }, requestId }
    );
  }

  /**
   * Create MCP tool call failed error
   */
  static mcpToolCallFailed(
    tool: string,
    server: string,
    error: string,
    requestId?: string
  ): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.MCP_TOOL_CALL_FAILED,
      `Failed to call ${tool} on ${server}: ${error}`,
      { details: { tool, server, error }, requestId }
    );
  }

  /**
   * Create integration timeout error
   */
  static integrationTimeout(
    server: string,
    tool: string,
    timeout: number,
    requestId?: string
  ): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.INTEGRATION_TIMEOUT,
      `Call to ${server}.${tool} timed out after ${timeout}ms`,
      { details: { server, tool, timeout }, requestId }
    );
  }

  /**
   * Create invalid configuration error
   */
  static invalidConfiguration(errors: string[], requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.INVALID_CONFIGURATION,
      `Configuration validation failed: ${errors.join(', ')}`,
      { details: { errors }, requestId }
    );
  }

  /**
   * Create configuration file not found error
   */
  static configurationFileNotFound(path: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.CONFIGURATION_FILE_NOT_FOUND,
      `Configuration file '${path}' not found`,
      { details: { path }, requestId }
    );
  }

  /**
   * Create code analysis failed error
   */
  static codeAnalysisFailed(error: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.CODE_ANALYSIS_FAILED,
      `Failed to analyze code for test generation: ${error}`,
      { details: { error }, requestId }
    );
  }

  /**
   * Create integration unavailable error
   */
  static integrationUnavailable(server: string, requestId?: string): MCPTestingError {
    return new MCPTestingError(
      ErrorCode.INTEGRATION_UNAVAILABLE,
      `Integration with ${server} is unavailable`,
      { details: { server }, requestId }
    );
  }
}
