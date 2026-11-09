---
title: "State of the Terminal"
date: 2024-03-12
---

_This is a companion article to [my talk][talk] at Neovimconf 2023_.

[talk]: https://www.youtube.com/watch?v=N7QX9XlLljM

* * *

I have been using Vim/Neovim as my full time text editor for close to 10 years.
I've spent a lot of time in the terminal and have become very aware of the
many flaws and idiosyncrasies of this bizarre platform. But I also think it
gets a lot of things right! And I'm not alone in this belief: terminal based
tools are still widely popular even in the presence of many alternatives
(the StackOverflow developer survey shows that Neovim is the "most loved"
editor [3][so1] [years][so2] [in][so3] a row).

[so1]: https://survey.stackoverflow.co/2021/#section-most-loved-dreaded-and-wanted-collaboration-tools
[so2]: https://survey.stackoverflow.co/2022/#section-most-loved-dreaded-and-wanted-integrated-development-environment
[so3]: https://survey.stackoverflow.co/2023/#section-admired-and-desired-integrated-development-environment

It's only been in the last couple of years that I've begun to dig deep into
the inner workings of how terminal emulators, and the applications that run
inside of them, really work. I've learned that there is a lot of innovation
and creative problem solving happening in this space, even though the
underlying technology is over half a century old[^1].

I've also found that many people who use terminal based tools (including
shells like Bash and editors like Vim) know very little about terminals
themselves, or some of the modern features and capabilities they can support.

In this article, we'll discuss some of the problems that terminal based
applications have historically had to deal with (and what the modern solutions
are) as well as some features that modern terminal emulators support that you
may not be aware of.

But first, some (very) brief history.

## Background & History

Most terminal emulators today can directly trace their roots back to the DEC
VT100. The VT100 was not the first video terminal, nor was it the last, but it
was the most popular (at the time). And as we've learned from history many
times since, what becomes popular creates the _de facto_ standard for
everything that comes after.

![DEC VT100](/media/DEC_VT100_terminal.jpg "DEC VT100 ([Jason Scott, CC BY 2.0 via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:DEC_VT100_terminal.jpg))")

Video terminals were an improvement on the teletype machines that preceded
them. They could move the cursor around the screen to create interactive
interfaces. They could use color, and clear and redraw their displays quickly
without feeding out reams of paper.

Different video terminals had their own unique way of doing things using
unique, proprietary escape codes (a sequence of bytes beginning with the
escape `0x1b` character). This made life difficult for applications because
they had to know which of these sequences to use. Libraries and helper
programs (e.g. `termcap`) were created to help ameliorate these issues (we
still live with the descendant of these early libraries,
`terminfo`).

Eventually, formal standards were created, such as ECMA-48 and ANSI X3.64
(from which the term "[ANSI escape codes][ansi]" derives), which defined a set
of standard escape sequences. The DEC VT100 was the first video terminal to
support these new standards. Its popularity, combined with the new standards,
meant that programs now had a set of known good escape
sequences they could reliably use. Its popularity spawned many clones, which
in turn supported the same sequences for compatibility with applications.

Graphical window systems eventually replaced hardware video terminals, but
users still wanted to use the terminal based programs they were accustomed to
(you know how those `vi` people are). In 1984, work began on a software
terminal emulator at MIT. This emulator became part of the X project and was
named [Xterm][xterm]. Xterm implemented its own features which did not exist
on the video terminals it emulated, such as mouse tracking and a configurable
color palette. These features were in turn copied by Xterm clones, until
eventually Xterm itself became the new _de facto_ standard.

[ansi]: https://en.wikipedia.org/wiki/ANSI_escape_code
[xterm]: https://en.wikipedia.org/wiki/Xterm

## Terminal Emulator Basics

Terminal based applications write two kinds of data to the terminal emulator:
printable text that is displayed to the user, and control codes, which modify
the terminal emulator's state. Control codes are either single bytes in the C0
character set (bytes `0x00` through `0x1f`) or sequences of bytes that begin
with the escape character (`0x1b`). These sequences are most commonly referred
to as "escape sequences", and it is these sequences that do the bulk of the
heavy lifting in terminal applications.

Most control codes from the C0 character set are not used today, but
regardless of experience with terminals or terminal applications, most
developers are likely familiar with control codes such as `\r` (carriage
return), which moves the cursor to the beginning of the current line, and `\n`
(line feed), which moves the cursor to the next line.

Escape sequences are varied and numerous, but the vast majority used in
practice fall into one of three categories: Control Sequence Introducer (CSI),
Device Control String (DCS), and Operating System Command (OSC).

CSI sequences are those which begin with the prefix `ESC [` (`0x1b 0x5b`).
Escape sequences in this category are those which reposition the cursor,
change the cursor style, clear the screen, set foreground and background
colors, and more.

OSC sequences are those which begin with the prefix `ESC ]` and are typically
used for things that modify or interact with the user's environment outside of
the terminal emulator itself (hence the name "Operating System Command").
Examples are reading from or writing to the system clipboard, changing the
title of the terminal emulator's window, or sending desktop notifications.

Xterm maintains a list of all of the control sequences it supports on its
[website][ctlseqs], which, along with [vt100.net](https://vt100.net), forms an
informal pseudo-specification for VT100 emulators. Note that this list may not
contain some control sequences used by other, modern terminal emulators for
features which Xterm does not support (e.g. the Kitty keyboard protocol, which
we'll discuss later).

[ctlseqs]: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html

Escape sequences are actually quite easy to use, and you can even do it
straight from your shell. Try running the following command from any shell:

```bash
printf '\e[1;32mHello \e[0;4;31mworld!\n\e[0m'
```

This command will print the text "Hello world!", with "Hello" in
<span style="color:green;font-weight:bold;">green, bold</span>
text and "world!" in
<span style="color:red;text-decoration:underline;">red, underlined</span>
text.

The escape sequences used here are of the form `CSI <parameters> m`, which is
so common it has its own name: Select Graphic Rendition (SGR). The SGR escape
sequence sets foreground and background colors for all printed text. The first
escape sequence in the example `\e[1;32m` enables the **bold** attribute (`1`)
and sets the foreground color to
<span style="color:green;">green</span>
(`32`). The second escape sequence `\e[0;4;31m` first clears any existing
styles (`0`), then enables the
<span style="text-decoration:underline;">underline</span>
attribute (`4`), and finally sets the foreground text color to
<span style="color:red;">red</span>
(`31`). Finally, the last escape sequence `\e[0m` resets all styles back to
their defaults.

Another use case for simple CSI sequences is redrawing text on the screen on
an already existing line (e.g. for a progress bar or text that updates itself
over time). Hint: look at `\r`, `CSI A`, and `CSI K`.

Most escape sequences are sent from the application to the terminal emulator,
but occasionally the terminal emulator sends escape sequences to the
application. Usually this is done in response to a query from the application
(for instance, to determine if a certain mode is set).

## Problems & Solutions

Terminal emulators are descended from old, legacy technologies, which brings
with it its fair share of problems. Many of these problems have been (mostly)
solved, or at least ameliorated, while others are still active areas of
innovation and research.

### Key Encoding

Terminal emulators and terminal applications communicate through a stream of
bytes. When a user presses a key the terminal sends the byte representation of
the character associated with that key. The old video terminals only supported
ASCII so this was, generally, fairly straightforward.

Modifier keys like `Ctrl` and `Alt` complicate this situation. `Alt` modified
keys are encoded by prefixing the character with an `Esc`. But this has a
problem: including an extra `Esc` byte for the `Alt` modifier introduces
ambiguity between `Alt` modified key presses and two separate key presses.
When an application sees `Esc C`, should it interpret it as `Alt-C` or did the
user press `Esc` and then press `C`? Applications usually solve this by
measuring the amount of time between `Esc` and the next character. If the time
is less than some defined interval, it is considered an `Alt` modified key
press (Vim uses the `ttimeoutlen` option, tmux uses the `escape-time` option).

`Ctrl` modified keys are an even bigger problem. When `Ctrl` is used as a
modifier, the shifted[^2] version of the key has the 7th bit masked off (for
example, `C` is `0x43` and after masking the 7th bit the byte becomes `0x03`).
This means that not only can the `Shift` modifier not be used in conjunction
with `Ctrl`, but that certain `Ctrl` modified keys are completely
indistinguishable from other control codes.

For instance, when you press the `Return` key the terminal emulator sends the
byte `\r` (`0x0d`) to the application. But if you press `Ctrl-M` then the
terminal emulator also sends the byte `0x0d` to the application (`M` is `0x4d`
in ASCII, so when the 7th bit is masked out, it becomes `0x0d`). From the
application's perspective, there is literally no way to distinguish these two
events.

For a long time this meant that certain modified keys like `Ctrl-I`, `Ctrl-J`,
and `Ctrl-M` could not be used in terminal applications like Vim. There have
been a few attempts to solve this problem: the first came from Xterm in 2006
through the [modifyOtherKeys][] option. Paul Evans (author of `libvterm` and
`libtickit`) introduced an alternate key encoding using the `CSI u` escape
sequence in an [essay][fixterms] which is sometimes colloquially referred to
as "fixterms". The `CSI u` encoding proposed by Evans was extended by Kovid
Goyal, the author of the kitty terminal emulator, in what has become known as
the [kitty keyboard protocol][kkp].

What all of these solutions have in common is that key presses are sent to the
terminal application encoded as escape sequences. This eliminates any
ambiguity for modified keys and enables certain modifier combinations (such as
`Ctrl + Shift`) that are not possible using "legacy" encoding. The `CSI u`
encoding proposed by Evans and adapted by kitty encodes a modified key press
like `Ctrl-M` as `\e[109;5u`. The encoding of unmodified key presses like
`Return` depend on which "level" of the kitty keyboard protocol is enabled.
Applications can opt-in to different levels to ease adoption (for instance,
Neovim uses only the first level, "Disambiguate escape keys"). See the [kitty
documentation][kkp] for more details.

Sending key presses as escape sequences requires that terminal applications
are able to recognize and parse those sequences, so it is not something that
"just works" out of the box. However, the kitty keyboard protocol has been
widely adopted by both modern terminal emulators and terminal applications.
Terminals which support the kitty keyboard protocol (to some degree) include
Wezterm, Alacritty, kitty, foot, Ghostty, and iTerm2. Applications which
support the kitty keyboard protocol (to some degree) include Vim, Neovim,
Helix, kakoune, and nushell. This means that when using one of these
applications in one of these terminals, all of the key encoding problems
discussed above (as well as some others which were _not_ discussed...) are
solved.

[modifyOtherKeys]: https://invisible-island.net/xterm/modified-keys.html
[fixterms]: http://www.leonerd.org.uk/hacks/fixterms/
[kkp]: https://sw.kovidgoyal.net/kitty/keyboard-protocol/

### Decorations

Xterm has supported 256 user specified colors since [1999][xterm-111]. These
colors could be changed at runtime using an escape sequence (OSC 4), which can
be used to great effect (see ["8 Bit & '8 Bitish' Graphics-Outside the
Box"][8bit] by Mark Ferrari for an incredible demonstration, or install
[notcurses][] and run `notcurses-demo j` in your terminal).

[xterm-111]: https://invisible-island.net/xterm/xterm.log.html#xterm_111
[8bit]: https://www.youtube.com/watch?v=aMcJ1Jvtef0
[notcurses]: https://github.com/dankamongmen/notcurses

Within the last decade or so, 24 bit color (sometimes referred to as
"truecolor" or "RGB color") has become widely supported by terminal emulators
which allows terminal applications to use whatever arbitrary colors they want.
This provides terminal UIs a much greater degree of flexibility and creative
freedom.

Modern terminals also support other kinds of "rich" text markup, such as
strikethrough and various types of underlines. For instance, text editors like
Vim and Neovim can add a
<span style="text-decoration:underline;text-decoration-style:wavy;text-decoration-color:red;text-decoration-skip-ink:none;">red squiggly line</span>
under misspelled words (as seen in many graphical rich text editors).

![A screenshot of a terminal emulator displaying different text markup styles](/media/terminal_styles.png "Examples of markup styles supported by modern terminal emulators")

It is also possible to display images and even videos inline inside of
terminal emulators. There are (at least) three different ways to do this
([sixels][], the [iTerm2 image protocol][iterm images], and the [kitty
graphics protocol][kitty graphics]) and support among terminal emulators
varies. Unfortunately this means that terminal applications are in a bit of an
awkward situation, as they must either implement support for all of the image
protocols, or only support a subset of terminals. For this reason, use of
images in terminal applications is still relatively uncommon.

[sixels]: https://github.com/saitoha/libsixel
[iterm images]: https://iterm2.com/documentation-images.html
[kitty graphics]: https://sw.kovidgoyal.net/kitty/graphics-protocol/

It is important to note that advances in terminal based UIs are not only due
to the efforts of terminal emulators, but also to the creativity and talent of
terminal application and library authors. For example, see some of the
fantastic work that [charm.sh](https://charm.sh) has done creating delightful,
interactive terminal based user interfaces that rival (and in some cases,
surpass!) graphical UIs for similar tools.

### Capability Determination

Terminal emulators do not all support the same features. In some cases, the
same feature is implemented in different ways. Terminal applications need some
way to know which features the terminal they're running in support and how to
properly use those features.

Today this is primarily done using a distributed database of "terminfo" files.
The terminal emulator uses the `$TERM` environment variable to communicate to
terminal applications which terminfo file to use to lookup which capabilities
the terminal supports.

This has a multitude of problems, however. The terminfo database is part of
the ncurses library, and different operating systems and distributions package
different versions of ncurses. This was a problem for [tmux users on
macOS][tmux] for many years because the version of ncurses packaged with macOS
was so old that it did not even include the `tmux-256color` terminfo entry at
all!

[tmux]: /blog/the-definitive-guide-to-using-tmux-256color-on-macos/

This is also a problem for newer terminals which have not yet been added to
the ncurses terminfo database. Terminal emulators can (and often do) ship
their own terminfo entries which are used by applications running on the same
system as the terminal emulator itself. But when connecting to a remote system
(e.g. with SSH), the terminfo database on the remote system will not have the
terminfo entry and the user is met with cryptic warnings like `WARNING:
terminal is not fully functional` and applications not functioning properly.

To circumvent this issue, many terminals use `xterm-256color` as their `$TERM`
value, essentially claiming to be Xterm even though they are not, piggybacking
on Xterm's ubiquity. This creates a vicious cycle, as terminal applications
often hardcode special cases for `xterm-256color`, which incentivizes
terminals to claim to be `xterm-256color`, which incentivizes applications to
special case `xterm-256color`, which... and so on. The problem is
exacerbated by common (bad) advice to users facing problems with terminal
applications to simply override `$TERM` to be `xterm-256color` (the
[Xterm FAQ][xterm_generic-id] itself warns against this).

[xterm_generic-id]: https://invisible-island.net/ncurses/ncurses.faq.html#xterm_generic-id

Unfortunately there are no easy fixes for these problems, but there is hope.
The vast majority of escape sequences used by applications today are common
across most (if not all) modern terminal emulators. This makes terminfo less
necessary since applications can _usually_ safely assume that a given escape
sequence will "just work".

In addition, terminal emulators increasingly support applications querying
support for certain capabilities. For instance, applications can query the
terminal for support of the kitty keyboard protocol mentioned above and only
enable it if the terminal responds that it is supported. A nice property of
escape sequence queries is they still work even over remote login connections
like SSH.

Some new TUI libraries, such as [vaxis][], are designed specifically to avoid
using terminfo at all and exclusively use queries to determine feature
capabilities. As more applications, libraries, and terminal emulators move in
this direction, terminfo will become increasingly unnecessary.

[vaxis]: https://git.sr.ht/~rockorager/vaxis

### System Integration

One of the many advantages of software terminal emulators over hardware video
terminals is that they are one piece of a larger, integrated computing system.
Modern terminal emulators support many escape sequences to interact with their
broader environment. These sequences are generally known as Operating System
Commands (OSCs) and are often referred to by the numeric integer which appears
after the OSC prefix.

Some of the more popular OSC sequences are OSC 2 for setting the title of the
terminal emulator's window (used frequently by shells and text editors), OSC 8
for creating clickable [hyperlinks][], OSC 9 for sending desktop
notifications, and OSC 52 for interacting with the system clipboard.

[hyperlinks]: https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda

You can test these sequences out for yourself. Try running the following in
your shell:

```bash
printf '\e]9;This is a notification!\a'
```

If your terminal emulator supports OSC 9, you will see a desktop notification
appear with the text, "This is a notification!" (some terminals or operating
systems may not display a notificaton for the focused application. In that
case, add a `sleep 2` before the `printf` command and quickly change focus to
another window).

Terminals which support OSC 8 can create clickable hyperlinks. For instance,
try running the below command:

```bash
printf '\e]8;;https://www.youtube.com/watch?v=dQw4w9WgXcQ\aClick me for an awesome video!\n\e]8;;\a'
```

You will see the text "Click me for an awesome video!". If your terminal
emulator supports OSC 8, the text will be clickable (perhaps requiring a
modifier key like `Shift` or `Command` to be held) and might be styled with an
underline or some other visual affordance to indicate that the text is a
hyperlink. Clicking on the text will open your web browser to the (perfectly
innocuous) embedded URL.

A long standing issue for terminal based text editors like Vim is clipboard
management in remote sessons. A strength of Vim is that it can be run just as
easily in a remote SSH session as it can locally; however, the remote SSH
session is not able to communicate with the clipboard on your local system, so
it is not possible to copy text inside of Vim on the remote session to your
clipboard.

Vim addresses this by (optionally) linking against X11 and allowing users to
forward their X connection to the remote server, allowing Vim on the remote
server to copy text to the X clipboard on the local system. And while this
does _work_, it has its own problems (users must use a version of Vim compiled
against X11, with the optional `+clipboard` feature enabled, and use X11 as
their display server, and remember to forward the X connection to the remote
system).

A better solution is to copy data to the clipboard through the terminal
emulator directly. An application running in the terminal can use the OSC 52
escape sequence to write a Base64 encoded string to the terminal emulator. The
terminal then decodes the string and copies the data into the system
clipboard. The terminal emulator does not know or care whether the application
that sent the sequence is running remotely or not, which means this works on
_any_ system with zero dependencies.

Pasting (reading) from the clipboard has serious security implications,
because any program in the terminal (even ones on remote servers) can request
the clipboard contents of the user's system. For this reason, most terminal
emulators disable reading from the clipboard by default, or require the user
to explicitly allow it with a prompt.

Neovim recently added builtin support for using OSC 52 and it will be enabled
for users by default (if the terminal emulator supports it) in the forthcoming
0.10 release.

## Conclusion

While it's true that terminals, as an application platform, are idiosyncratic
and quirky, their portability, ubiquity, and relative ease of use (for
application authors) makes them increasingly popular for many developers, even
in the face of an increasing number of alternatives.

This article is not exhaustive, but it is not meant to be. There are other
challenges that both terminal emulator and terminal application authors face
that are not discussed here, as well as other areas of innovation and creative
exploration. Some examples: [better grapheme clustering][graphemes],
[synchronized output][sync] to avoid "flickering" in redraw-heavy UIs, and
[custom shaders][shaders] to create arbitrary visual effects.

[graphemes]: https://mitchellh.com/writing/grapheme-clusters-in-terminals
[sync]: https://gist.github.com/christianparpart/d8a62cc1ab659194337d73e399004036
[shaders]: https://twitter.com/mitchellh/status/1724649962397646900

Terminal emulators are not static: they continue to evolve and innovate to
solve users' problems and improve users' experience. The underlying technology
is old: downright ancient by the standards of modern tech. But, instead of a
flaw, I consider this a strength: it gives me confidence that while individual
terminal emulators may come and go, the underlying platform will endure.

## References & Further Reading

* [The TTY demystified](http://www.linusakesson.net/programming/tty/)
* [What happens when you press a key in your terminal?](https://jvns.ca/blog/2022/07/20/pseudoterminals/)
* [A history of the tty](https://computer.rip/2024-02-25-a-history-of-the-tty.html)
* [Understanding ASCII (and terminals)](https://bestasciitable.com)
* [Comprehensive keyboard handling in terminals][kkp]
* [Fix Keyboard Input on Terminals - Please][fixterms]
* [Grapheme Clusters and Terminal Emulators][graphemes]

<!------>

[^1]: This depends on your exact definition of "underlying technology". Here,
    I'm referring to the use of teletype machines (TTYs) connected to a
    digital computer. But teletypes themselves were created well over a
    century ago, and there are still traces of their design in the inner
    workings of terminal emulators.
[^2]: Technically, it uses whichever version of the key, shifted or unshifted,
    falls in the range `[0x20, 0x5f]`. For alphabetic characters, this is the
    shifted (uppercase) letter, but for keys like `[` or `-` it uses the
    unshifted variant.
