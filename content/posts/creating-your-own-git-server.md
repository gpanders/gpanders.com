---
title: "Creating Your Own Git Server"
date: 2020-03-17
draft: true
---

Outline:

* Why?
    - Manage your own data
    - Private repos are truly private
    - "Marketing" purposes (shows people you know at least enough to manage a git
      server)
    - It's fun

* Tools
    - Gitolite
    - git-daemon
    - gitweb and git-http-backend

* Gitolite
    - SSH authentication, easy to set up and configure, configuration managed
      in version control, hooks, triggers, etc.
    - Integrates with git-daemon and gitweb

* git-daemon
    - Allows git:// read access
    - Easiest to set up

* gitweb and HTTP
    - Apache configuration
    - Custom CSS styles
    - Screenshots

