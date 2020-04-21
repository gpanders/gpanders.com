---
title: "Building Site Search With Hugo"
date: 2020-04-17T13:08:49-06:00
tags: ["hugo", "search", "howto"]
featured: true
---

Search is a handy feature you might want on your Hugo static site.
Hugo does not have any built-in way to provide a search function, but they do offer some [suggestions][] on how to do it yourself.

The difficulty with implementing a search function is that it usually requires some kind of server side logic, which is obviously missing when using a static site like Hugo.
So any search implementation must be done entirely on the client side.
One of the [options Hugo suggests][] offers an implementation using jQuery and Fuse.js.

This seemed a bit overkill to me.
I did not want to have to add two (rather large) JavaScript libraries to my site simply to provide a simple feature like search.
Further, even after trying Fuse.js I was utterly confounded by the search results it returned and found the documentation incomplete and confusing.
For example, while testing Fuse I searched my site for "fpga".
As of this writing, there are two posts on this site containing the word "fpga", so I would expect the search to return those two posts and those two posts only.
However, Fuse completely failed to find one of the posts and also returned several false positives!
This happens because Fuse uses a fuzzy search algorithm, so the search term "fpga" matches a lot of things besides the term itself, which is not what I wanted.

Fortunately, there is a better way.

Hugo can create a JSON index of your entire site, with keys of your choosing.
For example, you can create an `index.json` file with keys such as `title`, `tags`, `permalink`, `date`, and `contents`.
You can then use JavaScript to download this `index.json` file, parse it into a JavaScript object and then search through it (this is also how the Fuse implementation works).

To tell Hugo to create a `index.json` of your site, add the following to your `config.toml` file:

```toml
[outputs]
  home = ["html", "json"]
```

Also create the following file at `layouts/_default/index.json`:

```go
{{- $.Scratch.Add "index" slice -}}
{{- range where .Site.RegularPages "Section" "in" site.Params.mainSections  -}}
    {{- $.Scratch.Add "index" (dict "title" .Title "date" (dateFormat "2006-01-02" .Date) "tags" .Params.tags "contents" .Plain "permalink" .Permalink) -}}
{{- end -}}
{{- $.Scratch.Get "index" | jsonify -}}
```

When you use `hugo` to publish your site, you will find a file at `public/index.json` containing a JSON representation of your whole site.

Once the `index.json` file is created, we can download it with

```javascript
var httpRequest = new XMLHttpRequest();
httpRequest.onreadystatechange = function() {
    if (httpRequest.readyState === 4 && httpRequest.status === 200) {
        const index = JSON.parse(httpRequest.responseText);
        // Search `index` for your search query
    }
};

httpRequest.open("GET", "/index.json");
httpRequest.send();
```

Then it's just a matter of searching the index object for our query:

```javascript
// XMLHttpRequest boilerplate from above
// ...
const index = JSON.parse(httpRequest.responseText);
const keys = ["title", "permalink", "tags", "contents"];
const pattern = new RegExp(query);  // See below for how we get the query
const results = index.filter(item => {
    for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!item[key]) {
            continue;
        }

        if (key === "tags") {
            if (item[key].some(tag => pattern.test(tag.toLowerCase()))) {
                return true;
            }
        } else if (pattern.test(item[key].toLowerCase())) {
            return true;
        }
    }

    return false;
});
// ...
```

The items in `results` are your search results.
Now it's just a matter of adding those results to the DOM to present them to your user.

I added a form to the navigation banner on this site with a single input field that redirects users to `gpanders.com/search/` with a single query param `q`.
So a search URL looks like `gpanders.com/search/?q=query_phrase`.
To get the search query from the request URL, I simply use:

```javascript
const match = window.location.href.match(/\?q=([^&]+)/);
if (!match) {
    return;
}

const query = decodeURIComponent(match[1].replace(/\+/g, " "));
const pattern = new RegExp(query.toLowerCase().replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'));
```

We capture the query parameter from the URI and decode it.
We then force `query` to be lower case to make searches case-insensitive and also [escape characters that are semantically meaningful in regular expressions][regexp escape].
This ensures that the search query entered by the user is interpreted literally and not as a regular expression.
If you _want_ search queries to use regular expression syntax, then simply omit the `.replace()` call above.
`pattern` is then used in the `XMLHttpRequest` callback we wrote above.

Save this JavaScript file to `assets/js/search.js`.
It needs to be under the `assets` directory so that we can access it using Hugo's `resources` API.

To create the actual search page in Hugo, create the file `content/search/index.md` with the simple contents:

```markdown
---
layout: "search"
---
```

Then create the layout file for this page at `layouts/_default/search.html`.
For example,

```html
{{ with resources.Get "js/search.js" | fingerprint }}
<script async type="text/javascript" src="{{ .Permalink }}" integrity="{{ .Data.Integrity }}" crossorigin="anonymous"></script>
{{ end }}

<h2 class="search-header"></h2>
<ul id="search-results">
</ul>
```

The way your layout is structured will depend on the theme you are using.
You should use the single page layout files from your theme as a starting point and modify it from there.

Then, in your `search.js` file, fill in the DOM using your search results:
```javascript
// Generate `results` as in the code block above
// ...
var html = "";
for (var i = 0; i < results.length; i++) {
    html += '<li><a href="' + results[i].permalink + '">' + results[i].title + '</a></li>'
}

document.getElementById("search-results").innerHTML = html;
```

Et voila! You now have working search on your static Hugo site!

The post above is not meant to be a finely detailed, step-by-step guide, but rather a high-level overview of how I did my implementation.
There are a lot of gaps you'll have to fill in for yourself, but of course, that's the fun part!
Feel free to [contact me][] with any questions or feedback.
And of course you can always find my full implementation [here on this site][].

[suggestions]: https://gohugo.io/tools/search/
[options Hugo suggests]: https://gist.github.com/eddiewebb/735feb48f50f0ddd65ae5606a1cb41ae
[regexp escape]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
[contact me]: mailto:contact@gpanders.com
[here on this site]: https://gpanders.com/search
