#!/bin/sh

set -e

if [ ! -d public ]; then
	git clone -q git@github.com:gpanders/gpanders.github.io public
fi

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
git commit -m "$msg"
git push origin master
