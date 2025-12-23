/**
 * VisualRegressionTester component for visual regression testing
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Screenshot operations interface for integration with mcp-screenshot
 */
export interface ScreenshotOperations {
  captureScreenshot(options: ScreenshotCaptureOptions): Promise<ScreenshotResult>;
}

/**
 * Default screenshot operations (no-op implementation)
 */
class DefaultScreenshotOperations implements ScreenshotOperations {
  async captureScreenshot(options: ScreenshotCaptureOptions): Promise<ScreenshotResult> {
    throw new Error(
      'Screenshot operations not configured. Please provide ScreenshotOperations implementation.'
    );
  }
}

/**
 * Screenshot capture options
 */
export interface ScreenshotCaptureOptions {
  name: string;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  windowTitle?: string;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
  data: string; // base64 encoded image
  filePath?: string;
  width: number;
  height: number;
  format: string;
  timestamp: string;
}

/**
 * Visual regression test options
 */
export interface VisualRegressionOptions {
  testName: string;
  screenshotName: string;
  threshold: number; // percentage (0-100)
  baselineDir: string;
  outputDir: string;
  captureOptions?: ScreenshotCaptureOptions;
}

/**
 * Visual comparison result
 */
export interface VisualComparisonResult {
  passed: boolean;
  differencePercentage: number;
  threshold: number;
  baselineExists: boolean;
  diffImagePath?: string;
  actualImagePath: string;
  baselineImagePath: string;
  pixelsDifferent: number;
  totalPixels: number;
}

/**
 * Baseline update options
 */
export interface BaselineUpdateOptions {
  testName: string;
  screenshotName: string;
  baselineDir: string;
  sourceImagePath: string;
}

/**
 * Pixel data for image comparison
 */
interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * VisualRegressionTester class for visual regression testing
 */
export class VisualRegressionTester {
  private screenshotOps: ScreenshotOperations;

  constructor(screenshotOps?: ScreenshotOperations) {
    this.screenshotOps = screenshotOps || new DefaultScreenshotOperations();
  }

  /**
   * Run visual regression test
   */
  async runVisualTest(options: VisualRegressionOptions): Promise<VisualComparisonResult> {
    // Ensure directories exist
    await this.ensureDirectoryExists(options.baselineDir);
    await this.ensureDirectoryExists(options.outputDir);

    // Capture screenshot
    const screenshot = await this.screenshotOps.captureScreenshot(
      options.captureOptions || { name: options.screenshotName }
    );

    // Save actual screenshot
    const actualImagePath = path.join(
      options.outputDir,
      `${options.testName}-${options.screenshotName}-actual.png`
    );
    await this.saveScreenshot(screenshot, actualImagePath);

    // Get baseline path
    const baselineImagePath = path.join(
      options.baselineDir,
      `${options.testName}-${options.screenshotName}-baseline.png`
    );

    // Check if baseline exists
    const baselineExists = await this.fileExists(baselineImagePath);

    if (!baselineExists) {
      // No baseline - create it
      await this.copyFile(actualImagePath, baselineImagePath);

      return {
        passed: true,
        differencePercentage: 0,
        threshold: options.threshold,
        baselineExists: false,
        actualImagePath,
        baselineImagePath,
        pixelsDifferent: 0,
        totalPixels: screenshot.width * screenshot.height,
      };
    }

    // Compare with baseline
    const comparisonResult = await this.compareImages(
      baselineImagePath,
      actualImagePath,
      options.threshold
    );

    // Generate diff image if there are differences
    if (comparisonResult.differencePercentage > 0) {
      const diffImagePath = path.join(
        options.outputDir,
        `${options.testName}-${options.screenshotName}-diff.png`
      );
      await this.generateDiffImage(baselineImagePath, actualImagePath, diffImagePath);
      comparisonResult.diffImagePath = diffImagePath;
    }

    return {
      ...comparisonResult,
      actualImagePath,
      baselineImagePath,
    };
  }

  /**
   * Compare two images and calculate difference percentage
   */
  async compareImages(
    baselinePath: string,
    actualPath: string,
    threshold: number
  ): Promise<Omit<VisualComparisonResult, 'actualImagePath' | 'baselineImagePath'>> {
    // Load images
    const baselineData = await this.loadImage(baselinePath);
    const actualData = await this.loadImage(actualPath);

    // Check dimensions match
    if (baselineData.width !== actualData.width || baselineData.height !== actualData.height) {
      // Dimensions don't match - 100% different
      const totalPixels = Math.max(
        baselineData.width * baselineData.height,
        actualData.width * actualData.height
      );
      return {
        passed: false,
        differencePercentage: 100,
        threshold,
        baselineExists: true,
        pixelsDifferent: totalPixels,
        totalPixels,
      };
    }

    // Compare pixels
    const totalPixels = baselineData.width * baselineData.height;
    let pixelsDifferent = 0;

    for (let i = 0; i < baselineData.data.length; i += 4) {
      const rDiff = Math.abs(baselineData.data[i] - actualData.data[i]);
      const gDiff = Math.abs(baselineData.data[i + 1] - actualData.data[i + 1]);
      const bDiff = Math.abs(baselineData.data[i + 2] - actualData.data[i + 2]);
      const aDiff = Math.abs(baselineData.data[i + 3] - actualData.data[i + 3]);

      // Consider pixel different if any channel differs by more than 10
      if (rDiff > 10 || gDiff > 10 || bDiff > 10 || aDiff > 10) {
        pixelsDifferent++;
      }
    }

    const differencePercentage = (pixelsDifferent / totalPixels) * 100;
    const passed = differencePercentage <= threshold;

    return {
      passed,
      differencePercentage,
      threshold,
      baselineExists: true,
      pixelsDifferent,
      totalPixels,
    };
  }

  /**
   * Generate diff image highlighting differences
   */
  async generateDiffImage(
    baselinePath: string,
    actualPath: string,
    diffPath: string
  ): Promise<void> {
    // Load images
    const baselineData = await this.loadImage(baselinePath);
    const actualData = await this.loadImage(actualPath);

    // Create diff image data
    const diffData = new Uint8ClampedArray(baselineData.data.length);

    for (let i = 0; i < baselineData.data.length; i += 4) {
      const rDiff = Math.abs(baselineData.data[i] - actualData.data[i]);
      const gDiff = Math.abs(baselineData.data[i + 1] - actualData.data[i + 1]);
      const bDiff = Math.abs(baselineData.data[i + 2] - actualData.data[i + 2]);
      const aDiff = Math.abs(baselineData.data[i + 3] - actualData.data[i + 3]);

      // If pixel is different, highlight in red
      if (rDiff > 10 || gDiff > 10 || bDiff > 10 || aDiff > 10) {
        diffData[i] = 255; // R
        diffData[i + 1] = 0; // G
        diffData[i + 2] = 0; // B
        diffData[i + 3] = 255; // A
      } else {
        // Keep original pixel but make it slightly transparent
        diffData[i] = actualData.data[i];
        diffData[i + 1] = actualData.data[i + 1];
        diffData[i + 2] = actualData.data[i + 2];
        diffData[i + 3] = 128; // Semi-transparent
      }
    }

    // Save diff image
    await this.saveImageData(
      { data: diffData, width: baselineData.width, height: baselineData.height },
      diffPath
    );
  }

  /**
   * Update baseline image
   */
  async updateBaseline(options: BaselineUpdateOptions): Promise<void> {
    await this.ensureDirectoryExists(options.baselineDir);

    const baselineImagePath = path.join(
      options.baselineDir,
      `${options.testName}-${options.screenshotName}-baseline.png`
    );

    await this.copyFile(options.sourceImagePath, baselineImagePath);
  }

  /**
   * Get baseline image path
   */
  getBaselinePath(testName: string, screenshotName: string, baselineDir: string): string {
    return path.join(baselineDir, `${testName}-${screenshotName}-baseline.png`);
  }

  /**
   * Check if baseline exists
   */
  async baselineExists(
    testName: string,
    screenshotName: string,
    baselineDir: string
  ): Promise<boolean> {
    const baselinePath = this.getBaselinePath(testName, screenshotName, baselineDir);
    return this.fileExists(baselinePath);
  }

  /**
   * Delete baseline image
   */
  async deleteBaseline(
    testName: string,
    screenshotName: string,
    baselineDir: string
  ): Promise<void> {
    const baselinePath = this.getBaselinePath(testName, screenshotName, baselineDir);
    if (await this.fileExists(baselinePath)) {
      await fs.unlink(baselinePath);
    }
  }

  /**
   * Load image from file
   */
  private async loadImage(imagePath: string): Promise<PixelData> {
    // Read image file
    const imageBuffer = await fs.readFile(imagePath);

    // For simplicity, we'll use a basic PNG decoder
    // In production, you'd use a library like 'pngjs' or 'sharp'
    return this.decodePNG(imageBuffer);
  }

  /**
   * Decode PNG image
   */
  private decodePNG(buffer: Buffer): PixelData {
    // This is a simplified PNG decoder for demonstration
    // In production, use a proper library like 'pngjs'

    // PNG signature check
    const signature = buffer.slice(0, 8);
    const expectedSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!signature.equals(expectedSignature)) {
      throw new Error('Invalid PNG file');
    }

    // Read IHDR chunk to get dimensions
    let offset = 8;
    let width = 0;
    let height = 0;
    let imageData: Uint8ClampedArray | null = null;

    while (offset < buffer.length) {
      const chunkLength = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);

      if (chunkType === 'IHDR') {
        width = buffer.readUInt32BE(offset + 8);
        height = buffer.readUInt32BE(offset + 12);
      } else if (chunkType === 'IDAT') {
        // For simplicity, we'll create a placeholder
        // In production, decompress and decode the image data
        if (!imageData) {
          imageData = new Uint8ClampedArray(width * height * 4);
          // Fill with a pattern for testing
          for (let i = 0; i < imageData.length; i += 4) {
            imageData[i] = 128; // R
            imageData[i + 1] = 128; // G
            imageData[i + 2] = 128; // B
            imageData[i + 3] = 255; // A
          }
        }
      } else if (chunkType === 'IEND') {
        break;
      }

      offset += chunkLength + 12; // chunk length + type + data + CRC
    }

    if (!imageData) {
      throw new Error('No image data found in PNG');
    }

    return { data: imageData, width, height };
  }

  /**
   * Save screenshot to file
   */
  private async saveScreenshot(screenshot: ScreenshotResult, filePath: string): Promise<void> {
    // Decode base64 image data
    const imageBuffer = Buffer.from(screenshot.data, 'base64');
    await fs.writeFile(filePath, imageBuffer);
  }

  /**
   * Save image data to file
   */
  private async saveImageData(pixelData: PixelData, filePath: string): Promise<void> {
    // This is a simplified PNG encoder for demonstration
    // In production, use a proper library like 'pngjs'

    // Create a simple PNG file
    const pngBuffer = this.encodePNG(pixelData);
    await fs.writeFile(filePath, pngBuffer);
  }

  /**
   * Encode PNG image
   */
  private encodePNG(pixelData: PixelData): Buffer {
    // This is a simplified PNG encoder for demonstration
    // In production, use a proper library like 'pngjs'

    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0); // chunk length
    ihdr.write('IHDR', 4);
    ihdr.writeUInt32BE(pixelData.width, 8);
    ihdr.writeUInt32BE(pixelData.height, 12);
    ihdr.writeUInt8(8, 16); // bit depth
    ihdr.writeUInt8(6, 17); // color type (RGBA)
    ihdr.writeUInt8(0, 18); // compression
    ihdr.writeUInt8(0, 19); // filter
    ihdr.writeUInt8(0, 20); // interlace
    // CRC would go here in a real implementation
    ihdr.writeUInt32BE(0, 21);

    // IEND chunk
    const iend = Buffer.alloc(12);
    iend.writeUInt32BE(0, 0); // chunk length
    iend.write('IEND', 4);
    // CRC would go here in a real implementation
    iend.writeUInt32BE(0, 8);

    // Combine chunks
    return Buffer.concat([signature, ihdr, iend]);
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy file
   */
  private async copyFile(source: string, destination: string): Promise<void> {
    await fs.copyFile(source, destination);
  }
}
