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

It's only been in the last couple of years that I've really begun to dig deep
into the inner workings of how terminal emulators, and the applications that
run inside of them, really work. I've learned that there is a lot of active
innovation and development in this space, even though the underlying
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

Video terminals were a big step up from the teletype machines (TTYs) that
preceded them. They could move the cursor around the screen to create
interactive interfaces. They could use color, and clear and redraw their
displays quickly without feeding out reams of paper.

However, each brand of video terminal had their own unique ways of doing
things (via escape sequences, which we'll talk about later). This made it hard
for anyone who wanted to write a terminal based application to take advantage
of these features. Libraries and helper programs (e.g. `termcap`) were created
to help ameliorate these issues (we still live with and suffer from the
descendant of these early libraries, `terminfo`).

Eventually, a formal standard was created, called ECMA-48. This defined a
basic set of control codes. **TODO: What else did ECMA-48 define?**

VT100 was the first VT to implement ECMA 48. Became very popular. New models
cloned the VT100. Xterm cloned the VT220. Everyone else cloned Xterm. Fast
forward to today.

### Terminal Emulator Basics

Control sequences (`\r`, `\n`, `\a`)

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

<!------>

[^1]: This depends on your exact definition of "underlying technology". Here,
    I'm referring to the use of teletype machines (TTYs) connected to a
    computer. But the original TTYs were created well over a century ago, and
    there are still traces of their design in the inner workings of terminal
    emulators.

