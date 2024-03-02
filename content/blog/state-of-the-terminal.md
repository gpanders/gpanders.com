---
title: "State of the Terminal"
date: 2024-02-17T21:36:42-06:00
draft: true
---

_This is a companion article to a [talk I gave][talk] at Neovimconf 2023 last
December._

[talk]: https://vimeo.com/896237832?share=copy

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
and create problem solving happening in this space, even though the underlying
technology is over half a century old[^1].

I've also found that many people who use terminal based tools (including
shells like Bash and editors like Vim) know very little about terminals
themselves, or some of the modern features and capabilities they can support.

In this article, we'll discuss some of the problems that terminal based
applications have historically had to deal with (and what the modern
solutions are) as well as some of those cool new features that modern terminal
emulators support.

But first, a (very) brief history lesson.

### Background & History

Most terminal emulators today can directly trace their roots back to the DEC
VT100. The VT100 was not the first video terminal, nor was it the last, but it
was the most popular (at the time). And as we've learned from history many
times since, what becomes popular creates the _de facto_ standard for
everything that comes after.

Video terminals were an improvement on the teletype machines that preceded
them. They could move the cursor around the screen to create interactive
interfaces. They could use color, and clear and redraw their displays quickly
without feeding out reams of paper.

However, each brand of video terminal had its own unique way of doing things
using unique, proprietary escape codes (a sequence of bytes beginning with the
escape `0x1b` character). This made it difficult for terminal based
application to take advantage of these features. Libraries and helper programs
(e.g. `termcap`) were created to help ameliorate these issues (we still live
with (and suffer from) the descendant of these early libraries, `terminfo`).

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

### Terminal Emulator Basics

Terminal based applications write two kinds of data to the terminal emulator:
printable text that is displayed to the user, and control codes, which modify
the terminal emulator's state. Control codes are either single bytes in the C0
character set (bytes `0x00` through `0x1F`) or sequences of bytes that begin
with the escape character (`0x1b`). These sequences are most commonly referred
to as "escape sequences", and it is these sequences that do the bulk of the
heavy lifting in creating interactive, modern terminal applications.

Most control codes from the C0 character set are not used today, but
regardless of experience with terminals or terminal applications, most
developers are likely familiar with control codes such as `\r` (carriage
return), which moves the cursor to the beginning of the current line, and `\n`
(line feed), which moves the cursor to the next line.

Escape sequences

- CSI

- DCS

- OSC

SGR

Link to state machine diagram at vt100.net

### Problems & Solutions

#### Key Encoding

kitty, modifyOtherKeys, fixterms

#### Decorations

- colored/shaped underlines
- bold/italic/strikethrough
- link to that 8 bit video of the changing color palette!!
- notcurses demo
- charm.sh
- images

#### Capability Determination

terminfo

querying (xtgettcap, decrqss, decrqm)

#### System Integration

osc52

osc8

osc9 (desktop notifications)

shell integration

### References & Further Reading

* [The TTY demystified](http://www.linusakesson.net/programming/tty/)
* [What happens when you press a key in your terminal?](https://jvns.ca/blog/2022/07/20/pseudoterminals/)
* [A history of the tty](https://computer.rip/2024-02-25-a-history-of-the-tty.html)

<!------>

[^1]: This depends on your exact definition of "underlying technology". Here,
    I'm referring to the use of teletype machines (TTYs) connected to a
    computer. But teletypes themselves were created well over a century ago,
    and there are still traces of their design in the inner workings of
    terminal emulators.

