#!/usr/bin/env bash

set -e

printf "\033[0;32mDeploying updates to GitHub...\033[0m\n"

# Purge everything before rebuilding
rm -rf public/*

# Build the project
hugo

msg="Rebuilding site $(date)"
if [ -n "$*" ]; then
	msg="$*"
fi

cd public
git add .
git add -f tags  # tags is listed in .gitignore (for ctags) so use -f
git commit -m "$msg"
git push origin master
