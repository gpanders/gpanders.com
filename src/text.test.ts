import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml, highlight, makeSnippet, normalizeQuery } from "./text.ts";

describe("escapeHtml", () => {
    it("escapes markup and quotes", () => {
        assert.equal(
            escapeHtml(`<script>alert("x" & 'y')</script>`),
            "&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
        );
    });
});

describe("normalizeQuery", () => {
    it("trims and collapses whitespace", () => {
        assert.equal(normalizeQuery("  neovim \n  lsp  "), "neovim lsp");
    });

    it("treats a missing query as empty", () => {
        assert.equal(normalizeQuery(null), "");
    });

    it("caps the length", () => {
        assert.equal(normalizeQuery("a".repeat(500)).length, 100);
    });
});

describe("makeSnippet", () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const content = words.join(" ");

    it("returns short content unchanged", () => {
        assert.equal(makeSnippet("  short   text ", ["text"]), "short text");
    });

    it("centers on the first matching term", () => {
        const snippet = makeSnippet(content, ["word120"]);
        assert.ok(snippet.includes("word120"), snippet);
        assert.ok(snippet.startsWith("…"), snippet);
        assert.ok(snippet.endsWith("…"), snippet);
    });

    it("does not cut words in half", () => {
        const snippet = makeSnippet(content, ["word120"]).replace(/…/gu, "");
        for (const word of snippet.split(" ")) {
            assert.match(word, /^word\d+$/u);
        }
    });

    it("falls back to the beginning when no term matches", () => {
        const snippet = makeSnippet(content, ["missing"]);
        assert.ok(snippet.startsWith("word0 "), snippet);
        assert.ok(snippet.endsWith("…"), snippet);
    });

    it("stays close to the requested length", () => {
        const snippet = makeSnippet(content, ["word120"], 80);
        assert.ok(snippet.length <= 82, `${snippet.length}: ${snippet}`);
    });

    it("matches case-insensitively", () => {
        const snippet = makeSnippet(`${"x ".repeat(200)}Ghostty is native ${"y ".repeat(200)}`, [
            "ghostty",
        ]);
        assert.ok(snippet.includes("Ghostty"), snippet);
    });
});

describe("highlight", () => {
    it("wraps matched terms in <mark>, case-insensitively", () => {
        assert.equal(
            highlight("Neovim and neovim", ["neovim"]),
            "<mark>Neovim</mark> and <mark>neovim</mark>",
        );
    });

    it("escapes text around and inside matches", () => {
        assert.equal(highlight("<b>a&b</b>", ["a&b"]), "&lt;b&gt;<mark>a&amp;b</mark>&lt;/b&gt;");
    });

    it("prefers the longest overlapping term", () => {
        assert.equal(highlight("terminals", ["term", "terminals"]), "<mark>terminals</mark>");
    });

    it("treats regex metacharacters in terms literally", () => {
        assert.equal(highlight("c++ and c", ["c++"]), "<mark>c++</mark> and c");
    });

    it("does not match inside longer words", () => {
        assert.equal(
            highlight("a companion article", ["a", "is"]),
            "<mark>a</mark> companion article",
        );
    });

    it("escapes everything when there are no terms", () => {
        assert.equal(highlight("<i>", []), "&lt;i&gt;");
    });
});
