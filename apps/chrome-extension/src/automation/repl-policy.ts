const NAVIGATION_PATTERNS = [
  /\bwindow\.location\s*=\s*['"`]/i,
  /\blocation\.href\s*=\s*['"`]/i,
  /\bwindow\.location\.href\s*=\s*['"`]/i,
  /\blocation\.assign\s*\(/i,
  /\blocation\.replace\s*\(/i,
  /\bwindow\.location\.assign\s*\(/i,
  /\bwindow\.location\.replace\s*\(/i,
  /\bhistory\.back\s*\(/i,
  /\bhistory\.forward\s*\(/i,
  /\bhistory\.go\s*\(/i,
];

export function validateReplCode(code: string): void {
  for (const pattern of NAVIGATION_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error("Use navigate() instead of window.location/history inside REPL code.");
    }
  }
}
