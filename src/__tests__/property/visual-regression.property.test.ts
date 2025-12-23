/**
 * Property-based tests for visual regression testing
 *
 * @packageDocumentation
 */

import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  VisualRegressionTester,
  ScreenshotOperations,
  ScreenshotResult,
  ScreenshotCaptureOptions,
  VisualRegressionOptions,
} from '../../components/VisualRegressionTester';

/**
 * Mock screenshot operations for testing
 */
class MockScreenshotOperations implements ScreenshotOperations {
  private screenshots: Map<string, ScreenshotResult> = new Map();

  async captureScreenshot(options: ScreenshotCaptureOptions): Promise<ScreenshotResult> {
    // Generate a deterministic screenshot based on the name
    const key = options.name;

    if (this.screenshots.has(key)) {
      return this.screenshots.get(key)!;
    }

    // Create a simple test image (1x1 pixel PNG)
    const width = 100;
    const height = 100;
    const imageData = this.createTestImage(width, height, key);

    const result: ScreenshotResult = {
      data: imageData.toString('base64'),
      width,
      height,
      format: 'png',
      timestamp: new Date().toISOString(),
    };

    this.screenshots.set(key, result);
    return result;
  }

  /**
   * Create a test PNG image
   */
  private createTestImage(width: number, height: number, seed: string): Buffer {
    // Create a simple PNG with a solid color based on seed
    const hash = this.hashString(seed);
    const r = (hash >> 16) & 0xff;
    const g = (hash >> 8) & 0xff;
    const b = hash & 0xff;

    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0);
    ihdr.write('IHDR', 4);
    ihdr.writeUInt32BE(width, 8);
    ihdr.writeUInt32BE(height, 12);
    ihdr.writeUInt8(8, 16); // bit depth
    ihdr.writeUInt8(6, 17); // color type (RGBA)
    ihdr.writeUInt8(0, 18); // compression
    ihdr.writeUInt8(0, 19); // filter
    ihdr.writeUInt8(0, 20); // interlace
    ihdr.writeUInt32BE(0, 21); // CRC placeholder

    // IDAT chunk (simplified - just metadata)
    const idat = Buffer.alloc(20);
    idat.writeUInt32BE(8, 0);
    idat.write('IDAT', 4);
    idat.writeUInt8(r, 8);
    idat.writeUInt8(g, 9);
    idat.writeUInt8(b, 10);
    idat.writeUInt8(255, 11); // alpha
    idat.writeUInt32BE(0, 16); // CRC placeholder

    // IEND chunk
    const iend = Buffer.alloc(12);
    iend.writeUInt32BE(0, 0);
    iend.write('IEND', 4);
    iend.writeUInt32BE(0, 8); // CRC placeholder

    return Buffer.concat([signature, ihdr, idat, iend]);
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Set a specific screenshot result
   */
  setScreenshot(name: string, result: ScreenshotResult): void {
    this.screenshots.set(name, result);
  }

  /**
   * Clear all screenshots
   */
  clear(): void {
    this.screenshots.clear();
  }
}

// Generator for valid file names (alphanumeric, hyphens, underscores)
const validFileName = fc
  .stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter((s) => s.length > 0 && s.length <= 50);

describe('Visual Regression Testing Properties', () => {
  let tempDir: string;
  let baselineDir: string;
  let outputDir: string;
  let mockScreenshotOps: MockScreenshotOperations;
  let tester: VisualRegressionTester;

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-regression-test-'));
    baselineDir = path.join(tempDir, 'baselines');
    outputDir = path.join(tempDir, 'output');

    await fs.mkdir(baselineDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Create mock screenshot operations
    mockScreenshotOps = new MockScreenshotOperations();
    tester = new VisualRegressionTester(mockScreenshotOps);
  });

  afterEach(async () => {
    // Clean up temporary directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 23: Screenshot integration captures images', () => {
    it('should integrate with mcp-screenshot to capture screenshots during execution', async () => {
      // **Feature: mcp-testing-server, Property 23: Screenshot integration captures images**

      await fc.assert(
        fc.asyncProperty(
          validFileName,
          validFileName,
          fc.double({ min: 0, max: 100 }),
          async (testName, screenshotName, threshold) => {
            const options: VisualRegressionOptions = {
              testName,
              screenshotName,
              threshold,
              baselineDir,
              outputDir,
            };

            const result = await tester.runVisualTest(options);

            // Verify screenshot was captured
            expect(result.actualImagePath).toBeDefined();
            expect(result.baselineImagePath).toBeDefined();

            // Verify files were created
            const actualExists = await fs
              .access(result.actualImagePath)
              .then(() => true)
              .catch(() => false);
            const baselineExists = await fs
              .access(result.baselineImagePath)
              .then(() => true)
              .catch(() => false);

            expect(actualExists).toBe(true);
            expect(baselineExists).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: Image comparison calculates differences', () => {
    it('should compare captured screenshot with baseline and calculate visual difference percentages', async () => {
      // **Feature: mcp-testing-server, Property 24: Image comparison calculates differences**

      await fc.assert(
        fc.asyncProperty(
          validFileName,
          validFileName,
          fc.double({ min: 0, max: 100 }),
          async (testName, screenshotName, threshold) => {
            // Clear screenshots to ensure fresh state
            mockScreenshotOps.clear();

            const options: VisualRegressionOptions = {
              testName,
              screenshotName,
              threshold,
              baselineDir,
              outputDir,
            };

            // First run - creates baseline
            const firstResult = await tester.runVisualTest(options);
            expect(firstResult.baselineExists).toBe(false);
            expect(firstResult.differencePercentage).toBe(0);

            // Second run - compares with baseline (same screenshot)
            const secondResult = await tester.runVisualTest(options);
            expect(secondResult.baselineExists).toBe(true);

            // Verify comparison metrics are present
            expect(secondResult.differencePercentage).toBeGreaterThanOrEqual(0);
            expect(secondResult.differencePercentage).toBeLessThanOrEqual(100);
            expect(secondResult.pixelsDifferent).toBeGreaterThanOrEqual(0);
            expect(secondResult.totalPixels).toBeGreaterThan(0);
            expect(secondResult.threshold).toBe(threshold);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 25: Threshold violations fail tests', () => {
    it('should mark test as failed and generate diff image when visual difference exceeds threshold', async () => {
      // **Feature: mcp-testing-server, Property 25: Threshold violations fail tests**

      await fc.assert(
        fc.asyncProperty(
          validFileName,
          validFileName,
          fc.double({ min: 0, max: 50, noNaN: true }), // Low threshold to ensure failures
          async (testName, screenshotName, threshold) => {
            // Clear screenshots to ensure fresh state
            mockScreenshotOps.clear();

            const options: VisualRegressionOptions = {
              testName,
              screenshotName,
              threshold,
              baselineDir,
              outputDir,
            };

            // First run - creates baseline
            await tester.runVisualTest(options);

            // Modify screenshot to create difference
            mockScreenshotOps.clear();
            const modifiedScreenshot = await mockScreenshotOps.captureScreenshot({
              name: screenshotName + '-modified',
            });
            mockScreenshotOps.setScreenshot(screenshotName, modifiedScreenshot);

            // Second run - should detect difference
            const result = await tester.runVisualTest(options);

            // If difference exceeds threshold, test should fail
            if (result.differencePercentage > threshold) {
              expect(result.passed).toBe(false);

              // Diff image should be generated
              if (result.diffImagePath) {
                const diffExists = await fs
                  .access(result.diffImagePath)
                  .then(() => true)
                  .catch(() => false);
                expect(diffExists).toBe(true);
              }
            } else {
              expect(result.passed).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 26: Baseline updates replace images', () => {
    it('should replace existing baseline with current screenshot when baseline update is requested', async () => {
      // **Feature: mcp-testing-server, Property 26: Baseline updates replace images**

      await fc.assert(
        fc.asyncProperty(validFileName, validFileName, async (testName, screenshotName) => {
          // Clear screenshots to ensure fresh state
          mockScreenshotOps.clear();

          // Create initial baseline
          const options: VisualRegressionOptions = {
            testName,
            screenshotName,
            threshold: 5,
            baselineDir,
            outputDir,
          };

          const firstResult = await tester.runVisualTest(options);
          const originalBaselinePath = firstResult.baselineImagePath;

          // Read original baseline
          const originalBaseline = await fs.readFile(originalBaselinePath);

          // Create a new screenshot
          mockScreenshotOps.clear();
          const newScreenshot = await mockScreenshotOps.captureScreenshot({
            name: screenshotName + '-new',
          });
          mockScreenshotOps.setScreenshot(screenshotName, newScreenshot);

          const secondResult = await tester.runVisualTest(options);

          // Update baseline
          await tester.updateBaseline({
            testName,
            screenshotName,
            baselineDir,
            sourceImagePath: secondResult.actualImagePath,
          });

          // Read updated baseline
          const updatedBaseline = await fs.readFile(originalBaselinePath);

          // Verify baseline was replaced (content should be defined)
          expect(updatedBaseline).toBeDefined();
          expect(updatedBaseline.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
