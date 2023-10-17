---
title: The definitive guide to using tmux-256color on macOS
date: 2021-04-14
tags: [tmux, macos, terminal]
---

**UPDATE**: macOS 14 (Sonoma) updated its bundled ncurses version to
6.0. This version ships with a `tmux-256color` entry by default, so
the workaround below is no longer needed.

---

macOS ships with an old and very out-of-date version of ncurses (5.7). This
version does not contain a terminfo entry for `tmux-256color`, the preferred
`TERM` value when using `tmux`.

If you installed `tmux` via Homebrew or MacPorts, then you will also have a
newer version of ncurses (6.X) present on your system installed by your package
manager. This is the version of ncurses that `tmux` itself was built against,
which is why you can use

```tmux
set -s default-terminal tmux-256color
```

in your `.tmux.conf` without any errors. However, as soon as you try to use any
application linked against macOS's version of ncurses (such as `man` or `ls
-G`), you will notice that things no longer work.

The solution is to get the `tmux-256color` terminfo entry from the newer
version of ncurses into macOS's terminfo database. First, create a copy of the
current `tmux-256color` terminfo entry from the version of curses installed by
your package manager:

```console
# MacPorts
$ /opt/local/bin/infocmp -x tmux-256color > ~/tmux-256color.src

# Homebrew
$ /usr/local/opt/ncurses/bin/infocmp -x tmux-256color > ~/tmux-256color.src
```

Now, modify the `tmux-256color.src` file to change the `pairs` value from
65536 to 32767. This must be done because of a bug in ncurses 5.7 that
interprets `pairs#65536` as `pairs#0`[^1].

Before:

    pairs#0x10000

or

    pairs#65536

After:

    pairs#32767

Prior to macOS Catalina, it was possible to install this new terminfo entry
directly into the system database `/usr/share/terminfo`. However, as of
Catalina we can no longer do this since the root volume (of which
`/usr/share/terminfo` is a part) is read-only. There are, apparently,
workarounds to make the root volume writable, so if you want to go that route
you can. Instead, we can install the terminfo entry to a local database under
`$HOME`:

```console
$ /usr/bin/tic -x -o $HOME/.local/share/terminfo tmux-256color.src
```

Be sure to explicitly use `/usr/bin/tic` to ensure that the entry is compiled
with the builtin ncurses. This will install the terminfo database entry under
`$HOME/.local/share/terminfo`. ncurses uses the `TERMINFO_DIRS` environment
variable to specify a location to search for terminfo entries when not found in
the primary database (see `man 5 terminfo`). We can take advantage of this to
have the macOS 5.7 version of ncurses search in a directory of our choice when
it doesn't find `tmux-256color` under `/usr/share/terminfo`, while the 6.X
version provided by the package manager will still use its own version[^2].

Simply set the `TERMINFO_DIRS` environment variable in your shell startup file
(e.g. `.bashrc`, `.zshrc`, etc.) to use that directory (note that we append
this value to the existing value, if any, similar to how we append values to
`$PATH`):

```console
$ export TERMINFO_DIRS=$TERMINFO_DIRS:$HOME/.local/share/terminfo
```

After that, you should be able to correctly use `tmux-256color` as your TERM
variable. You can check that everything is working by running a few programs
that make use of `ncurses` and terminal colors, such as `htop`, `man`, `ls -G`,
etc.

[^1]: See Thomas Dickey's comment
  [here](https://github.com/tmux/tmux/issues/2262#issuecomment-719985206).

[^2]: An earlier version of this article installed the terminfo entry into
`$HOME/.terminfo`, which is a suboptimal solution as even the updated 6.X
version of ncurses would use the terminfo entry with reduced colors. The use of
`TERMINFO_DIRS` was suggested to me by Carlo Cabrera, and provides the best of
both worlds. Thanks Carlo for the tip!
