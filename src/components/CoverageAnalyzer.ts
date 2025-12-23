/**
 * CoverageAnalyzer component
 *
 * Analyzes test coverage and generates reports with support for
 * multiple frameworks, coverage gap identification, trend tracking,
 * and threshold enforcement.
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TestFramework,
  TestResult,
  CoverageReport,
  CoverageMetrics,
  CoveragePercentage,
  FileCoverage,
  LineCoverage,
  BranchCoverage,
  FunctionCoverage,
  CoverageGap,
  CoverageThresholds,
  ThresholdViolation,
  CoverageTrend,
  TimeRange,
  ReportFormat,
} from '../types';

/**
 * Coverage data from test frameworks
 */
interface RawCoverageData {
  [file: string]: {
    path: string;
    statementMap?: Record<string, { start: { line: number }; end: { line: number } }>;
    fnMap?: Record<string, { name: string; line: number }>;
    branchMap?: Record<string, { line: number; locations: Array<{ start: { line: number } }> }>;
    s?: Record<string, number>; // Statement hits
    f?: Record<string, number>; // Function hits
    b?: Record<string, number[]>; // Branch hits
  };
}

/**
 * CoverageAnalyzer class
 *
 * Analyzes test coverage with support for multiple frameworks,
 * gap identification, trend tracking, and report generation
 */
export class CoverageAnalyzer {
  private coverageHistory: CoverageTrend[] = [];
  private coverageDataPath: string;

  constructor(coverageDataPath?: string) {
    this.coverageDataPath = coverageDataPath || path.join(process.cwd(), 'coverage');
  }

  /**
   * Analyze coverage from test run
   *
   * @param testResults - Test results from test execution
   * @param framework - Test framework used
   * @returns Promise resolving to coverage report
   */
  async analyzeCoverage(
    testResults: TestResult[],
    framework: TestFramework
  ): Promise<CoverageReport> {
    // Load raw coverage data from framework-specific location
    const rawCoverage = await this.loadRawCoverage(framework);

    // Parse coverage data into our format
    const coverageReport = this.parseCoverageData(rawCoverage, framework);

    // Store in history for trend analysis
    this.coverageHistory.push({
      timestamp: new Date().toISOString(),
      metrics: coverageReport.overall,
    });

    // Persist history
    await this.saveCoverageHistory();

    return coverageReport;
  }

  /**
   * Get coverage gaps
   *
   * @param coverageReport - Coverage report to analyze
   * @returns Array of coverage gaps
   */
  getCoverageGaps(coverageReport: CoverageReport): CoverageGap[] {
    const gaps: CoverageGap[] = [];

    // Analyze each file for gaps
    for (const [filePath, fileCoverage] of Object.entries(coverageReport.files)) {
      // Find uncovered line ranges
      const lineGaps = this.findLineGaps(fileCoverage);
      gaps.push(...lineGaps.map((gap) => ({ ...gap, file: filePath })));

      // Find uncovered branches
      const branchGaps = this.findBranchGaps(fileCoverage);
      gaps.push(...branchGaps.map((gap) => ({ ...gap, file: filePath })));

      // Find uncovered functions
      const functionGaps = this.findFunctionGaps(fileCoverage);
      gaps.push(...functionGaps.map((gap) => ({ ...gap, file: filePath })));
    }

    return gaps;
  }

  /**
   * Generate coverage report in specified format
   *
   * @param coverageReport - Coverage report to export
   * @param format - Report format
   * @returns Promise resolving to report content as string
   */
  async generateReport(coverageReport: CoverageReport, format: ReportFormat): Promise<string> {
    switch (format) {
      case ReportFormat.JSON:
        return this.generateJsonReport(coverageReport);

      case ReportFormat.HTML:
        return this.generateHtmlReport(coverageReport);

      case ReportFormat.LCOV:
        return this.generateLcovReport(coverageReport);

      case ReportFormat.COBERTURA:
        return this.generateCoberturaReport(coverageReport);

      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Check coverage thresholds
   *
   * @param coverageReport - Coverage report to check
   * @param thresholds - Coverage thresholds
   * @returns Array of threshold violations
   */
  checkThresholds(
    coverageReport: CoverageReport,
    thresholds: CoverageThresholds
  ): ThresholdViolation[] {
    const violations: ThresholdViolation[] = [];

    // Check overall thresholds
    if (thresholds.lines && coverageReport.overall.lines.percentage < thresholds.lines) {
      violations.push({
        metric: 'lines',
        actual: coverageReport.overall.lines.percentage,
        threshold: thresholds.lines,
      });
    }

    if (thresholds.branches && coverageReport.overall.branches.percentage < thresholds.branches) {
      violations.push({
        metric: 'branches',
        actual: coverageReport.overall.branches.percentage,
        threshold: thresholds.branches,
      });
    }

    if (
      thresholds.functions &&
      coverageReport.overall.functions.percentage < thresholds.functions
    ) {
      violations.push({
        metric: 'functions',
        actual: coverageReport.overall.functions.percentage,
        threshold: thresholds.functions,
      });
    }

    if (
      thresholds.statements &&
      coverageReport.overall.statements.percentage < thresholds.statements
    ) {
      violations.push({
        metric: 'statements',
        actual: coverageReport.overall.statements.percentage,
        threshold: thresholds.statements,
      });
    }

    return violations;
  }

  /**
   * Get coverage trends over time
   *
   * @param timeRange - Time range for trend analysis
   * @returns Promise resolving to coverage trends
   */
  async getCoverageTrends(timeRange: TimeRange): Promise<CoverageTrend[]> {
    // Load coverage history if not already loaded
    if (this.coverageHistory.length === 0) {
      await this.loadCoverageHistory();
    }

    // Filter by time range
    const startTime = new Date(timeRange.start).getTime();
    const endTime = new Date(timeRange.end).getTime();

    return this.coverageHistory.filter((trend) => {
      const trendTime = new Date(trend.timestamp).getTime();
      return trendTime >= startTime && trendTime <= endTime;
    });
  }

  /**
   * Load raw coverage data from framework-specific location
   *
   * @param framework - Test framework
   * @returns Promise resolving to raw coverage data
   */
  private async loadRawCoverage(framework: TestFramework): Promise<RawCoverageData> {
    let coverageFile: string;

    switch (framework) {
      case TestFramework.JEST:
      case TestFramework.VITEST:
        coverageFile = path.join(this.coverageDataPath, 'coverage-final.json');
        break;

      case TestFramework.MOCHA:
        coverageFile = path.join(this.coverageDataPath, 'coverage.json');
        break;

      case TestFramework.PYTEST:
        // Pytest uses coverage.py which generates .coverage file
        // We'll look for the JSON export
        coverageFile = path.join(this.coverageDataPath, 'coverage.json');
        break;

      default:
        throw new Error(`Coverage analysis not supported for framework: ${framework}`);
    }

    try {
      const content = await fs.readFile(coverageFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load coverage data from ${coverageFile}: ${error}`);
    }
  }

  /**
   * Parse raw coverage data into our format
   *
   * @param rawCoverage - Raw coverage data from framework
   * @param framework - Test framework
   * @returns Coverage report
   */
  private parseCoverageData(
    rawCoverage: RawCoverageData,
    framework: TestFramework
  ): CoverageReport {
    const files: Record<string, FileCoverage> = {};
    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    // Parse each file's coverage
    for (const [filePath, fileData] of Object.entries(rawCoverage)) {
      const fileCoverage = this.parseFileCoverage(fileData);
      files[filePath] = fileCoverage;

      // Aggregate metrics
      totalLines += fileCoverage.metrics.lines.total;
      coveredLines += fileCoverage.metrics.lines.covered;
      totalBranches += fileCoverage.metrics.branches.total;
      coveredBranches += fileCoverage.metrics.branches.covered;
      totalFunctions += fileCoverage.metrics.functions.total;
      coveredFunctions += fileCoverage.metrics.functions.covered;
      totalStatements += fileCoverage.metrics.statements.total;
      coveredStatements += fileCoverage.metrics.statements.covered;
    }

    // Calculate overall metrics
    const overall: CoverageMetrics = {
      lines: this.calculatePercentage(coveredLines, totalLines),
      branches: this.calculatePercentage(coveredBranches, totalBranches),
      functions: this.calculatePercentage(coveredFunctions, totalFunctions),
      statements: this.calculatePercentage(coveredStatements, totalStatements),
    };

    return {
      overall,
      files,
      timestamp: new Date().toISOString(),
      framework,
    };
  }

  /**
   * Parse file coverage data
   *
   * @param fileData - Raw file coverage data
   * @returns File coverage
   */
  private parseFileCoverage(fileData: RawCoverageData[string]): FileCoverage {
    const lines: Record<number, LineCoverage> = {};
    const branches: BranchCoverage[] = [];
    const functions: FunctionCoverage[] = [];

    // Parse line coverage
    if (fileData.statementMap && fileData.s) {
      for (const [id, statement] of Object.entries(fileData.statementMap)) {
        const hits = fileData.s[id] || 0;
        const lineNum = statement.start.line;

        if (!lines[lineNum]) {
          lines[lineNum] = {
            line: lineNum,
            hits: 0,
            covered: false,
          };
        }

        lines[lineNum].hits += hits;
        lines[lineNum].covered = lines[lineNum].hits > 0;
      }
    }

    // Parse branch coverage
    if (fileData.branchMap && fileData.b) {
      for (const [id, branch] of Object.entries(fileData.branchMap)) {
        const branchHits = fileData.b[id] || [];
        branchHits.forEach((hits, index) => {
          branches.push({
            line: branch.line,
            branch: index,
            taken: hits > 0,
          });
        });
      }
    }

    // Parse function coverage
    if (fileData.fnMap && fileData.f) {
      for (const [id, fn] of Object.entries(fileData.fnMap)) {
        const hits = fileData.f[id] || 0;
        functions.push({
          name: fn.name,
          line: fn.line,
          hits,
          covered: hits > 0,
        });
      }
    }

    // Calculate file metrics
    const lineArray = Object.values(lines);
    const metrics: CoverageMetrics = {
      lines: this.calculatePercentage(lineArray.filter((l) => l.covered).length, lineArray.length),
      branches: this.calculatePercentage(branches.filter((b) => b.taken).length, branches.length),
      functions: this.calculatePercentage(
        functions.filter((f) => f.covered).length,
        functions.length
      ),
      statements: this.calculatePercentage(
        lineArray.filter((l) => l.covered).length,
        lineArray.length
      ),
    };

    return {
      path: fileData.path,
      metrics,
      lines,
      branches,
      functions,
    };
  }

  /**
   * Calculate coverage percentage
   *
   * @param covered - Number of covered items
   * @param total - Total number of items
   * @returns Coverage percentage details
   */
  private calculatePercentage(covered: number, total: number): CoveragePercentage {
    const percentage = total > 0 ? (covered / total) * 100 : 100;

    return {
      total,
      covered,
      skipped: 0,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Find line coverage gaps
   *
   * @param fileCoverage - File coverage data
   * @returns Array of line gaps
   */
  private findLineGaps(fileCoverage: FileCoverage): Omit<CoverageGap, 'file'>[] {
    const gaps: Omit<CoverageGap, 'file'>[] = [];
    const lineNumbers = Object.keys(fileCoverage.lines)
      .map(Number)
      .sort((a, b) => a - b);

    let gapStart: number | null = null;

    for (const lineNum of lineNumbers) {
      const line = fileCoverage.lines[lineNum];

      if (!line.covered) {
        if (gapStart === null) {
          gapStart = lineNum;
        }
      } else {
        if (gapStart !== null) {
          gaps.push({
            startLine: gapStart,
            endLine: lineNum - 1,
            type: 'line',
            suggestion: `Add tests to cover lines ${gapStart}-${lineNum - 1}`,
          });
          gapStart = null;
        }
      }
    }

    // Handle gap at end of file
    if (gapStart !== null) {
      const lastLine = lineNumbers[lineNumbers.length - 1];
      gaps.push({
        startLine: gapStart,
        endLine: lastLine,
        type: 'line',
        suggestion: `Add tests to cover lines ${gapStart}-${lastLine}`,
      });
    }

    return gaps;
  }

  /**
   * Find branch coverage gaps
   *
   * @param fileCoverage - File coverage data
   * @returns Array of branch gaps
   */
  private findBranchGaps(fileCoverage: FileCoverage): Omit<CoverageGap, 'file'>[] {
    const gaps: Omit<CoverageGap, 'file'>[] = [];

    // Group branches by line
    const branchesByLine = new Map<number, BranchCoverage[]>();
    for (const branch of fileCoverage.branches) {
      if (!branchesByLine.has(branch.line)) {
        branchesByLine.set(branch.line, []);
      }
      branchesByLine.get(branch.line)!.push(branch);
    }

    // Find lines with uncovered branches
    for (const [line, branches] of branchesByLine.entries()) {
      const uncoveredBranches = branches.filter((b) => !b.taken);
      if (uncoveredBranches.length > 0) {
        gaps.push({
          startLine: line,
          endLine: line,
          type: 'branch',
          suggestion: `Add tests to cover ${uncoveredBranches.length} uncovered branch(es) at line ${line}`,
        });
      }
    }

    return gaps;
  }

  /**
   * Find function coverage gaps
   *
   * @param fileCoverage - File coverage data
   * @returns Array of function gaps
   */
  private findFunctionGaps(fileCoverage: FileCoverage): Omit<CoverageGap, 'file'>[] {
    const gaps: Omit<CoverageGap, 'file'>[] = [];

    for (const func of fileCoverage.functions) {
      if (!func.covered) {
        gaps.push({
          startLine: func.line,
          endLine: func.line,
          type: 'function',
          suggestion: `Add tests to cover function '${func.name}' at line ${func.line}`,
        });
      }
    }

    return gaps;
  }

  /**
   * Generate JSON format report
   *
   * @param coverageReport - Coverage report
   * @returns JSON string
   */
  private generateJsonReport(coverageReport: CoverageReport): string {
    return JSON.stringify(coverageReport, null, 2);
  }

  /**
   * Generate HTML format report
   *
   * @param coverageReport - Coverage report
   * @returns HTML string
   */
  private generateHtmlReport(coverageReport: CoverageReport): string {
    const { overall } = coverageReport;

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Coverage Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .metric { display: inline-block; margin-right: 30px; }
    .metric-label { font-weight: bold; }
    .metric-value { font-size: 24px; }
    .good { color: #28a745; }
    .warning { color: #ffc107; }
    .bad { color: #dc3545; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #333; color: white; }
    tr:hover { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Coverage Report</h1>
  <div class="summary">
    <div class="metric">
      <div class="metric-label">Lines</div>
      <div class="metric-value ${this.getColorClass(overall.lines.percentage)}">${overall.lines.percentage.toFixed(2)}%</div>
      <div>${overall.lines.covered}/${overall.lines.total}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Branches</div>
      <div class="metric-value ${this.getColorClass(overall.branches.percentage)}">${overall.branches.percentage.toFixed(2)}%</div>
      <div>${overall.branches.covered}/${overall.branches.total}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Functions</div>
      <div class="metric-value ${this.getColorClass(overall.functions.percentage)}">${overall.functions.percentage.toFixed(2)}%</div>
      <div>${overall.functions.covered}/${overall.functions.total}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Statements</div>
      <div class="metric-value ${this.getColorClass(overall.statements.percentage)}">${overall.statements.percentage.toFixed(2)}%</div>
      <div>${overall.statements.covered}/${overall.statements.total}</div>
    </div>
  </div>
  <h2>File Coverage</h2>
  <table>
    <thead>
      <tr>
        <th>File</th>
        <th>Lines</th>
        <th>Branches</th>
        <th>Functions</th>
        <th>Statements</th>
      </tr>
    </thead>
    <tbody>`;

    for (const [filePath, fileCoverage] of Object.entries(coverageReport.files)) {
      html += `
      <tr>
        <td>${filePath}</td>
        <td class="${this.getColorClass(fileCoverage.metrics.lines.percentage)}">${fileCoverage.metrics.lines.percentage.toFixed(2)}%</td>
        <td class="${this.getColorClass(fileCoverage.metrics.branches.percentage)}">${fileCoverage.metrics.branches.percentage.toFixed(2)}%</td>
        <td class="${this.getColorClass(fileCoverage.metrics.functions.percentage)}">${fileCoverage.metrics.functions.percentage.toFixed(2)}%</td>
        <td class="${this.getColorClass(fileCoverage.metrics.statements.percentage)}">${fileCoverage.metrics.statements.percentage.toFixed(2)}%</td>
      </tr>`;
    }

    html += `
    </tbody>
  </table>
  <p><small>Generated at ${coverageReport.timestamp}</small></p>
</body>
</html>`;

    return html;
  }

  /**
   * Generate LCOV format report
   *
   * @param coverageReport - Coverage report
   * @returns LCOV string
   */
  private generateLcovReport(coverageReport: CoverageReport): string {
    let lcov = '';

    for (const [filePath, fileCoverage] of Object.entries(coverageReport.files)) {
      lcov += `TN:\n`;
      lcov += `SF:${filePath}\n`;

      // Function coverage
      for (const func of fileCoverage.functions) {
        lcov += `FN:${func.line},${func.name}\n`;
      }
      for (const func of fileCoverage.functions) {
        lcov += `FNDA:${func.hits},${func.name}\n`;
      }
      lcov += `FNF:${fileCoverage.metrics.functions.total}\n`;
      lcov += `FNH:${fileCoverage.metrics.functions.covered}\n`;

      // Branch coverage
      for (const branch of fileCoverage.branches) {
        lcov += `BRDA:${branch.line},0,${branch.branch},${branch.taken ? '1' : '0'}\n`;
      }
      lcov += `BRF:${fileCoverage.metrics.branches.total}\n`;
      lcov += `BRH:${fileCoverage.metrics.branches.covered}\n`;

      // Line coverage
      for (const [lineNum, line] of Object.entries(fileCoverage.lines)) {
        lcov += `DA:${lineNum},${line.hits}\n`;
      }
      lcov += `LF:${fileCoverage.metrics.lines.total}\n`;
      lcov += `LH:${fileCoverage.metrics.lines.covered}\n`;

      lcov += `end_of_record\n`;
    }

    return lcov;
  }

  /**
   * Generate Cobertura format report
   *
   * @param coverageReport - Coverage report
   * @returns Cobertura XML string
   */
  private generateCoberturaReport(coverageReport: CoverageReport): string {
    const { overall } = coverageReport;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<coverage line-rate="${(overall.lines.percentage / 100).toFixed(4)}" branch-rate="${(overall.branches.percentage / 100).toFixed(4)}" timestamp="${Date.now()}" version="1.0">
  <sources>
    <source>${process.cwd()}</source>
  </sources>
  <packages>
    <package name="." line-rate="${(overall.lines.percentage / 100).toFixed(4)}" branch-rate="${(overall.branches.percentage / 100).toFixed(4)}">
      <classes>`;

    for (const [filePath, fileCoverage] of Object.entries(coverageReport.files)) {
      const lineRate = (fileCoverage.metrics.lines.percentage / 100).toFixed(4);
      const branchRate = (fileCoverage.metrics.branches.percentage / 100).toFixed(4);

      xml += `
        <class name="${filePath}" filename="${filePath}" line-rate="${lineRate}" branch-rate="${branchRate}">
          <methods>`;

      for (const func of fileCoverage.functions) {
        xml += `
            <method name="${func.name}" signature="" line-rate="${func.covered ? '1.0000' : '0.0000'}">
              <lines>
                <line number="${func.line}" hits="${func.hits}"/>
              </lines>
            </method>`;
      }

      xml += `
          </methods>
          <lines>`;

      for (const [lineNum, line] of Object.entries(fileCoverage.lines)) {
        xml += `
            <line number="${lineNum}" hits="${line.hits}" branch="false"/>`;
      }

      xml += `
          </lines>
        </class>`;
    }

    xml += `
      </classes>
    </package>
  </packages>
</coverage>`;

    return xml;
  }

  /**
   * Get color class based on coverage percentage
   *
   * @param percentage - Coverage percentage
   * @returns CSS class name
   */
  private getColorClass(percentage: number): string {
    if (percentage >= 80) return 'good';
    if (percentage >= 50) return 'warning';
    return 'bad';
  }

  /**
   * Save coverage history to disk
   *
   * @returns Promise that resolves when history is saved
   */
  private async saveCoverageHistory(): Promise<void> {
    const historyFile = path.join(this.coverageDataPath, 'coverage-history.json');

    try {
      await fs.mkdir(this.coverageDataPath, { recursive: true });
      await fs.writeFile(historyFile, JSON.stringify(this.coverageHistory, null, 2));
    } catch (error) {
      console.error(`Failed to save coverage history: ${error}`);
    }
  }

  /**
   * Load coverage history from disk
   *
   * @returns Promise that resolves when history is loaded
   */
  private async loadCoverageHistory(): Promise<void> {
    const historyFile = path.join(this.coverageDataPath, 'coverage-history.json');

    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      this.coverageHistory = JSON.parse(content);
    } catch (error) {
      // History file doesn't exist yet, start with empty history
      this.coverageHistory = [];
    }
  }
}
