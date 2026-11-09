---
title: "Exploring Mach-O, Part 4"
date: 2022-01-16T19:13:53-07:00
tags: [mach-o, macos, zig]
---

*This is part 4 of a 4 part series exploring the structure of the Mach-O file
format. Here are links to [part 1](/blog/exploring-mach-o-part-1/), [part 2](/blog/exploring-mach-o-part-2/), and [part 3](/blog/exploring-mach-o-part-3/).*

When we started this series we didn't know anything about Mach-O other than
some vague idea that it's a binary file format used by macOS. By now, we have a
much better understanding of how Mach-O is laid out and how the operating
system uses the information in a Mach-O file to run a program.

We learned that every Mach-O file has a 32 byte header right at the beginning.
The first 4 bytes of the header (and thus, the first 4 bytes of every Mach-O)
file are a **magic number** that indicates that the file is, in fact, encoded
using Mach-O. Much to our delight, we found that this magic number is
`0xfeedface` on 32-bit systems, and `0xfeedfacf` on 64-bit systems.

This header tells us a lot more about our file too, including the type of CPU
it is compiled for and the size of the load commands that come directly after
it.

After the header come a sequence of **load commands**. Every load command
shares two fields in common: the command type (which we encoded as a `Command`
enum in Zig) and the total size in bytes of the command. Each command is parsed
slightly differently, and some commands (such as the `segment_command`s) have
more data structures that come directly after them.

There are a lot of different load commands that a Mach-O file can contain: our
`Command` enum has 54 different values. Not every Mach-O file contains all of
these commands, of course. We primarily investigated the `Segment` commands,
which are an important concept for understanding how a Mach-O file is laid out.
Each segment can have zero or more sections, and in our tiny `exit` program we
found 3 segments: `__PAGEZERO`, `__TEXT`, and `__LINKEDIT`. More complex
programs will have more segments, notably a `__DATA` segment, which our program
lacks.

Immediately following the load commands are the **segments**. We found that our
file contains a large block of contiguous zeros, and we discovered that this is
because the header and load commands share the first segment with the `__TEXT`
segment. The sections within the `__TEXT` segment are aligned to the end of the
segment, and because segments must be page aligned, there can often be large
chunks of unused space between the end of the load commands and the start of
the first section in the `__TEXT` segment. This problem is "worse" on systems
with larger page sizes, such as ARM64 (which uses a 16 KiB page size rather
than the standard 4 KiB pages on x86).

We learned how to use Zig to parse binary file formats, such as using `packed
structs` to represent bit fields and validating enum values using the
`std.meta.intToEnum` standard library function. We also explored some cool
parts of Zig's comptime features to make an elegant and easy-to-use API for our
parser.

## But wait, there's more

If you followed along then you know there is *a lot* we didn't cover. There are
still a lot of load commands we didn't even talk about, and who knows what kind
of goodies those involve.

We also didn't talk about universal binaries. Apple has transitioned between
ISAs twice: first from PowerPC to Intel x86, and then again to ARM. Because of
this, they figured out a long time ago how to combine two or more binary
formats into a single file. Apple refers to this as a "universal binary", which
is a packaged archive of multiple Mach-O files. Universal binaries have their
own format, including their own header and magic number (spoiler alert: the
universal binary magic number is `0xcafebabe`. Is that even better than
`0xfeedface`?).

The point is, there are many rabbit holes for you to follow if you're
interested. I hope you do, and if you do, I hope you write about!

Thanks for reading!
