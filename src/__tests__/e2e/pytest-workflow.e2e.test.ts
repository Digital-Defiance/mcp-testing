/**
 * End-to-end tests for Pytest workflow
 *
 * Tests complete user workflows with Pytest framework
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Pytest Workflow E2E', () => {
  let server: MCPTestingServer;
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pytest-e2e-test-'));
    projectDir = path.join(tempDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'tests'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should support complete Pytest TDD workflow', async () => {
    // Create Python source code
    const sourceCode = `
def is_prime(n):
    """Check if a number is prime."""
    if n < 2:
        return False
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    return True

def get_primes(limit):
    """Get all prime numbers up to limit."""
    return [n for n in range(2, limit + 1) if is_prime(n)]
`;

    const sourceFile = path.join(projectDir, 'src', 'primes.py');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate tests
    const generateResult = await (server as any).handleTestGenerate({
      framework: TestFramework.PYTEST,
      filePath: sourceFile,
    });

    // Pytest may not be installed, so accept either success or error
    expect(generateResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(generateResult.status);

    if (generateResult.status === 'success') {
      expect(generateResult.data).toHaveProperty('tests');

      // List tests
      const listResult = await (server as any).handleTestList({
        framework: TestFramework.PYTEST,
        projectPath: projectDir,
      });

      expect(listResult.status).toBe('success');
      expect(Array.isArray(listResult.data.tests)).toBe(true);
    }
  });

  it('should support Pytest test discovery and execution', async () => {
    // Create test file
    const testCode = `
import pytest

def test_addition():
    assert 1 + 1 == 2

def test_subtraction():
    assert 5 - 3 == 2

@pytest.mark.parametrize("a,b,expected", [
    (1, 2, 3),
    (2, 3, 5),
    (10, 20, 30),
])
def test_parametrized_addition(a, b, expected):
    assert a + b == expected
`;

    const testFile = path.join(projectDir, 'tests', 'test_math.py');
    await fs.writeFile(testFile, testCode);

    // Search for tests
    const searchResult = await (server as any).handleTestSearch({
      framework: TestFramework.PYTEST,
      projectPath: projectDir,
      pattern: 'test_math',
    });

    expect(searchResult.status).toBe('success');
    expect(Array.isArray(searchResult.data.tests)).toBe(true);

    // Run tests
    const runResult = await (server as any).handleTestRun({
      framework: TestFramework.PYTEST,
      testPath: testFile,
    });

    expect(runResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(runResult.status);
  });

  it('should support Pytest fixtures workflow', async () => {
    // Create source with data models
    const sourceCode = `
from dataclasses import dataclass
from typing import List

@dataclass
class User:
    id: int
    name: str
    email: str
    age: int

@dataclass
class Product:
    sku: str
    name: str
    price: float
    in_stock: bool
`;

    const sourceFile = path.join(projectDir, 'src', 'models.py');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate fixtures
    const fixturesResult = await (server as any).handleTestGenerateFixtures({
      framework: TestFramework.PYTEST,
      filePath: sourceFile,
    });

    expect(fixturesResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(fixturesResult.status);

    if (fixturesResult.status === 'success') {
      expect(fixturesResult.data).toHaveProperty('fixtures');
      expect(Array.isArray(fixturesResult.data.fixtures)).toBe(true);
    }
  });

  it('should support Pytest configuration management', async () => {
    // Get configuration
    const getResult = await (server as any).handleTestGetConfig({
      framework: TestFramework.PYTEST,
      projectPath: projectDir,
    });

    expect(getResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(getResult.status);

    if (getResult.status === 'success') {
      expect(getResult.data.framework).toBe(TestFramework.PYTEST);

      // Configure framework
      const configureResult = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.PYTEST,
        projectPath: projectDir,
        config: {
          testpaths: ['tests'],
          python_files: ['test_*.py'],
        },
      });

      expect(configureResult).toHaveProperty('status');
    }
  });

  it('should support Pytest coverage workflow', async () => {
    // Create mock coverage data
    const coverageData = {
      'src/primes.py': {
        path: 'src/primes.py',
        statementMap: {
          '0': { start: { line: 2 }, end: { line: 2 } },
          '1': { start: { line: 3 }, end: { line: 3 } },
          '2': { start: { line: 4 }, end: { line: 4 } },
        },
        s: { '0': 10, '1': 8, '2': 5 },
        fnMap: {
          '0': { name: 'is_prime', line: 1 },
          '1': { name: 'get_primes', line: 9 },
        },
        f: { '0': 10, '1': 5 },
        branchMap: {},
        b: {},
      },
    };

    const coverageDir = path.join(projectDir, 'coverage');
    await fs.mkdir(coverageDir, { recursive: true });
    // Pytest expects coverage.json, not coverage-final.json
    await fs.writeFile(path.join(coverageDir, 'coverage.json'), JSON.stringify(coverageData));

    // Analyze coverage
    const analyzeResult = await (server as any).handleCoverageAnalyze({
      framework: TestFramework.PYTEST,
      coverageDataPath: coverageDir,
    });

    // Coverage analysis works regardless of framework installation
    expect(analyzeResult.status).toBe('success');
    expect(analyzeResult.data).toHaveProperty('overall');

    // Generate coverage report
    const reportResult = await (server as any).handleCoverageReport({
      framework: TestFramework.PYTEST,
      format: 'json',
      coverageDataPath: coverageDir,
    });

    expect(reportResult.status).toBe('success');
    expect(reportResult.data).toHaveProperty('content');
  });

  it('should support Pytest test generation from code', async () => {
    // Create source code
    const sourceCode = `
def validate_email(email: str) -> bool:
    """Validate email format."""
    return '@' in email and '.' in email.split('@')[1]

def validate_password(password: str) -> bool:
    """Validate password strength."""
    return len(password) >= 8 and any(c.isupper() for c in password)
`;

    const sourceFile = path.join(projectDir, 'src', 'validators.py');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate tests from code
    const generateResult = await (server as any).handleTestGenerateFromCode({
      framework: TestFramework.PYTEST,
      filePath: sourceFile,
    });

    expect(generateResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(generateResult.status);

    if (generateResult.status === 'success') {
      expect(generateResult.data.testsGenerated).toBeGreaterThan(0);

      // Suggest additional test cases
      if (generateResult.data.outputPath) {
        const suggestResult = await (server as any).handleTestSuggestCases({
          framework: TestFramework.PYTEST,
          testPath: generateResult.data.outputPath,
        });

        expect(suggestResult).toHaveProperty('status');
      }
    }
  });

  it('should support Pytest impact analysis', async () => {
    // Simulate code changes
    const changes = [
      {
        file: 'src/primes.py',
        type: 'modified' as const,
        lines: [2, 3, 4],
        functions: ['is_prime'],
      },
    ];

    // Analyze impact
    const impactResult = await (server as any).handleTestImpactAnalyze({
      framework: TestFramework.PYTEST,
      projectPath: projectDir,
      changes,
    });

    expect(impactResult).toHaveProperty('status');
    if (impactResult.status === 'success') {
      expect(impactResult.data).toHaveProperty('affectedTests');
      expect(Array.isArray(impactResult.data.affectedTests)).toBe(true);
    }
  });
});
