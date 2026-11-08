---
title: Make Your Mac Clean Itself
date: 2015-11-11
tags: [macOS, pushbroom]
---

**Update (6/18/2019):** Since writing this post I have released a tool called
[pushbroom][1] that should make all of this
easier and a bit more robust.

<!--more-->

The original solution in the post below is, frankly, a rather unsophisticated
way of solving this problem. If you don't want to use [pushbroom][1],
[Thoughtbot][2] has another solution that utilizes Apple's launchd utility.

[1]: https://codeberg.org/gpanders/pushbroom
[2]: https://thoughtbot.com/blog/example-writing-a-launch-agent-for-apples-launchd

---

If you use the Internet ever, then you've probably downloaded a thing or two.
Those downloaded files really start to add up over time, and unless you're some
kind of Internet hoarder, you probably don't have any reason to hold on to
them.

Go ahead and open Finder and look in your Downloads folder. Is it crazy full?
That's bad. File systems are like bedrooms - they're much better when cleaned
up and organized.

If you're on Windows there's a great program called
[Belvedere](https://lifehacker.com/belvedere-automates-your-self-cleaning-pc-341950)
that takes care of this problem for you. But if you're on a Mac, you'll most
likely have to pay money for a similar program, and that's just no good.
Instead, follow the quick and easy tutorial below to have your Mac
automatically delete any file or folder that has been in your Downloads folder
for more than 30 days.

First, open the **TextEdit** app and create a new file. Click `Format` > `Make
Plain Text`.

![TextEdit](/media/text-edit-make-plain-text.png)

Now copy the following to that file.

    0  */6  *  *  * find $HOME/Downloads -mtime +30 -depth 1 -exec rm -rfv "{}" >> $HOME/Logs/clean_downloads_$(date +"\%Y\%m\%d").log \;

I know that command looks intimidating, but it's actually pretty straight
forward.  This file is what's called a "crontab", which is short for
"chronological table", an old name given to a program that runs at a certain
time (chronologically).  The first five numbers/stars tell the program when to
run, and that last long command (`find $HOME/Downloads ...`) tells the program
what to do. In this case, we want the program to run at the 0th minute (`0`)
every six hours (`*/6`) on every day, month, and day of the week (`* * *`). The
command says to `find` every file in our Downloads folder that is older than 30
days, delete it, and then write the name of the deleted file to a new file
called `clean_downloads_<date>.log`, so we know what's actually been deleted.

Save the file in your home folder and call it `.crontab` (**with** the period at
the beginning!) and make sure you **uncheck** the box that says `If no extension
is provided, use ".txt"`.

Once the file is saved, open the **Terminal** app (it's the one that looks like
a little computer screen) and enter the following:

    mkdir -p ~/Logs
    crontab ~/.crontab

And that's it! Now, every six hours your computer will scan your downloads
folder to find anything older than 30 days and delete it. So make sure you move
anything important out of your Downloads folder and somewhere more appropriate!

Every time a file is deleted it is tracked in a log file called
`clean_downloads_<date>.log` inside a folder called `Logs` in your home
directory. They're named depending on when they were run: for example, to see
what was deleted on November 10, 2015, you would want to look at the file called
`clean_downloads_20151110.log`, etc.

