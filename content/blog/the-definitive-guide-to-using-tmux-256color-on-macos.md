---
title: The definitive guide to using tmux-256color on macOS
date: 2021-04-14
tags: [tmux, macos, terminal]
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

```bash
# MacPorts
$ /opt/local/bin/infocmp -x tmux-256color > ~/tmux-256color.src

# Homebrew
$ /usr/local/opt/ncurses/bin/infocmp -x tmux-256color > ~/tmux-256color.src
```

Now, modify the `tmux-256color.src` file to change the `pairs` value from
65536 to 32768. This must be done because of a bug in ncurses 5.7 that
interprets `pairs#65536` as `pairs#0`[^1].

Before:

    pairs#0x10000

or

    pairs#65536

After:

    pairs#0x1000

or

    pairs#32768

If you are on a macOS version prior to Catalina, you can install this new
terminfo entry into the system database `/usr/share/terminfo`. This will ensure
that programs linked against the old version of ncurses will use this entry,
while programs installed by your package manager will continue to use the entry
from the newer version of ncurses. To do this, simply run

```bash
$ sudo /usr/bin/tic -x tmux-256color.src
```

Be sure to use `/usr/bin/tic` and not just `tic`: this will use the system
version of ncurses to compile the database entry, which is required for system
programs linked against that version of ncurses work properly.

Unfortunately, if you are on Catalina or later this will not work since the
root volume (of which `/usr/share/terminfo` is a part) is read-only. There are,
apparently, workarounds to make the root volume writable, so if you want to go
that route you can. Otherwise, simply run the command above without `sudo`:

```bash
$ /usr/bin/tic -x tmux-256color.src
```

This will install the terminfo database entry under `$HOME/.terminfo`. This
will still work; however, now *all* programs on your machine will use this
terminfo database entry, even if they were linked against the fully functional
6.X version of ncurses provided by your package manager. This is an unfortunate
tradeoff, but as of this writing I don't know any way around it.

After that, you should be able to correctly use `tmux-256color` as your TERM
variable. You can check that everything is working by running a few programs
that make use of `ncurses` and terminal colors, such as `htop`, `man`, `ls -G`,
etc.

[^1]: See Thomas Dickey's comment
  [here](https://github.com/tmux/tmux/issues/2262#issuecomment-719985206).
