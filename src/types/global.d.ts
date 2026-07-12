/**
 * Global type definitions
 *
 * This file contains type definitions that are used throughout the application.
 */

declare global {
  /**
   * Represents a generic object type with string keys and any value type.
   * Use this instead of `Record<string, any>` for better maintainability.
   */
  type Recordable<T = any> = Record<string, T>;

}

export {};
