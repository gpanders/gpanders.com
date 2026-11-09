// Pure text helpers for search results. No Workers or MiniSearch imports so these can be unit
// tested with `node --test`.

const HTML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

export function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a case-insensitive regex matching any of `terms` as whole words, longest first. */
function termsPattern(terms: readonly string[]): RegExp | undefined {
    const unique = [...new Set(terms.map((t) => t.toLowerCase()).filter((t) => t.length > 0))];
    if (unique.length === 0) {
        return undefined;
    }
    unique.sort((a, b) => b.length - a.length);
    const alternation = unique.map(escapeRegExp).join("|");
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, "giu");
}

/** Normalize a user-supplied query: collapse whitespace and cap its length. */
export function normalizeQuery(q: string | null, maxLength = 100): string {
    return (q ?? "").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

/**
 * Return a plain-text excerpt of `content` of roughly `length` characters, centered near the first
 * occurrence of any of `terms`. Falls back to the start of the content when no term occurs.
 */
export function makeSnippet(content: string, terms: readonly string[], length = 160): string {
    const text = content.replace(/\s+/gu, " ").trim();
    if (text.length <= length) {
        return text;
    }

    const pattern = termsPattern(terms);
    const match = pattern?.exec(text);
    const hit = match?.index ?? 0;

    // Put the match about a third of the way into the excerpt.
    let start = Math.max(0, hit - Math.floor(length / 3));
    let end = Math.min(text.length, start + length);
    start = Math.max(0, end - length);

    // Snap to word boundaries so the excerpt doesn't begin or end mid-word.
    if (start > 0) {
        const space = text.indexOf(" ", start);
        if (space !== -1 && space < hit) {
            start = space + 1;
        }
    }
    if (end < text.length) {
        const space = text.lastIndexOf(" ", end);
        if (space > start && space > hit) {
            end = space;
        }
    }

    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    return `${prefix}${text.slice(start, end)}${suffix}`;
}

/** Escape `text` for HTML and wrap occurrences of `terms` in <mark>. */
export function highlight(text: string, terms: readonly string[]): string {
    const pattern = termsPattern(terms);
    if (pattern === undefined) {
        return escapeHtml(text);
    }

    let out = "";
    let last = 0;
    for (const m of text.matchAll(pattern)) {
        out += escapeHtml(text.slice(last, m.index));
        out += `<mark>${escapeHtml(m[0])}</mark>`;
        last = m.index + m[0].length;
    }
    return out + escapeHtml(text.slice(last));
}
