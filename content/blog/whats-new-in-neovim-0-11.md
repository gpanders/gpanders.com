---
title: "What's New in Neovim 0.11"
date: 2025-03-26
---

[Neovim 0.11](https://github.com/neovim/neovim/releases/tag/stable) was just released. As in [previous][0.7] [installments][0.10] in this series, let's talk a bit about some of the big highlights! As always, the full list of changes can be found in the [release notes][] (use `:h news` to read inside of Neovim).

[0.7]: https://gpanders.com/blog/whats-new-in-neovim-0-7/
[0.10]: https://gpanders.com/blog/whats-new-in-neovim-0.10/
[release notes]: https://neovim.io/doc/user/news.html

## Table of Contents

* [Breaking Changes](#breaking-changes)
* [LSP](#lsp)
  - [Simpler LSP setup and configuration](#simpler-lsp-setup-and-configuration)
  - [Builtin auto-completion](#builtin-auto-completion)
  - [Improved hover documentation](#improved-hover-documentation)
  - [Putting it all together](#putting-it-all-together)
* [Diagnostics](#diagnostics)
  - [Virtual text handler changed from opt-out to opt-in](#virtual-text-handler-changed-from-opt-out-to-opt-in)
  - [Virtual lines](#virtual-lines)
* [Defaults](#defaults)
  - [More default mappings](#more-default-mappings)
* [Terminal](#terminal)
* [Miscellaneous](#miscellaneous)

## Breaking Changes

We make a concerted effort to avoid breaking changes. We want the upgrade path between versions to be smooth and simple, but occasionally breaking changes are necessary (often times, a breaking change is a bug fix, or there is no way to introduce a transition path between old and new behavior). The full list of breaking changes can be found in the [release notes][] (`:h news-breaking`). Plugin authors are especially encouraged to carefully read this section, as many of the changes have to do with "lower level" APIs.

## LSP

### Simpler LSP setup and configuration

Since the LSP client was first introduced to Neovim in version 0.5 the `nvim-lspconfig` plugin has been a near requirement. This caused some confusion and introduced additional complexity. Neovim supposedly had LSP "builtin", so why was a separate plugin necessary? And for new users, the process of installing a plugin is complex and unclear. Neovim does not (yet) ship with a builtin plugin manager, so newcomers to Neovim were faced with the task of choosing and installing one of dozens of different plugin managers just to access some of Neovim's builtin features.

For a long time this situation has been deemed unsatisfactory, both by users (we're well aware of the "Neovim is too hard to setup" memes!) and by many on the core team (with first attempts to improve the situation happening almost [3 years ago](https://github.com/neovim/neovim/pull/18506)). The difficulty for the core team was deciding how exactly to improve the situation. How could we make onboarding to Neovim and using LSP simpler and easier, without introducing too much "magic" or being too opinionated? Neovim is unapologetically a tool for power users, so any efforts to make things easier for new users should not come at the cost of (overly) inconveniencing experienced users.

Discussions around these topics occurred many, many times over several years, often ending in disagreement. The situation remained unresolved because we could not agree on a design that satisfied everyone.

Finally, late in 2024, Lewis Russell ([@lewis6991] on GitHub) [proposed](https://github.com/neovim/neovim/pull/31031) two new interfaces: `vim.lsp.config()` and `vim.lsp.enable()`. These are high-level user facing APIs designed with the explicit goal of eventually obviating most of the code in `nvim-lspconfig`, turning it into a simple "bag of configs".

[@lewis6991]: https://github.com/lewis6991

With these new APIs, configuring LSP in Neovim becomes quite a bit simpler and makes it much easier to use LSP without `nvim-lspconfig`. For example, to configure clangd, a user can use the following:

```lua
vim.lsp.config.clangd = {
  cmd = { 'clangd', '--background-index' },
  root_markers = { 'compile_commands.json', 'compile_flags.txt' },
  filetypes = { 'c', 'cpp' },
}

vim.lsp.enable({'clangd'})
```

The user must provide a few required options for each server (the command to execute, the "root markers" used to determine the root directory of the workspace, and the filetypes associated with this LSP server). The explicit `enable` call is used to decouple configuration from enabling: this allows plugins to provide configurations for a server while still allowing the user to determine when and if a given configuration should be enabled.

However, another great aspect of this feature is that Neovim will also scan files on the user's [runtimepath] for LSP configurations. The same clangd example above can instead be achieved by creating a file `~/.config/nvim/lsp/clangd.lua` with the contents[^1]:

```lua
return {
  cmd = { 'clangd', '--background-index' },
  root_markers = { 'compile_commands.json', 'compile_flags.txt' },
  filetypes = { 'c', 'cpp' },
}
```
[runtimepath]: https://neovim.io/doc/user/options.html#'runtimepath'

Then you only need to call `vim.lsp.enable()` with all of the LSP servers you want to auto-enable. The name of the server corresponds to the name of the file under the `lsp/` directory (e.g. if you have `lsp/clangd.lua`, `lsp/gopls.lua`, and `lsp/rust-analyzer.lua`, you can add `vim.lsp.enable({'clangd', 'gopls', 'rust-analyzer'})` to your `init.lua` file).

This follows the model used by Vim and Neovim for other configuration files, such as filetype plugins (ftplugins), color schemes, and Lua modules: place the file in your runtimepath and let Neovim discover it. The goal is to eventually have `nvim-lspconfig` be just a bundle of simple config files under an `lsp/` directory to provide some convenient out of the box configurations.

Use `:checkhealth lsp` to view LSP related diagnostics and to view all of your configured LSP servers.

[^1]: More examples [here](https://codeberg.org/gpanders/dotfiles/src/branch/master/.config/nvim/lsp). These examples use [Fennel](https://fennel-lang.org/) rather than Lua, but the concept is the same.

### Builtin auto-completion

Another big feature coming to LSP in this release is builtin auto-completion. Neovim has long had manual completion (inherited from Vim) and in the prior release, we set the default [omnifunc][omnifunc] to use LSP completion sources, so users could manually trigger LSP completion using `<C-X><C-O>`. In this release we take this a step further by providing opt-in auto-completion from LSP sources. Credit goes to [Mathias Fußenegger](https://zignar.net) ([@mfussenegger](https://github.com/mfussenegger/) on GitHub) for writing the original implementation in his [nvim-lsp-compl](https://github.com/mfussenegger/nvim-lsp-compl) plugin.

Auto-completion can be enabled using the `vim.lsp.completion.enable()` function. Example:

```lua
vim.api.nvim_create_autocmd('LspAttach', {
  callback = function(ev)
    local client = vim.lsp.get_client_by_id(ev.data.client_id)
    if client:supports_method('textDocument/completion') then
      vim.lsp.completion.enable(true, client.id, ev.buf, { autotrigger = true })
    end
  end,
})
```

[omnifunc]: https://neovim.io/doc/user/options.html#'omnifunc'

### Improved hover documentation

The `vim.lsp.buf.hover()` function (mapped to `K` in Normal mode by default) shows a floating window displaying documentation of the symbol under the cursor. This window now uses Markdown tree-sitter highlighting, which has a number of benefits, including highlighting code regions for other languages (using tree-sitter injections), so long as the parser for that language is installed. Concretely, this means that if the documentation for a function contains a code sample, the code sample will be properly syntax highlighted.

Users may find that the borders on their hover windows have vanished after updating. This is because Neovim no longer uses global callbacks for LSP responses (a necessary breaking change to correctly support multiple LSP clients in a buffer), so overriding `vim.lsp.handlers['textDocument/hover']` to add borders to the hover window will no longer work. Fortunately, there is also a new option in this release called [winborder][winborder] which sets the default border for all floating windows. For example, use `vim.o.winborder = 'rounded'` to use rounded borders on all floating windows.

[winborder]: https://neovim.io/doc/user/options.html#'winborder'

### Putting it all together

The video below demonstrates how simple it is to set up LSP completely from scratch: no extra plugins required.

{{< video src="/media/nvim_lsp_config.mp4" type="video/mp4" >}}

See [`:h lsp-quickstart`][lsp-quickstart] for details.

[lsp-quickstart]: https://neovim.io/doc/user/lsp.html#_quickstart

## Tree-sitter performance

Many improvements have been made to improve tree-sitter performance. Special thanks to [@ribru17](https://github.com/ribru17) who was the main driving force for many of these improvements!

* Tree-sitter highlighting, folding, and injected query iteration are asynchronous. This dramatically improves startup times for large files ([#31631](https://github.com/neovim/neovim/pull/31631), [#31827](https://github.com/neovim/neovim/pull/31827), [#32000](https://github.com/neovim/neovim/pull/32000)). To quote one reviewer:

  > Just tried this locally, wow, this kicks ass.

* Changes to how tree-sitter queries are cached reduces the need to re-parse queries, which improves performance significantly for large queries ([#31974](https://github.com/neovim/neovim/pull/31974))

## Better emoji support

Incorrect display of emojis which use ZWJ or other modifiers was [another long standing issue](https://github.com/neovim/neovim/issues/7151) (open since 2017). This and other Unicode issues were [resolved in Neovim 0.11](https://github.com/neovim/neovim/pull/30014). Grapheme clusters should now display appropriately and have the correct width.

Neovim also supports DEC mode 2027 to indicate to the parent terminal that it supports proper grapheme clustering (rather than using legacy methods like `wcwidth`). For more info, see the [Terminal Unicode Core Specification](https://github.com/contour-terminal/terminal-unicode-core) and Mitchell Hashimoto's blog post on [Grapheme Clusters and Terminal Emulators](https://mitchellh.com/writing/grapheme-clusters-in-terminals).

{{< video src="/media/nvim_multibyte.mp4" type="video/mp4" >}}

## Diagnostics

### Virtual text handler changed from opt-out to opt-in

Neovim no longer enables the "virtual text" diagnostic handler by default. It must now be opted-into explicitly with

```lua
vim.diagnostic.config({ virtual_text = true })
```

The virtual text handler also has a new `current_line` option to only enable virtual text diagnostics for the current cursor line:

```lua
vim.diagnostic.config({
  virtual_text = { current_line = true }
})
```

### Virtual lines

GitHub user [@WhyNotHugo](https://github.com/WhyNotHugo) created a plugin called [lsp_lines.nvim](https://git.sr.ht/~whynothugo/lsp_lines.nvim) which shows diagnostics as separate "virtual lines" in a buffer. We [reached out to Hugo](https://lists.sr.ht/~whynothugo/lsp_lines.nvim/%3CD3FSJHV4IWFK.2P7DVELWNKS88@gpanders.com%3E) a while ago to ask if he'd be interested in collaborating to upstream this plugin to Neovim. He was supportive, but the effort stalled out. That is, until about 2 months ago when Maria José Solano ([@MariaSolOs](https://github.com/MariaSolOs)) picked up the torch and put together a [PR](https://github.com/neovim/neovim/pull/31959) adding this feature into Neovim core. Many thanks to Hugo for supporting this effort and for creating the original plugin in the first place, and to Maria for doing the work of porting!

{{< figure src="/img/nvim-virtual-lines-3.png"
           caption="New virtual lines diagnostic handler"
           alt="Demonstration of the virtual lines diagnostic handler"
           attr="@WhyNotHugo"
           attrlink="https://github.com/neovim/neovim/pull/31959#issuecomment-2585354157" >}}

To enable this feature, use

```lua
vim.diagnostic.config({
  -- Use the default configuration
  virtual_lines = true

  -- Alternatively, customize specific options
  -- virtual_lines = {
  --  -- Only show virtual line diagnostics for the current cursor line
  --  current_line = true,
  -- },
})
```

## Defaults

### More default mappings

In addition to the new configuration APIs detailed above, we've also tried to make LSP simpler for new users by adding some more default key mappings. These mappings will not override users existing mappings, so experienced users are free to ignore them and use whatever mappings they are used to. The goal is to eliminate some steps for brand new users.

* `grn` in Normal mode maps to `vim.lsp.buf.rename()`
* `grr` in Normal mode maps to `vim.lsp.buf.references()`
* `gri` in Normal mode maps to `vim.lsp.buf.implementation()`
* `gO` in Normal mode maps to `vim.lsp.buf.document_symbol()` (this is analogous to the `gO` mappings in help buffers and `:Man` page buffers to show a "table of contents")
* `gra` in Normal and Visual mode maps to `vim.lsp.buf.code_action()`
* `CTRL-S` in Insert and Select mode maps to `vim.lsp.buf.signature_help()`
* `[d` and `]d` move between diagnostics in the current buffer (`[D` jumps to
  the first diagnostic, `]D` jumps to the last)

We've also included versions of some of the mappings from Tim Pope's
[vim-unimpaired](https://github.com/tpope/vim-unimpaired):

* `[q`, `]q`, `[Q`, `]Q`, `[CTRL-Q`, `]CTRL-Q` navigate through the quickfix list
* `[l`, `]l`, `[L`, `]L`, `[CTRL-L`, `]CTRL-L` navigate through the location list
* `[t`, `]t`, `[T`, `]T`, `[CTRL-T`, `]CTRL-T` navigate through the tag matchlist
* `[a`, `]a`, `[A`, `]A` navigate through the argument list
* `[b`, `]b`, `[B`, `]B` navigate through the buffer list
* `[<Space>`, `]<Space>` add an empty line above and below the cursor

## Terminal

The embedded terminal emulator has received a lot of love during this release cycle. Some highlights:

* Programs in the terminal can now change the shape and blink of the cursor (this [feature request](https://github.com/neovim/neovim/issues/3681) was created in 2015, almost 10 years ago!)
* Programs in the terminal can use the OSC 52 escape sequence to interact with the user's clipboard. Note: this is separate from Neovim's own OSC 52 support, which is used for copying and pasting text in normal buffers.
* Programs in the terminal can use the OSC 8 escape sequence to emit hyperlinks. Neovim will detect these and add appropriate metadata to make them clickable in the parent terminal emulator.
* When a program in the terminal enables DEC mode 2031 (theme update notifications), Neovim will send a notification to the program in the terminal whenever the `'background'` option changes. This is useful for automatically updating color schemes based on the lightness or darkness of the background color. This works in the main Neovim instance too. [Demo](https://bsky.app/profile/gpanders.com/post/3lbpyrb6nus25)
* The terminal now supports a subset of the kitty keyboard protocol
  (["Disambiguate escape codes"](https://sw.kovidgoyal.net/kitty/keyboard-protocol/#disambiguate-escape-codes)). Programs that use the kitty keyboard protocol (such as Neovim itself!) will now work when running in Neovim's terminal.
* New mappings `[[` and `]]` will jump between shell prompts in a terminal buffer as long as the shell emits semantic prompt markers (OSC 133 sequences). Fish 4.0 emits these by default, and many terminal emulators come with "shell integration" scripts to enable these markers. This also allows you to set up [prompt markers](https://bsky.app/profile/gpanders.com/post/3ldjcduqpvc26) in your terminal (see `:h shell-prompt-signs` for example code).

## Miscellaneous

* Use `g==` in Normal mode in a help buffer to execute a block of code. This
  is useful for running code examples in help docs (example use case: you open up a log file that contains terminal escape sequences. Run `:h terminal-scrollback-pager`, move your cursor over the example code for the `:TermHl` command, press `g==`, and now run `:TermHl` in the log file buffer).
* The [completeopt][completeopt] option has a new "fuzzy" value that enables fuzzy completion.
* Extmarks now have the ability to conceal entire lines, rather than just
  characters within a line. This is used, for example, in Markdown buffers to hide code fences (e.g. `` ``` ``) when [conceallevel][conceallevel] is set without leaving empty lines.
* New right-click menu items include "Go to definition" and "Open in web browser" (when Neovim can detect that you are right clicking on a URL).

[completeopt]: https://neovim.io/doc/user/options.html#'completeopt'
[conceallevel]: https://neovim.io/doc/user/options.html#'conceallevel'

## Getting Involved

There is nothing quite as fun as hacking on your own tools. If you are a Neovim user, I encourage you to get involved, whether that is through contributing directly to the Neovim project or a plugin, or simply participating in community spaces such as the [Neovim Matrix room][]. If you have pain points or frustrations when using Neovim, please let us know. Many of us on the core maintenance team have been using Vim/Neovim for so long that we've forgotten what it's like to be a beginner and, speaking for myself at least, this can leave blind spots on how things can be improved.

Thanks for reading and for using Neovim!

[Neovim matrix room]: https://matrix.to/#/#neovim:matrix.org
