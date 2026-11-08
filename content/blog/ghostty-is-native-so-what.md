---
title: "Ghostty Is Native—So What?"
date: 2024-12-20
---

[Ghostty][ghostty] is a new terminal emulator by Mitchell Hashimoto. While a
lot has been said about Ghostty's [performance][lightning talk], less
discussed is its native platform[^1] integration which is, in my opinion, its
most distinctive and underrated feature.

[ghostty]: https://mitchellh.com/ghostty
[devlog6]: https://mitchellh.com/writing/ghostty-devlog-006
[lightning talk]: https://www.youtube.com/watch?v=cPaGkEesw20&t=3015s

Despite being listed as a key motivating factor in Mitchell's original
[introduction][intro], online discussions about Ghostty rarely mention its
native integration, and when they do many commenters remain skeptical over its
importance or don't understand what that means. So I want to briefly describe
some of the ways that Ghostty takes advantage of native OS integration so you
can see for yourself what makes it stand out.

[intro]: https://mitchellh.com/writing/ghostty-and-useful-zig-patterns

Ghostty is cross-platform, but I'm only going to talk about the macOS
application here, partly because it's what I personally use most of the time,
but also because the native
integration on macOS is more full featured. macOS provides a lot of [features
and UI affordances][macOS tips] that applications can take advantage of to
provide a coherent, integrated experience. Ghostty makes use of many of these
features, making it feel more native than most other terminal emulators—iTerm2
being the main exception.

On Linux, "native" is a murkier concept because there's not a single
desktop environment. Instead, applications integrate with specific
environments like GNOME or KDE through their GUI frameworks (GTK/Adwaita or
Qt). Ghostty uses GTK and (optionally) Adwaita, making it most native to GNOME
while remaining visually consistent in KDE—though without as much deep system
integration as in macOS. I've noticed that many Linux users don't care about
apps being "native", which is understandable. In my experience, this is
something that macOS users tend to care about more.

If after reading this you remain unconvinced that being a native application
is something that one should care about in a terminal emulator, then that's
fine! Not everyone values the same things in their software. But at least
we'll be on the same page on exactly what it is you don't care about.

[macOS tips]: https://blog.xoria.org/macos-tips/

## What is a native application?

Let's get the definition out of the way. A "native" application is one which
uses the operating system's GUI toolkits, SDKs, and other libraries (e.g. font
rendering) to create a user experience that is coherent and consistent with
the rest of the operating system and other applications on the operating
system. This does not only cover UI elements like buttons and tabs, but the
entire user experience, from builtin key bindings, menu items, and other kinds
of system interactions.

## Native Tabs

Ghostty uses native tabs which have the same look and feel as tabs found in
applications like Safari, Preview, Finder, and Terminal.app.

{{< figure src="/media/ghostty-tabs.png" >}}

This also means that native features like pressing `Shift+⌘+\` open the tab
overview, just as in other applications.

{{< figure src="/media/ghostty-tab-overview.png" >}}

## Proxy Icon

Ghostty uses a "proxy icon" in the window title bar that gives you access to
the current working directory of the terminal. You can use this like any other
proxy icon in macOS: drag it into another application or right-click to
interact with it.

{{< video src="/media/ghostty_proxy_icon.mp4" type="video/mp4" >}}

## Look Up

Triple tap on the trackpad to use the macOS "look up" feature to find the
definition of a word or preview a URL:

{{< video src="/media/ghostty_look_up.mp4" type="video/mp4" >}}

## Secure Keyboard Entry

macOS has a feature called [secure keyboard
entry](https://support.apple.com/guide/terminal/use-secure-keyboard-entry-trml109/mac)
which prevents any other application from detecting or recording what you type
(it also prevents other applications from stealing focus, which is important
when you're entering sensitive data like passwords). Only Ghostty, iTerm2, and
Terminal.app support this feature. Ghostty automatically enables
it when you're typing a password—though it can also be enabled manually. Note
the icon in the upper right corner of the window:

{{< figure src="/media/ghostty-secure-keyboard.png" >}}

## Window Restoration

A cool feature of macOS is that application state can be serialized so that
when you re-launch the application later, you can pick up right where you left
off. Ghostty supports this too:

{{< video src="/media/ghostty_window_restore.mp4" type="video/mp4" >}}

For now only the window position and tabs/splits are restored, not the actual
terminal contents (like you see in Terminal.app). Restoring the terminal
contents is something that's on the long term roadmap though.

## Conclusion

Hopefully these examples clarify what I and others mean when we talk about
Ghostty being a "native application". I didn't showcase Linux here at all, but
it is worth mentioning that for GNOME users especially Ghostty feels like a
native app too. And for non-GNOME users, the Adwaita integration and most of
the GTK windowing features can be disabled, so that Ghostty looks just as at
home in a barebones tiling window manager as it does in a full-fledged desktop
environment.

That's all! Thanks for reading.

[^1]: As of this writing, that is macOS and Linux
