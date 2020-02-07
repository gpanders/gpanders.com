---
title: Archive the Internet
date: 2020-02-07
---

As the Internet continues to grow and age, we are seeing more and more of a
phenomenon called "link rot". Link rot is the all-too-familiar experience of
returning to a bookmark or link only to find that it's no longer maintained,
been taken down, or even changed to something else. What can we do about this?

<!--more-->

Sites like [archive.org] were created to combat this exact problem. That site
exists for the sole purpose of maintaining snapshots of the Internet
over time so that you can always find old copies of a web page from years back.

The problem, of course, is that you never know if the site you actually need
will be archived because they only archive sites that are explicitly submitted
by users. For popular sites, this won't be a problem. But what about an obscure
blog post or research article you read 4 years ago that you now want to
reference? If you didn't remember to archive it at the time, you're out of
luck.

Other sites like [Pinboard] offer an automatic archiving feature for all of
your bookmarks. Pinboard is a great, well-run, and honest service that I use
and recommend. For a fee, Pinboard will regularly download a copy of your
bookmarks to save them from link rot.

The solution to this problem is actually quite easy, technically speaking. I've
been itching for a new project, so I thought this would be a good problem to
tackle.

The system I wanted to create has basically 3 components: input, retrieval, and
presentation. The input component relates to how I specify _which_ web pages I
want to archive. Retrieval involves actually downloading those pages in such a
manner that they can be accurately duplicated. Presentation deals with viewing
the archive when needed.

All three of these components need to work with a common data source.  In the
interest of simplicity and to avoid reinventing the wheel, the obvious choice
is to use some kind of plain-text format to represent which web pages I want to
archive. This ensures that I can leverage standard UNIX command line utilities
such as `wget` and `awk`.

I first considered GNU's [recutils], a plain-text database format that supports
inserting and selecting records into "recfiles". The format is brain dead
simple and easy to understand, and since I'm not going to be carrying around
millions of entries (like SQL databases are made for), the performance factor
is not really a concern for me.

The only drawback to recutils is support, or lack thereof. The presentation
component of this system will need to involve a webserver of some kind and
recfiles are not a natively supported database format in any language I am
aware of. Integrating recfile support into a webserver would involve either
parsing the files using regular expressions (hacky and non-portable) or writing
a recfile driver myself (a lot of work and I'm lazy). Instead, I decided to use
a tab-delimited CSV file.

My tab-delimited CSV database has a very simple format: it's a single file
where each line in the file has two fields separated by a tab character. The
first field is the web page title or description, and the second field is the
URL. For example

    Personal website of Greg Anders	https://gpanders.com
                                   ^ literal tab character (\t)

Why a tab? Traditionally, CSV files use commas to separate field values (hence
the C in CSV); however, page titles and descriptions can contain basically any
printable character imaginable, including commas, semicolons, pipes, and
slashes. But they don't contain raw tab characters, so there will never be any
ambiguity. This format is easy to read, easy to manually update (if I want),
works perfectly with traditional UNIX tools, and is widely supported (many
languages come with native CSV support with no 3rd party dependencies).

To populate the database, I import my bookmarks from Pinboard and convert
them into the tab-delimited CSV format:

    $ curl -s "https://api.pinboard.in/v1/posts/all?auth_token=$PINBOARD_API_KEY&format=json" | jq -r '.[] | "\(.description)\t\(.href)"' > links.csv

Then, I use `awk` to parse the URLs from the CSV file and `wget` to download
the web pages:

    $ awk -F'\t' '{print $2}' links.csv | while read -r url; do
    >   wget -ENHkpc --wait=1 --random-wait --user-agent="" -e robots=off "$url"
    > done

To build the `wget` command I referred to a few [different][wget1]
[examples][wget2] across the web. The flags given will download all of the
resources on the given page and adjust their paths accordingly so that the web
page can be viewed offline. The `--wait` and `--random-wait` flags tell `wget`
to wait between `0.5` and `1.5` seconds between each download request which
reduces the load on the servers a bit.

For the presentation component, I wrote an ultra-simple Go web server that
simply serves up the web archive and provides a dynamic index of archived pages
from the database. The entire program is fewer than 100 lines and you can find
it [here][garchive].

By setting up a cron job on my Raspberry Pi, I can now completely automate the
creation and maintenance of an offline web archive (using [Borg] for regular
backups!). Bookmarks are automatically imported from Pinboard into a CSV file
which is read by standard UNIX tools `awk` and `wget` to download a web
archive, which is viewable at any time from a
[webserver](https://archive.gpanders.com).

This solution is extremely stable as it uses technologies and tools that have
been around for decades. By leveraging the UNIX philosophy of using simple,
composable tools with flexible interfaces, the system is highly modular and
configurable (I can easily modify or replace the web interface without having
to do anything to the other components, and vice versa). And since I'm backing
up the whole archive to Borg, I can maintain a weekly snapshot of all of my
bookmarks in perpetuity at the cost of very little storage space.

This whole thing took me a little over 6 hours to create. Most of that time was
spent deciding on a database format and building the Go webserver (like I said,
it's extremely simple but I am also a total Go newbie, so it was a great
learning experience). Future improvements involve tweaking up the web interface
to make it a bit more aesthetically appealing and adding some functional
improvements such as a search feature.

[archive.org]: https://archive.org
[Pinboard]: https://pinboard.in
[recutils]: https://www.gnu.org/software/recutils/
[wget1]: https://archiveteam.org/index.php?title=Wget
[wget2]: https://www.dheinemann.com/2011/archiving-with-wget/
[garchive]: https://github.com/gpanders/garchive
[Borg]: https://www.borgbackup.org/
