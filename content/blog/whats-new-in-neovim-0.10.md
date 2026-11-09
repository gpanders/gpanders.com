---
title: "What's New in Neovim 0.10"
date: 2024-05-16
tags:
  - neovim
---

Neovim 0.10 was the longest release cycle since the heady days of the 0.5
release. There are a ton of new features in this release (as well as some
breaking changes), so be sure to check the full [release notes][]. You can
view the release notes directly in Nvim with `:h news`. The news file includes
information on new features, deprecations, and breaking changes. I especially
urge plugin authors to read this file carefully.

Like [last time][0.7], in this post I'll cover a subset of the new features.
As I said, it's a big release, and I won't write about everything, but these
are some of the highlights.

[release notes]: https://neovim.io/doc/user/news-0.10.html
[0.7]: /blog/whats-new-in-neovim-0-7/

## Table of Contents

* [Defaults](#defaults)
* [Builtin commenting](#builtin-commenting)
* [Terminal UI enhancements](#terminal-ui-enhancements)
* [LSP inlay hints](#lsp-inlay-hints)
* [Tree-sitter query editor](#tree-sitter-query-editor)
* [Miscellaneous](#miscellaneous)
* [Roadmap](#roadmap)

## Defaults

### Colorscheme

Nvim has been in need of a new default colorscheme for a long time. While the
default colors have some charm and nostalgia, there are serious accessibility
and aesthetic issues, particular when using Nvim is a diff viewer. The
screenshot below shows the default colorscheme before Nvim 0.10:

![Neovim's default colorscheme before 0.10](/media/nvim-colorscheme-old.png)

Nvim 0.10 now ships with a new default colorscheme, which you can see below:

![Neovim's new default colorscheme](/media/nvim-colorscheme-new.png)

The new default colorscheme was heroically contributed by [Evgeni
Chasnovski][@echasnovski], who endured seemingly endless bikeshedding and
successfully navigated the treacherous waters of such a subjective change.
There were many constraints imposed on the design of the colorscheme, which
you can read in the [PR][#26334] (and the many follow up PRs and issues linked
therein). It is quite literally impossible to please _everyone_ with a single
colorscheme, and there is no expectation that we have achieved that, but the
new colorscheme does, hopefully, improve the default experience for many
people.

[@echasnovski]: https://github.com/echasnovski
[#26334]: https://github.com/neovim/neovim/pull/26334

### LSP and Diagnostics Mappings

Nvim 0.10 adds a new [default mapping][#24331]: `K` in Normal mode maps to
`vim.lsp.buf.hover()` whenever a buffer attaches to an LSP client, unless
`'keywordprg'` is already set to a non-default value. Use this to view
information about the function or variable under the cursor. This in addition
to the existing defaults mentioned in `:h lsp-defaults` which were added in
the previous release.

In addition, there are new [default mappings][#16230] for navigating
diagnostics:

* `[d` and `]d` in Normal mode map to `vim.diagnostic.goto_prev()` and
  `vim.diagnostic.goto_next()`, respectively. Use these to navigate between
  diagnostics in the current buffer.
* `<C-W>d` (and `<C-W><C-D>`) in Normal mode map to
  `vim.diagnostic.open_float()`. Use this to view information about any
  diagnostics under the cursor in a floating window.

The diagnostics mappings override builtin mappings. These builtin mappings are
not often used, but if you _do_ use them you can delete the new default
mappings with `vim.keymap.del()` or `:unmap`.

The intention behind providing more default mappings is to make it easier to
get started with LSP in Neovim. The hope is that most users should be able to
get up and running with useful LSP features with little to no configuration
and without needing to write a bunch of Lua code. We have plans to add more
defaults in future releases, though as you might imagine this is a fraught
exercise. It is quite difficult to change default behavior in a tool as
extensible and customizable as Nvim without breaking users'
[workflows](https://xkcd.com/1172/).

Two features which many users rely on for their LSP experience are snippets
support and autocompletion. Both of these features are on the roadmap to be
included in Nvim core (see [#27339][], [#25696][], and [#25670][]) which
will, hopefully, make the experience of using LSP in Neovim even smoother in
the future.

[#24331]: https://github.com/neovim/neovim/pull/24331
[#16230]: https://github.com/neovim/neovim/pull/16230
[nvim-lspconfig]: https://github.com/neovim/nvim-lspconfig
[#27339]: https://github.com/neovim/neovim/pull/27339
[#25696]: https://github.com/neovim/neovim/issues/25696
[#25670]: https://github.com/neovim/neovim/issues/25670

## Builtin Commenting

Longtime Vim users are likely familiar with the venerable [vim-commentary][]
plugin, which creates mappings and operators for commenting and uncommenting
text. Thanks to [Evgeni Chasnovski][@echasnovski], Nvim 0.10 now [bundles this
functionality][#28176] by default, using a from-scratch implementation in
Lua. Unlike vim-commentary, Nvim's builtin implementation provides a text
object and supports Tree-sitter, which is useful when working in injected
languages (example: if you comment text inside a `<script>` tag in an HTML
buffer, it will correctly use the Javascript `//` comment string rather than
HTML's `<!-- -->` comment string).

See `:h commenting` for more details.

[vim-commentary]: https://github.com/tpope/vim-commentary
[mini.comment]: https://github.com/echasnovski/mini.comment
[#28176]: https://github.com/neovim/neovim/pull/28176

## Terminal UI enhancements

Nvim 0.10 adds support for many new terminal based capabilities.

### Synchronized Output

Many modern terminal emulators support [synchronized output][] which allows
terminal applications (like Nvim) to "batch" all of their UI updates in the
terminal emulator and display them all at once. This can reduce "flickering"
and "tearing" when a terminal UI (TUI) is being drawn very rapidly. This can
sometimes happen in Nvim when using plugins that perform rapid UI updates
(e.g. spinners, LSP status windows, etc.). Nvim 0.10 introduces a new
`'termsync'` option (enabled by default) which enables this feature if it is
supported by the terminal emulator.

[synchronized output]: https://gist.github.com/christianparpart/d8a62cc1ab659194337d73e399004036

### System clipboard synchronization

Nvim 0.10 can now use the OSC 52 escape sequence to write to (or read from)
the system clipboard. OSC 52 is only used automatically when (1) it is able to
determine that the terminal emulator supports it (via XTGETTCAP), (2) it is
running in an SSH session, and (3) when the `'clipboard'` option is unset.
Note that some terminal emulators do not support reading from the system
clipboard with OSC 52, or only allow it after prompting the user for
confirmation. It is recommended to use the traditional "paste" key binding
(e.g. `Cmd+V` on macOS or `Ctrl+Shift+V` on Linux) to paste into Nvim from the
system clipboard and use `"+` to copy to the clipboard inside Nvim (see `:h
quoteplus`).

### Hyperlinks

Nvim 0.10 introduces experimental support for hyperlinks using the OSC 8
sequence. By default, this is used in Markdown for links of the form
`[example](https://example.com)`. If your terminal emulator supports the OSC 8
escape sequence, then the text `example` in the Nvim buffer will contain a
hyperlink that can be clicked and will open `https://example.com` in your web
browser.

This means that users can view Markdown files with `:set conceallevel=2` and
get an experience much closer to the rendered output:

![Screenshot of the Neovim README opened in Nvim](/media/nvim-readme.png)

In the screenshot above, the underlined words are clickable link text, just as
you would find in a web browser.

### Automatic truecolor detection

Nvim 0.10 will now automatically determine if the terminal emulator supports
24 bit color ("truecolor") and enable the `'termguicolors'` option if it does.
It does this through a combination of heuristics (`$COLORTERM`, terminfo) and
terminal queries (DECRQSS, XTGETTCAP). This detection works even over SSH
connections and when inside a terminal multiplexer such as `tmux`.

## LSP inlay hints

Nvim 0.10 now supports [LSP inlay hints][#23984] thanks to [Chinmay
Dalal][@p00f]. A picture here will do more than my words can:

![Screenshot of Nvim showing inlay hints](/media/nvim-inlay-hints.png)

The dark colored texts which display type annotations for variable declarations
are inlay hints. This text is not part of the actual source file in the
buffer, but is "virtual" text inserted by Nvim and provided by the language
server. These hints can be enabled or disabled dynamically using
`vim.lsp.inlay_hint.enable()`.

Many other new LSP features were added in Nvim 0.10 as well. Refer to the
"LSP" section in `:h news` for a full list.

[#23984]: https://github.com/neovim/neovim/pull/23984
[@p00f]: https://github.com/p00f

## Tree-sitter query editor

Nvim 0.10 adds even more tools for working with Tree-sitter queries. If you
didn't know already, Nvim bundles an "inspector" which allows you to view the
abstract syntax tree of any source file with the `:InspectTree` command (so
long as a Tree-sitter parser for the file's language is installed). Example:

![Screenshot of the :InspectTree command in Nvim](/media/nvim-inspect-tree.png)

Thanks to [Maria José Solano][@MariaSolOs], Nvim 0.10 adds a powerful
capability to the Tree-sitter inspector: [a query editor][#24703]. The query
editor allows you to write queries and see the matches in a source buffer in
real time. Being able to create and modify queries interactively makes writing
new queries a breeze. Example:

![Screenshot of the :EditQuery command in Nvim](/media/nvim-query-editor.png)

In the screenshot above, the query editor is open in the top-right window, the
tree inspector is in the bottom-right window, and the source buffer is in the
left window. Notice that the text that is matched by the query in the query
editor is highlighted in the source buffer and that the text **initializer**
(the capture group used in the query) is floating on the line next to the
match. As the query is updated in the editor, the corresponding highlights in
the source buffer change in real time.

The query editor can be opened by pressing `o` in the `:InspectTree` window,
with the `:EditQuery` command, or by calling `vim.treesitter.query.edit()`
directly.

With `:InspectTree` and `:EditQuery`, Neovim is one of the best tools (if not
_the_ best tool) for working with Tree-sitter, even if you don't actually use
Neovim.

[#24703]: https://github.com/neovim/neovim/pull/24703
[@MariaSolOs]: https://github.com/MariaSolOs

## Miscellaneous

As I mentioned at the top of this post, there are _a lot_ of new features in
this release, and I am not going to cover all of them. Here I'll list a few
more that I personally think are worth mentioning:

* The `:terminal` command now accepts modifiers, so you can use e.g. `:botright
  terminal` (or `:bo te`) to open a new terminal window in a split at the
  bottom of your screen. In addition, `:terminal` buffers that are started
  with no arguments (and thus open a shell) will close automatically when the
  shell exits without an error.

* `gx` in Normal mode calls `vim.ui.open()` on whatever is under the cursor,
  which shells out to your operating system's "open" capability (e.g. `open`
  on macOS or `xdg-open` on Linux). For instance, pressing `gx` on a URL will
  open that URL in your browser.

* Tree-sitter based syntax highlighting is enabled by default for Lua, Vimdoc
  (`:help`), and Tree-sitter queries (to revert to traditional regex
  based syntax highlighting, create a `FileType` autocommand or `ftplugin`
  with `vim.treesitter.stop()` for the respective filetype).

* `Q` and `@` in Visual mode will execute the last recorded/executed macro for
  all visually selected lines.

* Users using a terminal emulator that supports the Kitty keyboard protocol
  can create mappings using the "super" and "meta" modifiers with the `<D-`
  and `<T-` prefixes, respectively (e.g. `<D-S>` is `Cmd+S` on macOS).

## Roadmap

The Neovim project is loosely organized and structured. We follow a "fun
driven development" paradigm: for the most part, contributors and maintainers
work on things that are personally interesting to them. Because of this, it
can be difficult to predict what will happen in future releases. If there is a
feature you want to see implemented, the best way to do it is to take a crack
at it yourself: many of the features mentioned in this very blog post were
contributed by users that are not part of the "core" maintenance team!

There is active chatter about further improving the LSP and Tree-sitter
experience (as mentioned above, builtin snippet and completion support are a
work-in-progress). One of the biggest challenges with Tree-sitter is parser
distribution: currently, parsers are shared object files which must be
compiled on every user's machine or distributed with a system package manager.
We are already working on implementing the new [Tree-sitter WASM
capabilities][#28415] which will enable distributing Tree-sitter parsers as
portable WASM blobs. This solves the distribution problem and may enable
Neovim to ship more Tree-sitter parsers out of the box.

We would also like to integrate some of the functionality from
[nvim-lspconfig][] so that, ideally, nvim-lspconfig is just a "bag of configs"
without any smarts or core logic. How best to do this is still hotly debated,
but it is something that is being discussed.

[#28415]: https://github.com/neovim/neovim/pull/28415

## Getting Involved

There is nothing quite as fun as hacking on your own tools. If you are a
Neovim user, I encourage you to get involved, whether that is through
contributing directly to the Neovim project or a plugin, or simply
participating in community spaces such as the [Neovim Matrix room][]. If you
have pain points or frustrations when using Neovim, please let us know. Many
of us on the core maintenance team have been using Vim/Nvim for so long that
we've forgotten what it's like to be a beginner and, speaking for myself at
least, this can leave blind spots on how things can be improved.

Thanks for reading and for using Neovim! Hopefully the next update will come a
little sooner.

[Neovim matrix room]: https://matrix.to/#/#neovim:matrix.org

# One Last Thing

The Neovim project now has a merch [store](https://store.neovim.io/)! If you
didn't know that you needed a Neovim branded hoodie or mug, now you do. All
proceeds raised from the store are used to fund project needs and sponsor
full-time development work.
