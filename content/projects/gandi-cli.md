---
title: Gandi CLI
license: MIT
summary: Command line interface to the Gandi API
src: https://git.sr.ht/~gpanders/gandi-cli
---

Command line interface to the [Gandi API][].

[Gandi API]: https://docs.gandi.net/en/domain_names/advanced_users/api.html

Installation
------------

### pip

Install using pip:

    pip3 install --user gandi

### pipx

Install using [pipx](https://pipxproject.github.io/pipx/):

    pipx install gandi

Configuration
-------------

Run `gandi setup` to create a configuration file at
`$XDG_CONFIG_HOME/gandi/config`. This will ask for your Gandi API key as well
as an (optional) default domain name and an (optional) default mailbox ID.

If you specify a domain name and mailbox ID, subcommands that require these
parameters will use the values supplied in your config file instead of
requiring them as commandline flags.

Parameters can also be specified using environment variables, e.g.:

    GANDI_API_KEY=... gandi mbox -d DOMAIN --list

Usage
-----

    gandi SUBCOMMAND OPTIONS

### Subcommands

**setup**: Setup the Gandi CLI config file

    gandi setup

**alias**: Manage email aliases

    gandi alias [-d DOMAIN] [-m MAILBOXID] (--list | --add ALIAS | --remove ALIAS)

List existing email aliases:

    gandi alias -l

Add a new alias:

    gandi alias -a ALIAS

Remove an alias:

    gandi alias -r ALIAS

**mbox**: Manage email mailboxes

    gandi alias [-d DOMAIN] --list
