/**
 * JSON Schema definitions for MCP Testing Server tools
 *
 * @packageDocumentation
 */

/**
 * Test run tool schema
 */
export const testRunSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework to use',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file or directory',
    },
    pattern: {
      type: 'string' as const,
      description: 'Test name pattern to match',
    },
    watch: {
      type: 'boolean' as const,
      description: 'Enable watch mode',
    },
    coverage: {
      type: 'boolean' as const,
      description: 'Enable coverage analysis',
    },
    parallel: {
      type: 'boolean' as const,
      description: 'Enable parallel execution',
    },
    maxWorkers: {
      type: 'number' as const,
      description: 'Maximum number of parallel workers',
    },
    timeout: {
      type: 'number' as const,
      description: 'Test execution timeout in milliseconds',
    },
  },
  required: ['framework'],
};

/**
 * Test stop tool schema
 */
export const testStopSchema = {
  type: 'object' as const,
  properties: {
    runId: {
      type: 'string' as const,
      description: 'ID of the test run to stop',
    },
  },
  required: ['runId'],
};

/**
 * Test list tool schema
 */
export const testListSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file or directory',
    },
    pattern: {
      type: 'string' as const,
      description: 'Test name pattern to match',
    },
  },
  required: ['framework'],
};

/**
 * Test search tool schema
 */
export const testSearchSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    query: {
      type: 'string' as const,
      description: 'Search query',
    },
    searchBy: {
      type: 'string' as const,
      enum: ['name', 'tag', 'file', 'suite'],
      description: 'Search criteria',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file or directory',
    },
  },
  required: ['framework', 'query'],
};

/**
 * Coverage analyze tool schema
 */
export const coverageAnalyzeSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file or directory',
    },
    pattern: {
      type: 'string' as const,
      description: 'Test name pattern to match',
    },
    timeout: {
      type: 'number' as const,
      description: 'Test execution timeout in milliseconds',
    },
  },
  required: ['framework'],
};

/**
 * Coverage report tool schema
 */
export const coverageReportSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    format: {
      type: 'string' as const,
      enum: ['json', 'html', 'lcov', 'cobertura'],
      description: 'Report format',
    },
    outputPath: {
      type: 'string' as const,
      description: 'Output file path',
    },
  },
  required: ['framework', 'format'],
};

/**
 * Coverage gaps tool schema
 */
export const coverageGapsSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    threshold: {
      type: 'number' as const,
      description: 'Coverage threshold percentage',
      minimum: 0,
      maximum: 100,
    },
  },
  required: ['framework'],
};

/**
 * Coverage trends tool schema
 */
export const coverageTrendsSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    startDate: {
      type: 'string' as const,
      description: 'Start date for trend analysis',
    },
    endDate: {
      type: 'string' as const,
      description: 'End date for trend analysis',
    },
    branch: {
      type: 'string' as const,
      description: 'Git branch name',
    },
  },
  required: ['framework'],
};

/**
 * Coverage export tool schema
 */
export const coverageExportSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    format: {
      type: 'string' as const,
      enum: ['json', 'html', 'lcov', 'cobertura'],
      description: 'Export format',
    },
    outputPath: {
      type: 'string' as const,
      description: 'Output file path',
    },
  },
  required: ['framework', 'format', 'outputPath'],
};

/**
 * Test generate tool schema
 */
export const testGenerateSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to source file',
    },
    functionName: {
      type: 'string' as const,
      description: 'Function name to generate tests for',
    },
    includeEdgeCases: {
      type: 'boolean' as const,
      description: 'Include edge case tests',
    },
    includePropertyTests: {
      type: 'boolean' as const,
      description: 'Include property-based tests',
    },
  },
  required: ['framework', 'filePath'],
};

/**
 * Test generate from code tool schema
 */
export const testGenerateFromCodeSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to source file',
    },
    outputPath: {
      type: 'string' as const,
      description: 'Output path for generated tests',
    },
  },
  required: ['framework', 'filePath'],
};

/**
 * Test generate fixtures tool schema
 */
export const testGenerateFixturesSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to source file',
    },
  },
  required: ['framework', 'filePath'],
};

/**
 * Test suggest cases tool schema
 */
export const testSuggestCasesSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file',
    },
  },
  required: ['framework', 'testPath'],
};

/**
 * Test debug tool schema
 */
export const testDebugSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file',
    },
    testName: {
      type: 'string' as const,
      description: 'Test name',
    },
  },
  required: ['framework', 'testPath', 'testName'],
};

/**
 * Test analyze failure tool schema
 */
export const testAnalyzeFailureSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file',
    },
    testName: {
      type: 'string' as const,
      description: 'Test name',
    },
    errorMessage: {
      type: 'string' as const,
      description: 'Error message from test failure',
    },
  },
  required: ['framework', 'testPath', 'testName'],
};

/**
 * Test compare values tool schema
 */
export const testCompareValuesSchema = {
  type: 'object' as const,
  properties: {
    expected: {
      description: 'Expected value',
    },
    actual: {
      description: 'Actual value',
    },
    deep: {
      type: 'boolean' as const,
      description: 'Perform deep comparison',
    },
  },
  required: ['expected', 'actual'],
};

/**
 * Test detect flaky tool schema
 */
export const testDetectFlakySchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file',
    },
    testName: {
      type: 'string' as const,
      description: 'Test name',
    },
    iterations: {
      type: 'number' as const,
      description: 'Number of iterations to run',
    },
    timeout: {
      type: 'number' as const,
      description: 'Test execution timeout in milliseconds',
    },
  },
  required: ['framework'],
};

/**
 * Test mutation run tool schema
 */
export const testMutationRunSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to source file',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file',
    },
    timeout: {
      type: 'number' as const,
      description: 'Test execution timeout in milliseconds',
    },
  },
  required: ['framework', 'filePath'],
};

/**
 * Test impact analyze tool schema
 */
export const testImpactAnalyzeSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    gitDiff: {
      type: 'string' as const,
      description: 'Git diff output',
    },
    baseBranch: {
      type: 'string' as const,
      description: 'Base branch for comparison',
    },
    changedFiles: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
      },
      description: 'List of changed files',
    },
  },
  required: ['framework'],
};

/**
 * Test performance benchmark tool schema
 */
export const testPerformanceBenchmarkSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    testPath: {
      type: 'string' as const,
      description: 'Path to test file or directory',
    },
    pattern: {
      type: 'string' as const,
      description: 'Test name pattern to match',
    },
    slowThreshold: {
      type: 'number' as const,
      description: 'Slow test threshold in milliseconds',
    },
    includeHistory: {
      type: 'boolean' as const,
      description: 'Include historical performance data',
    },
    timeout: {
      type: 'number' as const,
      description: 'Test execution timeout in milliseconds',
    },
  },
  required: ['framework'],
};

/**
 * Test configure framework tool schema
 */
export const testConfigureFrameworkSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    configPath: {
      type: 'string' as const,
      description: 'Path to configuration file',
    },
  },
  required: ['framework'],
};

/**
 * Test get config tool schema
 */
export const testGetConfigSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
  },
  required: ['framework'],
};

/**
 * Test set config tool schema
 */
export const testSetConfigSchema = {
  type: 'object' as const,
  properties: {
    framework: {
      type: 'string' as const,
      enum: ['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava'],
      description: 'Test framework',
    },
    merge: {
      type: 'boolean' as const,
      description: 'Merge with existing configuration',
    },
  },
  required: ['framework'],
};
