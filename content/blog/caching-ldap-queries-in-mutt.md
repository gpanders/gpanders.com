---
title: "Caching LDAP Queries in Mutt"
date: 2020-03-11
tags: [mutt, ldap]
---

You can use the [`lbdb`](https://www.spinnaker.de/lbdb/) tool to query an LDAP
server within Mutt using the `query_command` setting. Setting up `lbdb` is out
of scope for this article, although you can find plenty of documentation and
examples online ([here][1] and [here][2], for instance). One drawback to this
approach, however, is that everytime you want to look up a recipient in Mutt
you have to query your LDAP server, which can be quite slow.

A workaround to this problem is to "cache" the results of prior LDAP queries
into a Mutt aliases file. That way you only have to query `lbdb` once, and
future recipients can be found in the aliases file, which is significantly
faster.

The following script does exactly this:

```bash
#!/bin/bash
# Query lbdbq and save results to Mutt alias file

set -e

# Mutt aliases file to save results to
ALIASES="$HOME/.cache/mutt/aliases"

# Only save email addresses from $DOMAIN. Leave empty to save all email addresses
DOMAIN="example.com"

query_and_cache() {
    results=$(lbdbq "$@" 2>/dev/null)

    printf '%s\n' "$results"

    # Remove first line from results
    results=$(sed '1d' <<< "$results")

    # Format results like mutt aliases
    sed -E $'s/^([[:alnum:]_.]+)@([[:alnum:]_.]+)\t([[:alnum:] -]+)/alias \\1 \\1@\\2 (\\3)/' <<< "$results" | awk -v domain="$DOMAIN" '$3 ~ domain {$2=tolower($2);print}' >> "$ALIASES"

    # Sort and remove duplicates
    sort -u -o "$ALIASES" "$ALIASES"

}
query_and_cache "$@"
```

The script queries your LDAP server using `lbdbq` and returns those "raw"
results to Mutt so that you can make your selection. However, it also reformats
the output and saves it to an aliases file for Mutt to use later.

Save this script to `~/.lbdb/query.sh`, make it executable, and
use it in Mutt's `query_command` setting:

    set query_command = "~/.lbdb/query.sh '%s'"

Now, everytime you make a query in Mutt the results will be saved to
`$HOME/.cache/mutt/aliases`. Obviously, you need to tell Mutt to read from this
alias file as well:

    set alias_file = ~/.cache/mutt/aliases
    source $alias_file

One caveat to this is that Mutt only reads the alias file on startup, so any
changes to that file will not be detected unless you manually run `:source
$alias_file` or restart Mutt.

[Mutt]: http://www.mutt.org/
[1]: https://annvix.com/using_openldap_as_an_address_book
[2]: https://bradomyn.wordpress.com/2016/01/07/muttldap/
