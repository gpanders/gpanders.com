---
title: Gandi CLI
license: MIT
summary: Command line interface to the Gandi API
src: https://git.sr.ht/~gpanders/gandi-cli
---

Command line interface to the [Gandi API][].

[Gandi API]: https://docs.gandi.net/en/domain_names/advanced_users/api.html

Configuration
-------------

Create a file at `$XDG_CONFIG_HOME/gandi/config` with the following format
(`$XDG_CONFIG_HOME` is set to `$HOME/.config` by default):

```ini
[gandi]
api_key = <your Gandi API key>
domain = <your Gandi domain>
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

Contributing
------------

Please feel free to contribute changes or bug fixes! You can [send patches][]
to <git@gpanders.com> or submit a pull request on [GitHub][].

[send patches]: https://git-send-email.io/
[Github]: https://github.com/gpanders/gandi-cli
