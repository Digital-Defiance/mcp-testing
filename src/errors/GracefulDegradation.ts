/**
 * Graceful degradation manager
 *
 * @packageDocumentation
 */

import { MCPTestingError } from './MCPTestingError';
import { ErrorCode } from './ErrorCodes';

/**
 * Feature availability status
 */
export enum FeatureStatus {
  AVAILABLE = 'available',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable',
}

/**
 * Feature definition
 */
export interface Feature {
  name: string;
  status: FeatureStatus;
  reason?: string;
  fallback?: () => Promise<any>;
}

/**
 * Degradation event
 */
export interface DegradationEvent {
  feature: string;
  status: FeatureStatus;
  reason: string;
  timestamp: string;
}

/**
 * Graceful degradation manager
 */
export class GracefulDegradationManager {
  private features: Map<string, Feature> = new Map();
  private listeners: Array<(event: DegradationEvent) => void> = [];

  /**
   * Register a feature
   */
  registerFeature(name: string, fallback?: () => Promise<any>): void {
    this.features.set(name, {
      name,
      status: FeatureStatus.AVAILABLE,
      fallback,
    });
  }

  /**
   * Mark feature as degraded
   */
  degradeFeature(name: string, reason: string): void {
    const feature = this.features.get(name);
    if (feature) {
      feature.status = FeatureStatus.DEGRADED;
      feature.reason = reason;

      this.notifyListeners({
        feature: name,
        status: FeatureStatus.DEGRADED,
        reason,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Mark feature as unavailable
   */
  disableFeature(name: string, reason: string): void {
    const feature = this.features.get(name);
    if (feature) {
      feature.status = FeatureStatus.UNAVAILABLE;
      feature.reason = reason;

      this.notifyListeners({
        feature: name,
        status: FeatureStatus.UNAVAILABLE,
        reason,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Restore feature to available
   */
  restoreFeature(name: string): void {
    const feature = this.features.get(name);
    if (feature) {
      feature.status = FeatureStatus.AVAILABLE;
      feature.reason = undefined;

      this.notifyListeners({
        feature: name,
        status: FeatureStatus.AVAILABLE,
        reason: 'Feature restored',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check if feature is available
   */
  isFeatureAvailable(name: string): boolean {
    const feature = this.features.get(name);
    return feature?.status === FeatureStatus.AVAILABLE;
  }

  /**
   * Check if feature is degraded
   */
  isFeatureDegraded(name: string): boolean {
    const feature = this.features.get(name);
    return feature?.status === FeatureStatus.DEGRADED;
  }

  /**
   * Check if feature is unavailable
   */
  isFeatureUnavailable(name: string): boolean {
    const feature = this.features.get(name);
    return feature?.status === FeatureStatus.UNAVAILABLE;
  }

  /**
   * Get feature status
   */
  getFeatureStatus(name: string): FeatureStatus | undefined {
    return this.features.get(name)?.status;
  }

  /**
   * Get all features
   */
  getAllFeatures(): Feature[] {
    return Array.from(this.features.values());
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback<T>(featureName: string, fn: () => Promise<T>): Promise<T> {
    const feature = this.features.get(featureName);

    if (!feature) {
      throw new Error(`Feature '${featureName}' not registered`);
    }

    // If feature is unavailable, use fallback
    if (feature.status === FeatureStatus.UNAVAILABLE) {
      if (feature.fallback) {
        return feature.fallback();
      }
      throw new MCPTestingError(
        ErrorCode.INTEGRATION_UNAVAILABLE,
        `Feature '${featureName}' is unavailable`,
        { details: { feature: featureName, reason: feature.reason } }
      );
    }

    try {
      return await fn();
    } catch (error) {
      // If error should trigger degradation, degrade the feature
      if (error instanceof MCPTestingError && error.shouldDegrade()) {
        this.degradeFeature(featureName, error.message);

        // Try fallback if available
        if (feature.fallback) {
          return feature.fallback();
        }
      }

      throw error;
    }
  }

  /**
   * Add listener for degradation events
   */
  onDegradation(listener: (event: DegradationEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (event: DegradationEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: DegradationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in degradation listener:', error);
      }
    });
  }

  /**
   * Reset all features
   */
  reset(): void {
    this.features.forEach((feature) => {
      feature.status = FeatureStatus.AVAILABLE;
      feature.reason = undefined;
    });
  }
}

/**
 * Global degradation manager instance
 */
export const degradationManager = new GracefulDegradationManager();

/**
 * Register common features
 */
export function registerCommonFeatures(): void {
  degradationManager.registerFeature('debugger-integration', async () => {
    console.warn('Debugger integration unavailable - debugging features disabled');
    return null;
  });

  degradationManager.registerFeature('screenshot-integration', async () => {
    console.warn('Screenshot integration unavailable - visual regression testing disabled');
    return null;
  });

  degradationManager.registerFeature('coverage-analysis', async () => {
    console.warn('Coverage analysis unavailable - running tests without coverage');
    return { overall: { lines: { percentage: 0 }, branches: { percentage: 0 } } };
  });

  degradationManager.registerFeature('test-generation', async () => {
    console.warn('Test generation unavailable - manual test writing required');
    return [];
  });
}
