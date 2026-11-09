---
title: Git Plumbing
date: 2020-03-02
tags:
  - git
---

### Porcelain and Plumbing


### git commit

**Plain English**: Create a new tree object from the current index and create a
new commit object from that tree. The commit object combines a commit message,
parent, date, author, committer, and the tree. Update the ref pointed to by
HEAD with the hash of the new commit object.

#### Plumbing

Once files are in the index (using `git add` or `git update-index`) use `git
write-tree` to create a new tree object:

<!--
<!-- target: write-tree
```sh
echo '$ git write-tree'
git write-tree
```
-->

<!-- name: write-tree -->
```
$ git write-tree
8c3c7fbcd903744b20fd7567a1fcefa99133b5bc
```

Before creating the commit object, a commit message must be created. Usually,
this is done by invoking the default editor. The file the editor opens is
called `COMMIT_EDITMSG` in the `.git` directory and is pre-populated with the
output of `git diff-index --patch HEAD`:

<!--
<!-- target: prepare-commit
```sh
echo '$ echo "\\n# ------------------------" ">8 ------------------------" > .git/COMMIT_EDITMSG'
echo '$ git diff-index --patch HEAD >> .git/COMMIT_EDITMSG'
echo '$ ${GIT_EDITOR:-${EDITOR:-vi}} .git/COMMIT_EDITMSG'
echo '\n# ------------------------' '>8 ------------------------' > .git/COMMIT_EDITMSG
git diff-index --patch HEAD >> .git/COMMIT_EDITMSG
```
-->

<!-- name: prepare-commit -->
```
$ echo "\n# ------------------------ >8 ------------------------" > .git/COMMIT_EDITMSG
$ git diff-index --patch HEAD >> .git/COMMIT_EDITMSG
$ ${GIT_EDITOR:-${EDITOR:-vi}} .git/COMMIT_EDITMSG
```

The first line above is called a "scissor line" (the `>8` looks like a pair of
scissors). That line and everything below it is automatically deleted by `git
commit`, but when using plumbing commands we must do it manually:

```sh
$ tmp=$(mktemp)
$ sed -n '/>8/q;p' .git/COMMIT_EDITMSG > "$tmp"
$ mv "$tmp" .git/COMMIT_EDITMSG
```

Finally, we can create the commit object.

<!--
<!-- target: commit-tree
```sh
echo '$ git commit-tree -p "$(git rev-parse HEAD)" -F .git/COMMIT_EDITMSG "$(git write-tree)" > .git/"$(git rev-parse --symbolic-full-name HEAD)"'
git commit-tree -p "$(git rev-parse HEAD)" -F .git/COMMIT_EDITMSG "$(git write-tree)" > .git/"$(git rev-parse --symbolic-full-name HEAD)"
```
-->

<!-- name: commit-tree -->
```
$ tree="$(git write-tree)"
$ commit="$(git commit-tree -p HEAD -F .git/COMMIT_EDITMSG "$tree")"
$ git update-ref HEAD "$commit"
```
