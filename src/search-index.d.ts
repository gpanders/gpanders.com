// Type for the JSON index Hugo writes to public/search-index.json. Declared here so type checking
// doesn't depend on a Hugo build having run first. Wrangler bundles the real file at deploy time.
declare module "*/search-index.json" {
    const docs: import("./search.ts").SearchDoc[];
    export default docs;
}
