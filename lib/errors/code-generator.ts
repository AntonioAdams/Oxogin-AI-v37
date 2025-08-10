// Error Code Generator for New Files

import { generateNextErrorCode } from "./error-codes"

export interface NewFileErrorCodes {
  fileCode: string
  errorCodes: Record<string, string>
  registryEntry: string
}

export function generateErrorCodesForNewFile(
  module: string,
  fileName: string,
  errorNames: string[],
): NewFileErrorCodes {
  const modulePrefix = module.toUpperCase().substring(0, 3)
  const { nextFileCode } = generateNextErrorCode(module)

  const errorCodes: Record<string, string> = {}
  const registryEntry = `
  ${fileName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}: {
    FILE_CODE: "${nextFileCode}",
    ERRORS: {`

  errorNames.forEach((errorName, index) => {
    const errorCode = `${modulePrefix}${nextFileCode}${(index + 1).toString().padStart(3, "0")}`
    errorCodes[errorName] = errorCode
  })

  const registryEntryComplete =
    registryEntry +
    errorNames.map((name) => `      ${name}: "${errorCodes[name]}",`).join("\n") +
    `
    }
  },`

  return {
    fileCode: nextFileCode,
    errorCodes,
    registryEntry: registryEntryComplete,
  }
}

// CLI utility function to generate error codes
export function generateErrorCodesForFile(module: string, fileName: string, errorNames: string[]) {
  const result = generateErrorCodesForNewFile(module, fileName, errorNames)

  console.log(`\n🔢 Generated Error Codes for ${fileName}:`)
  console.log(`File Code: ${result.fileCode}`)
  console.log(`\nError Codes:`)
  Object.entries(result.errorCodes).forEach(([name, code]) => {
    console.log(`  ${name}: ${code}`)
  })

  console.log(`\n📝 Registry Entry to add to ERROR_CODE_REGISTRY:`)
  console.log(result.registryEntry)

  console.log(`\n💡 Usage Example:`)
  console.log(`import { ERROR_CODE_REGISTRY } from "@/lib/errors/error-codes"`)
  console.log(`import { ${module}Error } from "@/lib/errors/application-error"`)
  console.log(`
throw new ${module}Error(
  ERROR_CODE_REGISTRY.${fileName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}.ERRORS.${errorNames[0]},
  "Error message here",
  { file: "${fileName}", function: "functionName" }
)`)

  return result
}

// Example usage:
// generateErrorCodesForFile("TOOLTIP", "tooltip-animations", ["ANIMATION_FAILED", "INVALID_DURATION", "ELEMENT_NOT_FOUND"])
