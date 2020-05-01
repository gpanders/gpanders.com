---
title: "Managing Dotfiles With Git"
date: 2020-05-01
tags: [git, dotfiles]
---

Managing so-called "dotfiles" (config files starting with a `.` in your home
directory) in git is a fairly common practice. There are many write-ups on
this topic already, but I wanted to share my own workflow as well as some
potentially useful tips and tricks.

<!--more-->

For those unaware, dotfile management basically consists of adding files such
as your `.vimrc`, `.tmux.conf` or other files in a git repository so that you
can both track changes in these files over time as well as share them across
multiple computers. If you have a home laptop and a work computer, you can
ensure you have the same setup on both by keeping your files in a git
repository that is synchronized on both machines.

There are a few common strategies for doing this. Perhaps the simplest (and
[the method I used for quite a while][dotfiles with symlinks]) is to keep all
of the files in a separate directory and symlink them into your home directory.
For example, you might have a directory called `.dotfiles` in your home
directory that contains your `.vimrc` file and symlink it into your home
directory using

```console
$ ln -s ~/.dotfiles/.vimrc ~/.vimrc
```

The advantage of this approach is that it allows you to use any file naming and
organizational scheme you want. You can keep all files related to Vim in a
`vim` directory and all files related to a program called `foo` in a separate
`foo` directory. As long as the symlink is in the right place with the right
name, it doesn't matter where it is in your git repo.

A second approach, which I now use, is to use your home directory as the git
repository and manage the files directly. Atlassian has a good [write up][] on
this method. My setup is almost identical to the one explained in that
article, with the exception that I clone my git repo to `.dotfiles` instead of
`.cfg` and instead of using a separate `cfg` alias to manage my dotfiles repo,
I simply created a wrapper shell function that behaves differently if I am in
my home directory:

```sh
git() {
	if [ "$PWD" = "$HOME" ]; then
		command git --git-dir="$HOME/.dotfiles" --work-tree="$HOME" "$@"
	else
		command git "$@"
	fi
}
```

What I like most about this method is how easy it is to bootstrap a new machine
with your dotfiles repo:

```console
$ git clone --bare git@git.gpanders.com:gpanders/dotfiles.git .dotfiles
$ git --git-dir=$HOME/.dotfiles --work-tree=$HOME checkout -f
```

You'll also probably want to set the `status.showUntrackedFiles` config option
to `no` so that `git status` doesn't list all of the untracked files in your
home directory.

I use many different computers on a day-to-day basis. I have a personal
laptop, a work laptop, and a work desktop, as well as multiple servers that I
often SSH into. In my dotfiles repository, I keep all of the files that I want
to use across all of my machines in the `master` branch, and on each individual
machine I create a new branch that contains commits that are specific to that
machine. For example, on my work computers I add my work email into my `mutt`
and `mbsync` configurations, which I do not want on my other machines. Changes
that I want to propagate across all of my different computers get committed
onto `master` and then I simply rebase my machine-specific branch onto
`master`.

What is the best method for adding a commit to `master` while on the
machine-specific branch?  The simplest and naïve approach is to simply checkout
the `master` branch, add and commit the changes, checkout the machine branch,
and then rebase:

```console
$ git checkout master
$ git add file1 file2
$ git commit -m "Updated file1 and file2"
$ git checkout machine
$ git rebase master
```

This is not ideal. Not only is it rather cumbersome, it also can introduce a
lot of friction if there are conflicts between the modified files in your
machine-specific branch and master, requiring you to first do a `git stash`
before `git checkout`, followed by a `git stash pop` and resolving any
conflicts that occur. Instead, we can create the commit directly on our
machine-specific branch, and then just copy it on to master after the fact:

```console
$ git add file1 file2
$ git commit -m "Updated file1 and file2"
$ git checkout master
$ git cherry-pick machine
$ git checkout machine
$ git rebase master
```

This can also be nice for creating multiple commits all at once:

```console
$ git add file1 file2
$ git commit -m "Updated file1 and file2"
$ git add file3
$ git commit -m "Updated file3"
$ git checkout master
$ git cherry-pick machine~2..machine
$ git checkout machine
$ git rebase master
```

This is what I did for a long time. I even smashed it all together into one
single, long command that was conveniently saved in my shell history so that I
didn't have to keep retyping it.

This is *still* not perfect though. Every time you change branches in your
dotfiles repository, the config files for your programs change. This can be
annoying or even cause problems for programs that live reload when they detect
a change in their config file. Therefore, we would ideally like to be able to
commit changes onto master without ever having to leave the machine-specific
branch.

Enter the *interactive rebase*.

In case you're not aware, the interactive rebase is the single greatest tool
git provides. It is extraordinarily powerful, and learning and becoming
comfortable with this tool will actually change your life. Check out the
[chapter in the Git book][rewriting history] for more info.

What we'll do is create our commits on our machine-specific branch as before,
then use interactive rebase to move them to the "bottom" of the
machine-specific branch, then update the `master` pointer to point to the last
of those commits. This will make more sense in picture form.

Before making any changes:

    [ C1 ] <- machine
       |
    [ C2 ]
       |
    [ C3 ]
       |
    [ C4 ] <- master

Now, while still on the machine-specific branch, we create the commits that we
want to put on `master` (represented as commits `M1` and `M2` in the diagram
below):

    [ M1 ] <- machine
       |
    [ M2 ]
       |
    [ C1 ]
       |
    [ C2 ]
       |
    [ C3 ]
       |
    [ C4 ] <- master

Now we run

```console
$ git rebase -i master
```

which brings up the following in your editor:

    pick C3 Commit message for C3
    pick C2 Commit message for C2
    pick C1 Commit message for C1
    pick M2 Update file1 and file2
    pick M1 Update file3

We modify this in our editor to move the last two lines (commits `M1` and `M2`)
to the top of the stack, and then add an `exec` line to update the `master`
branch:

    pick M2 Update file1 and file2
    pick M1 Update file3
    exec git branch -f master
    pick C3 Commit message for C3
    pick C2 Commit message for C2
    pick C1 Commit message for C1

Save and close the editor, and done!  Now the commits are on master and we
never had to change our current branch.

The files in the work tree *are* still modified during the rebase, however. I
haven't yet figured out a way around this, but if I do I will update this post.

We can of course also push `master` up to the remote:

```console
$ git push origin master:master
```

And we can also update `master` with any changes that were pushed from another
machine:

```console
$ git fetch origin master:master
$ git rebase master
```

This describes my workflow with how I manage my dotfiles. If you're not used
to using rebase, it might seem a little daunting at first. But I assure you
that once you get used to it it takes no time at all and becomes just another
git operation.

[dotfiles with symlinks]: https://git.gpanders.com/gpanders/dotfiles/src/commit/2da1dde5ea566f82ebe6532bc6d3b8670fd77ce8
[write up]: https://www.atlassian.com/git/tutorials/dotfiles
[rewriting history]: https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History
