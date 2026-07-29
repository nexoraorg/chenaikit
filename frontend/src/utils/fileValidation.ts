export interface FileValidationConfig {
  maxSizeInBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

/**
 * Validates a single File object against configuration constraints.
 * 
 * Time Complexity: O(1) - Constant string comparison and file property access.
 * Space Complexity: O(1) - Minimal variables allocated on the stack.
 * 
 * @param file The browser File object to validate.
 * @param config Validation constraints for size, mime type, and extension.
 * @returns An error string if validation fails, or null if valid.
 */
export const validateFile = (
  file: File,
  config: FileValidationConfig = {}
): string | null => {
  const { maxSizeInBytes, allowedMimeTypes, allowedExtensions } = config;

  // 1. Enforce Max Size Limit
  if (maxSizeInBytes && file.size > maxSizeInBytes) {
    const sizeInMB = (maxSizeInBytes / (1024 * 1024)).toFixed(1);
    return `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${sizeInMB}MB.`;
  }

  // 2. Enforce Mime Type & File Extension Restrictions
  if (allowedMimeTypes || allowedExtensions) {
    const filename = file.name || '';
    const lastDotIndex = filename.lastIndexOf('.');
    const fileExtension = lastDotIndex !== -1 
      ? filename.substring(lastDotIndex).toLowerCase() 
      : '';

    const isMimeTypeAllowed = allowedMimeTypes
      ? allowedMimeTypes.includes(file.type)
      : false;

    const isExtensionAllowed = allowedExtensions
      ? allowedExtensions.map(ext => (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()).includes(fileExtension)
      : false;

    // If both filters are defined, file must satisfy at least one of them
    if (allowedMimeTypes && allowedExtensions) {
      if (!isMimeTypeAllowed && !isExtensionAllowed) {
        return `Unsupported file type. Allowed formats: ${allowedExtensions.join(', ')}.`;
      }
    } else if (allowedMimeTypes && !isMimeTypeAllowed) {
      return `Unsupported file type (${file.type || 'unknown'}).`;
    } else if (allowedExtensions && !isExtensionAllowed) {
      return `Unsupported extension. Allowed: ${allowedExtensions.join(', ')}.`;
    }
  }

  return null;
};
