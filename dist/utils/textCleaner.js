"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanText = cleanText;
/**
 * Utilities for cleaning and normalizing extracted PDF text.
 */
function cleanText(rawText) {
    if (!rawText)
        return '';
    return (rawText
        // Replace carriage returns with standard newlines
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remove null and non-printable control characters (except newline, tab)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        // Fix hyphenated line breaks (e.g., "re- \n fund" -> "refund")
        .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
        // Collapse more than 2 consecutive newlines into 2
        .replace(/\n{3,}/g, '\n\n')
        // Replace multiple horizontal spaces/tabs with a single space
        .replace(/[ \t]{2,}/g, ' ')
        .trim());
}
