---
title: Evaluating Markdown Code Blocks in Vim
date: 2019-08-12
tags: [markdown, vim]
---

When writing Markdown it is common to have code blocks within your document
that look something like this:

    This is a code block:
    ```bash
    echo "Hello, world!"
    ```

One of the great features of Emacs' [Org mode](https://orgmode.org/) is its
ability to evaluate blocks of code from within the editing environment. I
always appreciated this feature about Org mode which got me to thinking about
implementing something similar in Vim.

<!--more-->

**Update (2020-03-02):** I've packaged this into a Vim plugin called
[Medieval](https://github.com/gpanders/vim-medieval). The remainder of this
post contains the original implementation, which is now out-of-date.

---

The solution ended up being fairly straightforward. I created the following
[autoloaded](http://learnvimscriptthehardway.stevelosh.com/chapters/53.html)
function in `~/.vim/autoload/ft/markdown.vim`:

```vim
function! ft#markdown#eval()
  let view = winsaveview()
  let line = line('.')
  let start = search('^\s*[`~]\{3,}\S*\s*$', 'bnW')
  if !start
    return
  endif

  call cursor(start, 1)
  let [fence, lang] = matchlist(getline(start), '\([`~]\{3,}\)\(\S\+\)\?')[1:2]
  let end = search('^\s*' . fence . '\s*$', 'nW')
  let langidx = index(map(copy(g:markdown_interp_languages), 'split(v:val, "=")[0]'), lang)

  if end < line || langidx < 0
    call winrestview(view)
    return
  endif

  if g:markdown_interp_languages[langidx] !=# lang
    let lang = split(g:markdown_interp_languages[langidx], '=')[1]
  endif

  let block = getline(start + 1, end - 1)
  let tmp = tempname()
  call writefile(block, tmp)
  echo system(lang . ' ' . tmp)
  call winrestview(view)
endfunction
```

Basically, the function looks backward from the current cursor position for any
line that matches the start of a code block (three or more back ticks followed
by a language name) and then looks forward for the close of the code block. If
the current cursor position is between those two locations, then we know we're
in a code block. At that point, it's as simple as copying the text within the
code block to a temp file and sourcing it using the interpreter given by the
syntax of the code block (e.g. bash, ruby, etc.).

Obviously, not all languages can be run in an interpreter, so there is also a
check to make sure the language of the code block is in a user-specified
variable `g:markdown_interp_languages`. I set this in my Markdown ftplugin file
(`~/.vim/after/ftplugin/markdown.vim`):

```vim
let g:markdown_interp_languages = ['python', 'sh=bash', 'bash', 'ruby', 'console=bash']
```

The `=` syntax lets me specify that certain syntaxes use the same interpreter
(e.g. `sh` and `console` syntaxes should both use `bash` as their interpreter).
Adding more languages is as simple as extending this global variable.

Finally, I map this function to a key binding in my ftplugin file:

```vim
nnoremap <silent> <buffer> Z! :<C-U>call ft#markdown#eval()<CR>
```

Now I can press `Z!` in a code block in Markdown and have the block evaluated.

This is a very lightweight solution and doesn't have anywhere near the full
features of Org mode (which includes things like inline results, persistent
contexts, mangling, and more), but it's a good first cut solution which I'm
happy with.

As always, you can find the most up-to-date version of the function above, as
well as all of my Vim files, [here](https://github.com/gpanders/dotfiles).
