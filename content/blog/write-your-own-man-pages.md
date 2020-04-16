---
title: Write Your Own Man Pages
date: 2019-07-29
tags: [shell]
---

This post was inspired by the tool [um](https://github.com/sinclairtarget/um).
I decided to try my hand at making my own lightweight implementation using just
a shell function. I decided to name my tool `ual` as a nod to the fact that it
complements `man`.

<!--more-->

I wanted to be able to write quick, simple notes in Markdown and be able to
view them in a man-page style format from anywhere on the command line.
Additionally, I wanted to be able to edit or create new notes with little to no
"friction".

[Pandoc](https://pandoc.org/) is able to convert Markdown files into Roff
format (the format used by man pages), and the `groff` tool can then convert
that into the actual formatted text that is displayed in the terminal. So
converting a Markdown file into a man page is as simple as

```console
$ pandoc --standalone --from markdown --to man my-note.md | groff -T utf8 -man | less -R
```

This is simple enough to turn into a shell function:

```bash
ual() {
   pandoc --standalone --from markdown --to man "$1".md | groff -T utf8 -man | less -R
}
```

To edit or create new notes, simply add an `edit` subcommand:

```bash
ual() {
    case $1 in
        edit)
            "${EDITOR:-vi}" $2.md
            ;;
        *)
            pandoc --standalone --from markdown --to man "$1".md | groff -T utf8 -man | less -R
            ;;
    esac
}
```

And of course, you probably want to keep all of those notes in a central
location.

```bash
NOTES="$HOME/.notes"
ual() {
    case $1 in
        edit)
            ${EDITOR:-vi} "$NOTES"/$2.md
            ;;
        *)
            pandoc --standalone --from markdown --to man "$NOTES"/"$1".md | groff -T utf8 -man | less -R 
            ;;
    esac
}
```

Now I can use `ual edit <note>` to modify or create a new note, and
`ual <note>` to view it.

I don't want to include metadata in the actual Markdown notes themselves so
that I can keep them as minimal (and portable) as possible. So instead I
generate the metadata in the `ual` function itself.

```bash
NOTES="$HOME/.notes"
ual () {
    case $1 in
        edit)
            ${EDITOR:-vi} "$NOTES"/$2.md
            ;;
        *)
            NOTE="$NOTES"/$1.md

            if [ ! -f "$NOTE" ]; then
                echo "No ual entry for $1" >&2
                return 1
            fi

            TITLE="$(echo $1 | tr '[:lower:]' '[:upper:]')"
            SECTION="ual"
            AUTHOR="Greg Anders"
            DATE="$(date +'%B %d, %Y' -r "$NOTE")"

            pandoc \
                --standalone \
                --from markdown \
                --to man \
                --metadata title="$TITLE" \
                --metadata author="$AUTHOR" \
                --metadata section="$SECTION" \
                --metadata date="$DATE" \
                "$NOTE" | groff -T utf8 -man | less -R
            ;;
    esac
}
```

As an example, if I have the following Markdown note at `~/.notes/foobar.md`:

```markdown
# NAME

foobar - a test note

# DESCRIPTION

foobar is a test.
```

I can use `ual foobar` to produce

```
FOOBAR(ual)                                                        FOOBAR(ual)



NAME
       foobar ‐ a test note

DESCRIPTION
       foobar is a test.

AUTHORS
       Greg Anders.



                                 July 28, 2019                     FOOBAR(ual)
```

You can download `ual` [here](https://github.com/gpanders/ual).
