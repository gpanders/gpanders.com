import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSearcher, type Document } from "./search.ts";

const docs: Document[] = [
    {
        href: "/blog/ghostty-is-native-so-what/",
        title: "Ghostty Is Native—So What?",
        date: "2024-12-20",
        tags: [],
        content:
            "Ghostty is a new terminal emulator. Its native platform integration is underrated.",
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
        const ranked = createSearcher([
            {
                href: "/blog/body-match/",
                title: "Alpha",
                date: "2024-01-01",
                tags: [],
                content: "zebra",
            },
            {
                href: "/blog/title-match/",
                title: "Zebra facts and more",
                date: "2024-01-02",
                tags: [],
                content: "nothing here",
            },
        ]);
        assert.deepEqual(
            ranked.search("zebra", 10).map((r) => r.href),
            ["/blog/title-match/", "/blog/body-match/"],
        );
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

    it("excerpts long content around the match", () => {
        const filler = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
        const [result] = createSearcher([
            {
                href: "/blog/long/",
                title: "Long",
                date: "2024-01-03",
                tags: [],
                content: `${filler} needle ${filler}`,
            },
        ]).search("needle", 10);
        assert.ok(result !== undefined);
        assert.ok(result.snippet.includes("needle"), result.snippet);
        assert.ok(result.snippet.startsWith("…"), result.snippet);
        assert.ok(result.snippet.endsWith("…"), result.snippet);
        assert.ok(result.snippet.length <= 162, `${result.snippet.length}`);
    });
});
