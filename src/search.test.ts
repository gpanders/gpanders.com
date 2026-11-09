import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSearcher, type SearchDoc } from "./search.ts";

const docs: SearchDoc[] = [
    {
        href: "/blog/ghostty-is-native-so-what/",
        title: "Ghostty Is Native—So What?",
        date: "2024-12-20",
        tags: [],
        content: "Ghostty is a new terminal emulator. Its native platform integration is underrated.",
    },
    {
        href: "/blog/state-of-the-terminal/",
        title: "State of the Terminal",
        date: "2023-12-08",
        tags: ["terminal"],
        content: "Terminal emulators support many text styles, such as underline and bold.",
    },
    {
        href: "/blog/whats-new-in-neovim-0-11/",
        title: "What's New in Neovim 0.11",
        date: "2025-03-26",
        tags: ["neovim"],
        content: "Neovim 0.11 adds a simpler way to configure LSP servers with vim.lsp.config.",
    },
];

const searcher = createSearcher(docs);
const hrefs = (query: string, limit = 10): string[] =>
    searcher.search(query, limit).map((r) => r.href);

describe("createSearcher", () => {
    it("returns nothing for an empty query", () => {
        assert.deepEqual(searcher.search("", 10), []);
    });

    it("finds documents by body text", () => {
        assert.deepEqual(hrefs("underline"), ["/blog/state-of-the-terminal/"]);
    });

    it("ranks title matches above body-only matches", () => {
        assert.equal(hrefs("terminal")[0], "/blog/state-of-the-terminal/");
    });

    it("requires every term to match", () => {
        assert.deepEqual(hrefs("neovim terminal"), []);
    });

    it("prefix-matches the last term as you type", () => {
        assert.deepEqual(hrefs("ghost"), ["/blog/ghostty-is-native-so-what/"]);
    });

    it("tolerates small typos in longer terms", () => {
        assert.deepEqual(hrefs("ghosty"), ["/blog/ghostty-is-native-so-what/"]);
    });

    it("respects the limit", () => {
        assert.equal(hrefs("terminal", 1).length, 1);
    });

    it("includes a snippet and the matched terms", () => {
        const [result] = searcher.search("lsp", 10);
        assert.ok(result !== undefined);
        assert.ok(result.snippet.includes("LSP"), result.snippet);
        assert.ok(result.terms.includes("lsp"), result.terms.join(","));
    });
});
