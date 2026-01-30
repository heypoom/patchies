/**
 * Parses JavaScript errors to extract line numbers for syntax highlighting.
 *
 * When using `new Function()`, JavaScript SyntaxErrors contain line information
 * that needs to be adjusted due to the wrapper code we add.
 *
 * Browser-specific error formats:
 * - Firefox: error.lineNumber property (non-standard but reliable)
 * - Chrome/V8: Line info in stack trace like "<anonymous>:5:10"
 * - Safari: "line 5" in error message
 */

export interface JSErrorInfo {
  message: string;
  lineErrors: Record<number, string[]>;
}

/**
 * Extended Error interface for browser-specific properties.
 * Firefox adds lineNumber and columnNumber to Error objects.
 */
interface BrowserError extends Error {
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Lines of wrapper code added before user code in JSRunner.executeJavaScript.
 * This offset is subtracted from reported line numbers.
 * If you modify JSRunner preamble, you need to update this value.
 */
const WRAPPER_PREAMBLE_LINES = 7;

/**
 * Parse a JavaScript error to extract line information.
 *
 * @param error The error object (Error, SyntaxError, etc.)
 * @param codeLineCount Total number of lines in the user's code (for validation)
 * @param additionalOffset Extra lines to subtract (e.g., P5Manager adds 4 wrapper lines)
 * @returns Parsed error info with line numbers, or null if no line info found
 */
export function parseJSError(
  error: unknown,
  codeLineCount?: number,
  additionalOffset: number = 0
): JSErrorInfo | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const browserError = error as BrowserError;
  const message = error.message;

  // Try to extract line number from different browser-specific formats
  let lineNumber: number | null = null;

  // Firefox: Direct lineNumber property (most reliable for Firefox)
  // Firefox adds lineNumber directly to Error objects for SyntaxErrors
  if (lineNumber === null && typeof browserError.lineNumber === 'number') {
    lineNumber = browserError.lineNumber;
  }

  // Chrome/V8: Stack trace format "<anonymous>:5:10" or "anonymous>:5:10"
  if (lineNumber === null && error.stack) {
    const chromeMatch = error.stack.match(/<anonymous>:(\d+):(\d+)/);
    if (chromeMatch) {
      lineNumber = parseInt(chromeMatch[1], 10);
    }
  }

  // Chrome/V8 alternative: "anonymous>:5:10" (without angle bracket)
  if (lineNumber === null && error.stack) {
    const chromeAltMatch = error.stack.match(/anonymous>:(\d+):(\d+)/);
    if (chromeAltMatch) {
      lineNumber = parseInt(chromeAltMatch[1], 10);
    }
  }

  // Chrome/V8: "Function:5:10" format
  if (lineNumber === null && error.stack) {
    const functionMatch = error.stack.match(/Function:(\d+):(\d+)/);
    if (functionMatch) {
      lineNumber = parseInt(functionMatch[1], 10);
    }
  }

  // Chrome/V8: eval format - "eval at ... (<anonymous>:1:1), <anonymous>:5:10"
  if (lineNumber === null && error.stack) {
    const evalMatch = error.stack.match(/eval.*?<anonymous>:(\d+):(\d+)/);
    if (evalMatch) {
      lineNumber = parseInt(evalMatch[1], 10);
    }
  }

  // Safari/WebKit: "line 5" in error message
  if (lineNumber === null) {
    const safariMatch = message.match(/line (\d+)/i);
    if (safariMatch) {
      lineNumber = parseInt(safariMatch[1], 10);
    }
  }

  // Safari: Stack trace format - look for numbers after file path pattern
  // Safari stack traces look like: "global code@...:5:10"
  if (lineNumber === null && error.stack) {
    // Match pattern like ":5:10" at end of a line (line:column)
    const safariStackMatch = error.stack.match(/@[^:]+:(\d+):(\d+)/);
    if (safariStackMatch) {
      lineNumber = parseInt(safariStackMatch[1], 10);
    }
  }

  if (lineNumber === null) {
    return null;
  }

  // Adjust for wrapper code offset (JSRunner preamble + any additional offset)
  const adjustedLine = lineNumber - WRAPPER_PREAMBLE_LINES - additionalOffset;

  // Validate and clamp line number to user code bounds
  if (adjustedLine < 1) {
    // Error is in the preamble - shouldn't happen, but clamp to line 1
    return {
      message,
      lineErrors: { 1: [message] }
    };
  }

  // If error line is past user code (e.g., SyntaxError pointing to wrapper's closing brace),
  // clamp to the last line of user code since that's where the actual error is
  let finalLine = adjustedLine;
  if (codeLineCount !== undefined && adjustedLine > codeLineCount) {
    finalLine = codeLineCount;
  }

  return {
    message,
    lineErrors: {
      [finalLine]: [message]
    }
  };
}

/**
 * Count the number of lines in a code string.
 */
export function countLines(code: string): number {
  return code.split('\n').length;
}
