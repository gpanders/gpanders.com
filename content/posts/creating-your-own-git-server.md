---
title: "Creating Your Own Git Server"
date: 2020-03-18
---

I recently set up my own git server at [git.gpanders.com][]. If you've ever
considered doing something similar yourself, or if you're just curious as to
what's involved, this post will outline the high-level steps.

<!--more-->

First off, why might you want to use your own server? After all, there are a
wide array of free to use choices out there, such as Github, Gitlab, and the
up-and-coming [sourcehut][].

I can think of a few reasons, chief of all being that when you host your own
server, you truly own your own data. In today's world of corporate
surveillance, rampant privacy violations, and data breaches, there is something
to be said of true ownership. Your code and your files live on
_your_ server. This also means that "private" repos truly are private.

It can also serve as a form of self-promotion, for lack of a better
term. It shows potential employers, collaborators, customers, or clients that
you at least know enough to set up and manage your own server.

And finally, it's just fun, at least if you're into that sort of thing. It's
something _you_ control. You get to decide how it works, how it looks, who
can access it, and what exists on it.

Setting up a git server is actually relatively straight-forward. Almost all of
the heavy lifting is done by git itself, but a few supplementary tools are
required to handle things like access control and HTTP access.

[git.gpanders.com]: https://git.gpanders.com
[sourcehut]: https://sr.ht

## Preparing your server

You can run your git server on something as simple as a Raspberry Pi or a
Digital Ocean droplet. It's not very demanding, so you don't need much
horsepower.

First, create a `git` user on your server. This user's home directory will act
as the base location for all of your repositories. I chose `/var/lib/git` as
the home directory, but `/home/git` or `/srv/git` are other common choices.

    # useradd -r -d /var/lib/git git
    # passwd git

## Gitolite

Next, install the excellent [gitolite][] tool. Gitolite makes managing your
server much easier and allows you to do things like user management, access
control, triggers, hooks, and more. Copy your SSH **public** key into your git
user's home directory (and make sure it's readable by the git user) and then 
clone gitolite into the git user's home directory:

    $ sudo cp ~/.ssh/id_rsa.pub /var/lib/git/greg.pub
    $ sudo chown git: /var/lib/git/greg.pub
    $ su - git
    $ mkdir -p ~/bin
    $ git clone https://github.com/sitaramc/gitolite
    $ gitolite/install -ln ~/bin
    $ gitolite setup -pk greg.pub

Now from your home computer (i.e. not your server), test your gitolite
installation:

    $ git ls-remote git@server:gitolite-admin

You should get something like:

    9dd8aab60bac5e54ccf887a87b4f3d35c96b05e4    HEAD
    9dd8aab60bac5e54ccf887a87b4f3d35c96b05e4    refs/heads/master

You can easily add new users by having them send you their public keys.
Gitolite also interfaces quite nicely with `git-daemon` and `gitweb`. Be sure
to check out the thorough documentation on [Gitolite's website][gitolite].

[gitolite]: https://gitolite.com/gitolite/index.html

## git-daemon

Git includes a `daemon` subcommand that will listen for incoming connections
and serve data over the `git://` protocol. This allows you to clone repos from
your server using

    $ git clone git://yourserver/repo.git

The `git://` protocl is the fastest and simplest option for read-only access,
and it's trivial to set up. Assuming your `git` user's home directory is
`/var/lib/git`, simply create the following `systemd` service file (e.g. at
`/etc/systemd/system/git-daemon.service`):

```systemd
[Unit]
Description=Start Git Daemon

[Service]
ExecStart=/usr/bin/git daemon --reuseaddr --base-path=/var/lib/git/repositories /var/lib/git/repositories
Restart=always
RestartSec=500ms
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=git-daemon
User=git
Group=git

[Install]
WantedBy=multi-user.target
```

Then simply run `systemctl enable --now git-daemon`. Make sure port 9418 is
open on your firewall.

If you don't use systemd, you can probably find alternative init scripts for
your particular init system in your package manager. Debian, for example, has
`git-daemon-sysvinit` and `git-daemon-run` if you use SysV or runit,
respectively.

The git daemon only serves repositories that have a file called
`git-daemon-export-ok` in their directory root. This allows you to control
which repositories you want to be publicly accessible. Gitolite will
[automatically create this file for you][gitweb-daemon] for any repos that are
readable by the special `daemon` user.

[gitweb-daemon]: https://gitolite.com/gitolite/gitweb-daemon.html

## Gitweb and HTTP

The most difficult part of setting up a git server is the web frontend
and HTTP access. The git documentation has a section on [Smart HTTP][] which
is a good starting point, but it still took me quite a while to get everything
working in Apache. Part of the reason I had some difficulty was because I
insisted on running the webserver in a Docker container (so that I can version
control the configuration). It took me a while to get working, but the ultimate
solution ended up being pretty simple.

By default, your `git` installation includes the `git-http-backend` script
which allows you to clone over HTTP. If you also want to host a web frontend,
then you have to create some rules for your webserver so that it knows when to
direct traffic to the web page and when to direct it to the `git-http-backend`
script.

Here is an example Apache configuration file:

```apache
ServerName yourserver.com

DocumentRoot /usr/share/gitweb
<Directory "/usr/share/gitweb">
    DirectoryIndex gitweb.cgi
    Options ExecCGI FollowSymLinks SymLinksIfOwnerMatch
    AddHandler cgi-script cgi
    Require all granted
    SetEnv GITWEB_CONFIG /etc/gitweb.conf
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} !^/([^/]+/(HEAD|info|objects|git-(upload|receive)-pack).*)$
    RewriteRule ^.* /gitweb.cgi/$0?js=1 [L,QSA,PT]
</Directory>

ScriptAliasMatch \
    "(?x)^/([^./]+)(\.git)?/(HEAD | \
                info/refs | \
                objects/info/[^/]+ | \
                git-(upload|receive)-pack)$" \
    /usr/libexec/git-core/git-http-backend/$1/$3

<Files "git-http-backend">
    SetEnv GIT_PROJECT_ROOT /var/lib/git/repositories
    Require all granted
</Files>
```

The above configuration allows repos to be cloned with or without the `.git`
extension, but since Gitolite creates all repositories with the `.git`
suffix you'll have to create non-suffixed symlinks to those directories.

Create and modify the [`/etc/gitweb.conf`][gitweb.conf] file to configure
Gitweb.

In my case, I run Apache behind a reverse proxy that handles all of the TLS
encryption, so the configuration above doesn't deal with any of that. Setting
up TLS for a webserver is out of scope for this guide and if that's
not something you care to do, you can always omit the HTTPS portion of your
server and simply serve via `git://` and SSH. Like I said, this part is the
most complex and will likely take more time than the other steps. The above
snippet should be a good starting point.

Unfortunately, even after getting the web server configured, I had another
problem. The default Gitweb web page is a bit... utilitarian, to phrase it
mildly. 

![Default Gitweb home page](/img/gitweb-1.png)

![Default Gitweb project page](/img/gitweb-2.png)

Gitweb uses a Perl CGI script to generate the HTML, which means unless you want
to manually modify that script your basically stuck with the HTML that Gitweb
gives you.

Fortunately, CSS is super powerful these days and you can do _a lot_ with it.
For me, styling the web frontend was the most fun part. I haven't done any
front-end work in a few years now so it was nice to dip my toes back into the
water. New CSS tricks like `flex` and `grid` are really cool and very
powerful.

With only 6.25 KB of CSS I was able to transform the drab, default Gitweb
interface into what you see today at [git.gpanders.com][]. You may think it
still looks drab, but considering I'm not a designer or a front-end developer,
I'm fairly proud of how it turned out.

[Smart HTTP]: https://git-scm.com/book/en/v2/Git-on-the-Server-Smart-HTTP
[gitweb.conf]: https://git-scm.com/docs/gitweb.conf

## Gitolite tips and tricks

Here are some of the Gitolite tricks I've set up on my server that you may find
useful.

### Mirroring to Github

I still mirror most of my repositories to Github, as that's still the best
place for discoverability and compatibility with other programs.

This is easy to set up in Gitolite. In your `gitolite.conf` file, add the
following to configure the repos you want to mirror to Github:

```gitolite
@github = repo1 repo2

repo @github
    config remote.github.url = git@github.com:gpanders/%GL_REPO.git
    config remote.github.mirror = true
    option hook.post-receive = mirror
```

Update your `gitolite.rc` file to allow the `remote.*` config options to be set:

```perl
    GIT_CONFIG_KEYS             =>  'remote\..*\.(url|mirror)',
```

Now create the following script at `hooks/repo-specific/mirror` in your [local
code path][]:

```sh
#!/bin/sh
git push --quiet --mirror --force github
```

You'll also need to create an SSH key for your `git` user on your server and
upload the public key to Github to allow your server to push to Github:

    $ ssh yourserver.com
    $ su - git
    $ ssh-keygen -t rsa -b 2048 -C 'Git user'
    $ # Paste the contents of ~/.ssh/id_rsa.pub to https://github.com/settings/ssh/new

### Clone repos without .git suffix

Github and other popular hosting sites allow you to interact with remote git
repos with or without the `.git` suffix, e.g.

    git clone https://github.com/gpanders/dotfiles.git

and

    git clone https://github.com/gpanders/dotfiles

are the same. Gitolite always uses the `.git` suffix on repositories, but you
can simply create non-suffixed symlinks that will allow you to clone
repositories with or without the `.git` extension:

    $ cd /var/lib/git/repositories
    $ ln -s dotfiles.git dotfiles

You can do this manually quite easily, but you can also create a Gitolite
trigger to automatically create these symlinks everytime a new repo is created.

Create a [trigger][] at `triggers/post-compile/create-symlinks` in your [local
code path][] with the following contents:

```sh
#!/bin/sh

# For projects that gitweb has access to, create symlinks in the 'repositories'
# directory without the .git suffix pointing to the real repos

symlink() {
    repo="$1"
    [ -L "$repo" ] && rm "$repo"
    if gitolite access -q "$repo" gitweb R any || gitolite git-config -q -r "$repo" gitweb\\.; then
        ln -s "$repo".git "$repo"
    fi
}

cd "$GL_REPO_BASE" || exit 1
if [ "$1" = "POST_CREATE" ] && [ -n "$2" ]; then
    # just one to be done
    symlink "$2"
else
    # all of them
    gitolite list-phy-repos | while IFS= read -r repo; do
        symlink "$repo"
    done
fi
```

In the above script, only repositories which are publicly acessible on Gitweb
have a symlink created, since I only really care about the `.git` extension on
the web interface (e.g. I want to use git.gpanders.com/dotfiles instead of
git.gpanders.com/dotfiles.git). If you want this to apply to all repos, simply
remove the `gitolite access` check.

You'll also need a second trigger at
`triggers/post-compile/update-gitweb-access-list`. This trigger is supplied by
Gitolite by default, so creating a new trigger just overrides the default one.
The only change we need to make to the default trigger is to exclude the `.git`
suffix from the list of repositories that Gitolite makes available to Gitweb.

Copy the [default trigger][] to
`triggers/post-compile/update-gitweb-access-list` in your [local code path][]
and modify [line 28][] to

            echo "$repo" >> $tmpfile

### Publish a Hugo site

This is the hook I use to publish this blog. I use Hugo to "compile" my site
and I push it to Github where it's hosted on Github Pages. My publish hook is
located at `hooks/repo-specific/publish`:

```sh
#!/bin/sh

set -e

if ! command -v hugo >/dev/null 2>&1; then
        echo "hugo not found" >&2
        exit 1
fi

if [ -z "$GIT_DIR" ]; then
        echo "GIT_DIR not set" >&2
        exit 1
fi

TMPDIR=$(mktemp -d)
git --work-tree="$TMPDIR" checkout --force --recurse-submodules
git clone --quiet git@github.com:gpanders/gpanders.github.io "$TMPDIR"/public

echo "Building site..."
(cd "$TMPDIR" && hugo --quiet --cleanDestinationDir --destination public)

(
        cd "$TMPDIR"/public
        export GIT_DIR=.git
        if ! git diff-index --quiet HEAD --; then
                echo "Publishing site..."
                git add .
                git commit --quiet -m "Rebuilding site $(date)"
                git push --quiet origin master
                echo "Done!"
        fi
)

rm -rf "$TMPDIR"
```

and in my `gitolite.conf` I simply use:

```gitolite
repo blog
    option hook.post-receive = publish
```

[local code path]: https://gitolite.com/gitolite/non-core#for-your-non-core-programs
[trigger]: https://gitolite.com/gitolite/triggers
[default trigger]: https://github.com/sitaramc/gitolite/blob/d89c7ddce000de3de8c6216877e2ad94d63e36d1/src/triggers/post-compile/update-gitweb-access-list
[line 28]: https://github.com/sitaramc/gitolite/blob/d89c7ddce000de3de8c6216877e2ad94d63e36d1/src/triggers/post-compile/update-gitweb-access-list#L28
