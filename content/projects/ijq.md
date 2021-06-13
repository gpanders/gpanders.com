---
title: ijq
summary: Interactive jq
href: https://sr.ht/~gpanders/ijq/
featured: true
---

`ijq` is a command-line utility that provides an interactive interface to `jq`,
the JSON processing tool. It provides a two pane TUI and an input field: as you
write your `jq` query into the input field the JSON is processed in real time
and lets you preview the result of your query interactively. `ijq` works in
pipelines allowing it to be a near drop-in replacement for `jq`: when you close
`ijq` the filtered JSON is written to `stdout` which allows you to consume it
later in the pipeline.

Check out [a demo][asciicast]!

[asciicast]: https://asciinema.org/a/396956
