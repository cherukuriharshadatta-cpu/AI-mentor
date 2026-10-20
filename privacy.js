/* Shared redaction and text-only boundaries. No logging or network access. */
(function (root) {
  'use strict';
  function redact(value, max = 12000) {
    return String(value || '').slice(0, 100000)
      .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[PRIVATE KEY REMOVED]')
      .replace(/\b(?:sk-(?:or-)?[\w-]{12,}|gh[pousr]_[\w]{15,}|github_pat_[\w]{15,}|AIza[\w-]{25,}|AKIA[A-Z0-9]{16}|xox[baprs]-[\w-]{10,})\b/g, '[SECRET REMOVED]')
      .replace(/((?:api[_ -]?key|secret|access[_ -]?token|password|authorization)\s*["']?\s*[:=]\s*)(?:["'][^"'\n]*["']|[^\s,;}]+)/gi, '$1[SECRET REMOVED]')
      .replace(/\bBearer\s+[\w.~+\/-]+=*/gi, 'Bearer [SECRET REMOVED]')
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[TOKEN REMOVED]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REMOVED]')
      .replace(/\b(?:\+?\d[\d ()-]{8,}\d)\b/g, '[NUMBER REMOVED]')
      .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1[CREDENTIALS REMOVED]@').slice(0, max);
  }
  const safeText = (s, max = 1000) => typeof s === 'string' && s.length <= max && !/[<>]|```|javascript:/i.test(s);
  root.BobPrivacy = { redact, safeText };
  if (typeof module !== 'undefined') module.exports = root.BobPrivacy;
})(typeof window !== 'undefined' ? window : globalThis);
