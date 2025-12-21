import { STATION_BRANDS, StationIdentity } from '../../config/station-identity'

export interface ValidationResult {
  nodeId: string
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validates a station's configuration against the Ueno Station benchmark standards.
 * Enforces the "Zero-One" standardization workflow requirements.
 */
export class StationValidator {
  
  /**
   * Validates a specific station node configuration.
   * @param nodeId The unique identifier for the station node
   */
  static validate(nodeId: string): ValidationResult {
    const result: ValidationResult = {
      nodeId,
      isValid: true,
      errors: [],
      warnings: []
    }

    // 1. Check Identity Configuration
    const identity = STATION_BRANDS[nodeId]
    if (!identity) {
      result.errors.push(`Missing StationIdentity configuration for nodeId: ${nodeId}`)
      result.isValid = false
      return result
    }

    // 2. Validate Identity Fields (Schema Check)
    this.validateIdentityFields(identity, result)

    // 3. Validate Visual Standards (Contrast/Accessibility)
    this.validateVisualStandards(identity, result)

    return result
  }

  /**
   * Validates all registered stations in the system.
   */
  static validateAll(): ValidationResult[] {
    return Object.keys(STATION_BRANDS).map(id => this.validate(id))
  }

  private static validateIdentityFields(identity: StationIdentity, result: ValidationResult) {
    if (!identity.color || !identity.color.startsWith('#')) {
      result.errors.push(`Invalid brand color: ${identity.color}. Must be a hex code.`)
    }
    if (!identity.textColor || !identity.textColor.startsWith('#')) {
      result.errors.push(`Invalid text color: ${identity.textColor}. Must be a hex code.`)
    }
    if (!identity.lineCode) {
      result.errors.push('Missing lineCode (e.g., "JY").')
    }
    if (!identity.operatorName) {
      result.errors.push('Missing operatorName (e.g., "JR East").')
    }
  }

  private static validateVisualStandards(identity: StationIdentity, result: ValidationResult) {
    // Basic hex check - in a real app, we would use a library to check WCAG contrast
    // Here we just warn if colors seem identical
    if (identity.color.toLowerCase() === identity.textColor.toLowerCase()) {
      result.warnings.push('Brand color and text color are identical. Legibility may be compromised.')
    }
  }
}
