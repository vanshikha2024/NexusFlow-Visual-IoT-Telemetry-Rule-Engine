import { ERROR_CODES } from './constants.js';

/**
 * Creates a structured, actionable validation error object.
 *
 * @param {string} code - ERROR_CODES key
 * @param {string} field - JSON path or property location
 * @param {string} message - Clear, descriptive error explanation
 * @param {Object} [details={}] - Contextual metadata and actionable resolution hint
 * @returns {{ code: string, field: string, message: string, details: Object }}
 */
export const createValidationError = (code, field, message, details = {}) => {
  return {
    code,
    field,
    message,
    details,
  };
};

/**
 * Custom Error class representing graph parsing or validation failure.
 */
export class GraphValidationError extends Error {
  /**
   * @param {string} message
   * @param {Array<{ code: string, field: string, message: string, details?: Object }>} errors
   * @param {Array<{ code: string, field: string, message: string, details?: Object }>} [warnings=[]]
   */
  constructor(message, errors = [], warnings = []) {
    super(message);
    this.name = 'GraphValidationError';
    this.statusCode = 400;
    this.errors = errors;
    this.warnings = warnings;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}
