---
title: "The Zettelkasten"
date: 2020-05-25T15:43:50-06:00
---

I have always been a bit of a nerd about note taking and knowledge management
systems. I read David Allen's [Getting Things Done][] with relish, and I've
obsessively experimented with every iteration of note taking apps and tools
mankind has created. Trello, Todolist, Evernote, Bullet Journal, you name it.

I think my obsession in this area is mostly driven by the combination of my
love of useless trivia and my immense capacity for forgetfulness, a perfect
recipe if ever there was one for developing the habit of writing things down.

Of course, being an obsessive optimizer means that I can't just settle for
*any* solution; I have to find the **BEST** solution. The result is that I've
drifted from app to app, from method to method, ever searching for the
metaphorical glass slipper that perfectly fits my needs.

Not long ago, while reading a [blog post by another information management
nerd][appdemic], I stumbled upon something called a "Zettelkasten". At first, I
was put off: I felt there was already enough diversity in the note taking
ecosystem without delving into *other languages*. Once I'd gone down that
rabbit hole, who knows where it would end up?

However, my curiosity was piqued, and I dipped my toe in the water. I have
since become hooked, and I now use a Zettelkasten as my primary note taking and
knowledge management method. In the rest of this article, I'll explain exactly
what a Zettelkasten is and why it meets my needs.

An important disclosure is necessary before we continue: if I've learned
anything in my quest to find the perfect knowledge management system, it's in
that there is no one-size-fits-all approach. The reason there are 7 billion
different note taking apps and methods is because there are 7 billion different
people on Earth. One of the reasons I like the method I'm about to outline
below is precisely because it's flexible and moldable to my own needs, but just
because it works for me doesn't mean it'll work for you.

[Getting Things Done]: https://www.amazon.com/Getting-Things-Done-Stress-Free-Productivity/dp/0143126563
[appdemic]: https://appademic.tech/zettelkasten-thoughtful-plain-text-note-taking/#fn3

### What is a Zettelkasten?

Quoting from the [blog post above][appdemic] (emphasis mine):

> [A] precise definition of Zettelkasten is likely to be
> counterproductive. Short of saying it is a loosely defined method of
> constructing an archive of notes. An archive built upon layers of nodes and
> connections. If you want to know more, however, Christian and Sascha have a
> growing archive of their own at the Zettelkasten blog. **In case you don’t
> already know how philosophical note taking can be, you have been warned.**

[Zettelkasten.de][] is the canonical home of everything Zettelkasten-related.
It's written and maintained by two guys (the aforementioned Christian and
Sascha) who are passionate about efficient note taking processes (did you ever
imagine that such people existed?  Alas, I am apparently one of them). Put
simply, a Zettelkasten is like an external brain, a flattened structure of
information that connects to itself like a web, linking together all of the
information it contains in ways that might not be apparent at first, creating
insights for synthesizing new knowledge.

In German *Zettel* means "note" and a *Kästen* is a box: a
*Zettelkästen* is literally translated as "note box". Its inventor, Niklas
Luhmann, literally kept a box of index card-style notes. Each note had a unique
identifier that could be referenced by other notes, creating an interconnected
web of knowledge. Modern Zettelkastens can of course still be created this way,
but most people find it easier and more efficient to use digital versions.

One of the defining characteristics of a Zettelkasten over other forms of
knowledge management is its use of unique identifiers. In a Zettelkasten, each
Zettel has a unique ID that other Zettels can refer to. Links are created
between Zettels by placing IDs within notes, and when one note references
another note's ID, that note can itself be updated with a link to the linking
note, creating a backlink.

Over time, a Zettelkasten grows in an organic fashion to truly become an
external brain. As you enter more and more information into your Zettelkasten,
you will find that links develop between notes that you may not have ever have
anticipated. These connections can then help you synthesize new information or
succinctly put together complex ideas in a simple way.

Another defining characteristic of the Zettelkasten is its [eschewing of
hierarchy and categories][no-categories]. Instead, Zettels are tagged. This
might seem like a minor distinction, but it pays off in one important way: it
eliminates any friction when creating a new note caused by asking oneself to
which predefined category that note ought to belong. Instead, the new Zettel is
simply created in a flat structure and any tags that seem appropriate to the
content can be entered. Then, when you want to query your Zettelkasten for
anything you've written about bumblebees you simply search for notes tagged
with "bumblebee" or that contain the phrase "bumblebee".

Another appealing feature of the Zettelkasten is that it can (and should!) work
perfectly well in plain text. In fact, the folks over at [Zettelkasten.de][]
insist on this, and I agree. Anything that you want to last needs to be in
plain text: proprietary or application-specific formats are no good and
interfere with your knowledge's ability to be fluid and flexible. If you put
everything in Evernote, you're stuck in Evernote unless you want to go through
the arduous process of exporting your data into a format that will almost
certainly come out funky or malformed.

The [Zettelkasten.de][] guys use [MultiMarkdown][] as their plain text format
of choice, but I just use Pandoc's Markdown syntax. Not that it really matters,
since the whole point of using plain text is that it's perfectly readable as
plain text. Write them in any format you want, as long as it's consistent and
easy to search.

All of these attributes mean that creating and managing a Zettelkasten is low
friction, low maintenance, and highly portable. Individual Zettels are meant to
be (generally speaking) small and atomic. You don't need to worry about if the
note is in the right place, or what's written in it. Just write it! If you
think of something else, modify the existing note if it's relevant or just
create a new note and link back to the original. In this way, the Zettelkasten
grows organically over time along with its creator.

The aforementioned traits also mean that implementing your own Zettelkasten
tool is quite trivial. I did this myself with [wk][] (which I'll write about
soon), but you can also use something like [The Archive][] or [nvALT][].

[Zettelkasten.de]: https://zettelkasten.de/
[MultiMarkdown]: https://fletcherpenney.net/multimarkdown/
[wk]: https://sr.ht/~gpanders/wk/
[The Archive]: https://zettelkasten.de/the-archive/
[no-categories]: https://zettelkasten.de/posts/no-categories/
[nvALT]: https://brettterpstra.com/projects/nvalt/

### Examples

Ok, you're a visual learner. I get it, I am too. Here's an example of what one
of my own Zettels looks like:

```markdown
---
title: Alexander von Humboldt
date:  December 13, 2019
tags:  romanticism, nature, science, ecology
...

Alexander von Humboldt was among the first in the post-Enlightenment modern era
to think of nature as something to be enjoyed, commune with, and treasure
instead of simply to exploit and command. One of the last polymaths of the
Enlightenment, he re-imagined science's relationship with nature, insisting
that nature was not simply mechanistic but rather highly complex and
interwoven. His discipline would later come to be known as ecology
[[20191213143234]].

### Influenced

- George Perkins Marsh [[20191213092520]]
- Ernst Haeckel [[20191213151234]]
- John Muir
- Charles Darwin
- Goethe

### Backlinks

- [[20191213092520]]
- [[20191213151234]]
```

Let's go over the structure here.

At the top of the note is the metadata section. This is an extension of
Pandoc's Markdown format. It specifies a title, date, and tags. It's fairly
self-explanatory.

After the metadata is the note body itself. Note the use of the
`[[20191213143234]]` style links. These are references to other notes. Also
take note of the `## Backlinks` section at the bottom: this is a list of other
notes that link to this note in turn.

That's it. In other notes, I might also have a citation section where I include
citations of things I reference in the note itself. I use [Zotero][] to manage
references and citations, and copying a citation from Zotero into a new note is
a simple copy-paste operation.

I interact with notes in my Zettelkasten with the aforementioned [wk][] tool.
Like I mentioned, I'll write about this in more detail later, but briefly, it's
a command line tool with commands like "open", "new", and "search". For
example, if I just finished reading an interesting blog post about the history
of bear migration in North America, I would simply type the following in my
terminal:

    wk new 'Bear migration in North America'

This would open a newly created note prepopulated with the relevant metadata in
my editor (Vim) and allow me to quickly start writing. In the `tags:` field, I
might put `bears` or `migration`. When I'm done, I just save and close the note
and go about my day. The whole process is very fast and very low friction.

[Zotero]: https://www.zotero.org/

### Conclusion

I have been growing my own Zettelkasten for about 6 months now and have,
amazingly, been able to get the process to stick, which is more than I can say
for most other processes I've tried.

It's worth repeating my disclosure at the beginning of this post: the system
I've outlined above works well **for me**. It might seem byzantine, awkward, or
bizarre to you, and that's okay. **The perfect note taking system is the one
that will actually get you to write notes and use the notes you've written
down.** In that sense, the Zettelkasten method is, for me, a huge success.
