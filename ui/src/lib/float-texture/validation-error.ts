export function getFloatTextureValidationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;

  return 'Failed to pack float texture data';
}
