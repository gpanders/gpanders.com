import MiniSearch from "minisearch";
import { makeSnippet } from "./text.ts";

/** One record of search-index.json, as emitted by layouts/home.searchindex.json. */
export interface SearchDoc {
    href: string;
    title: string;
    date: string;
    tags: string[];
    content: string;
}

export interface SearchResult {
    href: string;
    title: string;
    date: string;
    snippet: string;
    /** Document terms that matched the query, for highlighting. */
    terms: string[];
}

export interface Searcher {
    search(query: string, limit: number): SearchResult[];
}

export function createSearcher(docs: readonly SearchDoc[]): Searcher {
    const byHref = new Map(docs.map((doc) => [doc.href, doc]));

    const index = new MiniSearch<SearchDoc>({
        idField: "href",
        fields: ["title", "tags", "content"],
        extractField: (doc: SearchDoc, field: string): string => {
            switch (field) {
                case "href":
                    return doc.href;
                case "title":
                    return doc.title;
                case "tags":
                    return doc.tags.join(" ");
                case "content":
                    return doc.content;
                default:
                    return "";
            }
        },
        searchOptions: {
            boost: { title: 3, tags: 2 },
            combineWith: "AND",
            // Prefix-match only the last term, so results update as you type.
            prefix: (_term: string, i: number, terms: string[]): boolean => i === terms.length - 1,
            // Tolerate small typos, but not on short terms where they'd match everything.
            fuzzy: (term: string): number | boolean => (term.length > 4 ? 0.2 : false),
        },
    });
    index.addAll(docs);

    return {
        search(query: string, limit: number): SearchResult[] {
            if (query === "") {
                return [];
            }
            const results: SearchResult[] = [];
            for (const hit of index.search(query)) {
                if (results.length >= limit) {
                    break;
                }
                const doc = typeof hit.id === "string" ? byHref.get(hit.id) : undefined;
                if (doc === undefined) {
                    continue;
                }
                results.push({
                    href: doc.href,
                    title: doc.title,
                    date: doc.date,
                    snippet: makeSnippet(doc.content, hit.terms),
                    terms: hit.terms,
                });
            }
            return results;
        },
    };
}
