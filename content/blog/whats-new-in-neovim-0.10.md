---
title: "Whats New in Neovim 0.10"
date: 2024-03-15T07:06:36-05:00
tags: [neovim]
draft: true
---

Neovim 0.10 was the longest release cycle since the heady days of the 0.5
release. There are a ton of new features in this release (as well as some
breaking changes, so be sure to check the full [release notes][]!)

Also be sure to check out `:h news` when upgrading! This is a builtin version
of the release notes that was updated (by hand) continuously throughout the
release cycle. The news file includes information on new features,
deprecations, and breaking changes. I especially urge plugin authors to read
this file carefully.

Like [last time][0.7], in this post I'll cover a subset of the new features.
As I said, it's a big release, and I won't write about everything, but these
are some of the highlights.

[release notes]: TBD
[0.7]: {{< relref "blog/whats-new-in-neovim-0.7" >}}

## Table of Contents

* [New default colorscheme](#new-default-colorscheme)
* [Terminal UI enhancements](#terminal-enhancements)
* [LSP inlay hints](#lsp-inlay-hints)
* [Tree-sitter query editor](#tree-sitter-query-editor)
* [New 'winfixbuf' option](#new-winfixbuf-option)

## New default colorscheme

Original issue: https://github.com/neovim/neovim/issues/14790
PR: https://github.com/neovim/neovim/pull/26334

Credit: Evgeni Chasnovski ([@echasnovski][])

[@echasnovski]: https://github.com/echasnovski

## Terminal UI enhancements

- 'termsync'
- OSC 52
    - Automatic support with XTGETTCAP
- OSC 8
- Auto-enable truecolors when supported
    - DECRQSS
    - XTGETTCAP

## LSP inlay hints

Include screenshot, picture is worth a thousand words

Credit: Chinmay Dalal ([@p00f][])

PR: https://github.com/neovim/neovim/pull/23736

[@p00f]: https://github.com/p00f

## Tree-sitter query editor

"If you didn't already know about the Tree-sitter inspector..."

You can edit queries and see the results live.

"Neovim is the best tool for working with Tree-sitter, even if you don't use
Neovim".

:InspectTree

:EditQuery

Credit: Maria José Solano ([@MariaSolOs][])

[@MariaSolOs]: https://github.com/MariaSolOs

## New 'winfixbuf' option

It often happens that a Nvim user or contributor first adds a new feature to
Vim (Nvim's "upstream") and, if when it is accepted in Vim, ports it to Nvim.
That is what happened with the `'winfixbuf'` feature, which was implemented
first in [Vim][vim#13903] and later ported to [Nvim][nvim#27738], both by the
same contributor (GitHub user [@ColinKennedy][]).

This feature ....

[vim#13903]: https://github.com/vim/vim/pull/13903
[nvim#27738]: https://github.com/neovim/neovim/pull/27738
[@ColinKennedy]: https://github.com/ColinKennedy
