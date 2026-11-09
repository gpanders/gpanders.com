import MiniSearch, { type Options } from "minisearch";
import { makeSnippet } from "./text.ts";

export interface Document {
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
    terms: string[];
}

const OPTIONS: Options<Document> = {
    idField: "href",
    fields: ["title", "tags", "content"],
    searchOptions: {
        boost: { title: 3, tags: 2 },
        combineWith: "AND",
        // Prefix-match only the last term, so results update as you type.
        prefix: (_term, i, terms) => i === terms.length - 1,
        // Tolerate small typos, but not on short terms where they'd match everything.
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
    },
};

export function createSearcher(docs: readonly Document[]) {
    const index = new MiniSearch<Document>(OPTIONS);
    index.addAll(docs);
    const byHref = new Map(docs.map((doc) => [doc.href, doc]));

    return {
        search(query: string, limit: number): SearchResult[] {
            const results: SearchResult[] = [];
            if (query === "") {
                return results;
            }
            for (const hit of index.search(query)) {
                if (results.length >= limit) {
                    break;
                }
                const doc = byHref.get(String(hit.id));
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
