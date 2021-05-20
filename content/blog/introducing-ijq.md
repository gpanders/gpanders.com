---
title: "Introducing ijq, an Interactive jq Tool"
date: 2020-05-23T19:07:09-06:00
---

If you're unfamiliar with the tool [jq][], it describes itself as the "sed for
JSON". It's a powerful command line tool that lets you do complex parsing and
manipulation of JSON documents and is extremely useful for testing APIs or
analysing JSON datasets.

One challenge with jq, however, is finding just the right filter. The query
language that jq uses is not always obvious, so typically you'll spend a bit
of time getting it just right to select the data you need.

[jq play][jqplay] solves this problem by providing an interactive jq
environment that allows you to see the filtered results of your query in real
time. [vim-jqplay][] is similar, but runs inside of Vim. I thought this was a
pretty neat idea, so I thought I'd take a stab at making something similar that
works not in Vim but directly on the command line. I call it `ijq`, or
"interactive jq".

Mostly this was just an excuse to get some more practice with Go (which is what
I used to write `ijq`). But I do think this will actually be quite useful. It
mostly works as a drop-in jq replacement, since you can use it to output the
resulting JSON object to another file or process.

Here's a quick video:

[![asciicast](https://asciinema.org/a/396956.svg)](https://asciinema.org/a/396956)

You can get `ijq` over on [sourcehut][].

[jq]: https://stedolan.github.io/jq/
[vim-jqplay]: https://github.com/bfrg/vim-jqplay
[jqplay]: https://jqplay.org
[sourcehut]: https://sr.ht/~gpanders/ijq/
