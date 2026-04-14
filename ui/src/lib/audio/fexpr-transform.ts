/**
 * Transform fexpr~ expression syntax to expr-eval compatible format.
 *
 * Conversions:
 * - $1, $2 → c1, c2 (control values)
 * - s[-1] → x1(-1) (bare s with history)
 * - x1[-1], s1[-2] → x1(-1), s1(-2) (function call syntax)
 * - y1[-1] → y1(-1) (output history)
 * - bare x1, s1 → x1(0), s1(0) (current sample)
 * - bare s → x1(0) (backwards compat)
 */
export const transformFExprExpression = (expressionString: string): string =>
  expressionString
    // Control values: $1 -> c1
    .replace(/\$(\d+)/g, 'c$1')
    // Bare s with history: s[-1] -> x1(-1) (must come before other s transformations)
    .replace(/\bs\[(-?\d+(?:\.\d+)?)\]/g, 'x1($1)')
    // Input history access: x1[-1] or s1[-1] -> x1(-1) or s1(-1)
    .replace(/([xs])(\d+)\[(-?\d+(?:\.\d+)?)\]/g, '$1$2($3)')
    // Output history access: y1[-1] -> y1(-1)
    .replace(/y(\d+)\[(-?\d+(?:\.\d+)?)\]/g, 'y$1($2)')
    // Bare x1, s1 without brackets -> x1(0), s1(0) (current sample)
    // Use negative lookahead to avoid transforming already-converted x1(
    .replace(/\b([xs])(\d+)\b(?!\s*\()/g, '$1$2(0)')
    // Bare `s` (not followed by digit or bracket) -> x1(0) for backwards compat with expr~
    .replace(/\bs\b(?![\d[])/g, 'x1(0)');
