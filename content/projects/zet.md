---
title: zet
summary: Command line tool to manage your Zettelkästen
src: https://git.sr.ht/~gpanders/zet
---

zet is a command line tool to manage a [Zettelkästen][], written in [zig][].

[Zettelkästen]: https://zettelkasten.de/posts/overview/
[zig]: https://ziglang.org

Installation
------------

After cloning this repository, you can install `zet` under `$PREFIX/bin` by
running the following from the project root:

    zig build --prefix $PREFIX install

Usage
-----

Notes are stored in the directory represented by the environment variable
`$ZETTEL_DIR`. If `$ZETTEL_DIR` is unset, it defaults to
`$HOME/.local/share/zet/`.

List all notes in your Zettelkasten:

    zet list

Create a new note:

    zet new 'TITLE'

The file name of the note will be the given title prepended with a unique ID
and a `.txt` suffix. The title can contain spaces, but be sure to wrap it in
quotes so your shell doesn't split it.

Open a note in your `$EDITOR` (defaults to `vi` if `$EDITOR` is unset):

    zet open NOTE

Where `NOTE` is the name of an existing note **without** the `.txt` extension.

Display a note's contents to stdout:

    zet show NOTE

Search through note contents and file names and report matches:

    zet search PATTERN
