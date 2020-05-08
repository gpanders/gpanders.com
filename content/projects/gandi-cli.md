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

Create a file at `$XDG_CONFIG_HOME/gandi/config` with the following format
(`$XDG_CONFIG_HOME` is set to `$HOME/.config` by default):

```ini
[gandi]
api_key = <your Gandi API key>

; Optional: can be given on command line if not in config file
domain = <your Gandi domain>

; Optional: can be given on command line if not in config file
mailbox_id = <your Gandi mailbox ID>
```

Usage
-----

    gandi SUBCOMMAND OPTIONS

### Subcommands

**alias**: Manage email aliases

List existing email aliases

    gandi alias --list

Add a new email alias

    gandi alias --add ALIAS

Remove an existing alias

    gandi alias --remove ALIAS

**mbox**: Manage email mailboxes

List mailboxes

    gandi mbox --list
