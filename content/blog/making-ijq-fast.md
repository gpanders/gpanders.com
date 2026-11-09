---
title: "Making ijq Fast"
date: 2024-04-13T13:14:07-05:00
---

I recently received an [issue report][] that [ijq][] was performing slowly.
The issue claimed that, when used on a large (16 MB) JSON file, ijq was "too
slow to be usable". I downloaded the test file which was (helpfully) provided
in the issue and tried it myself. Even using the most charitable definition, I
agree that this classifies as "unusably slow". Note that in this screen
recording I am displaying my key presses to show just how unresponsive
ijq is:

[issue report]: https://todo.sr.ht/~gpanders/ijq/10
[ijq]: https://codeberg.org/gpanders/ijq/

![](/media/ijq_old_and_slow.mp4)

In the rest of this post I'll talk about why ijq was performing so badly, and
what I changed to fix it. The end result is that ijq is now, dare I say, not
just usable, but downright snappy:

![](/media/ijq_new_and_fast.mp4)

## Background

First, a brief explanation of how ijq works.

ijq is, more or less, an interactive TUI wrapper around [jq][]. When ijq
starts, the input document (whether read from a file or stdin) is read and
processed with jq using the default filter (`.`), and the output is written to the left
(Input) pane. A second jq process is run which processes the input document
using whatever filter the user supplied to ijq; that output is written to the
right (Output) document. The input text box is the filter passed to jq.
Whenever the input text box changes, jq is run on the input document using the
new filter and the output is written to the right pane.

[jq]: https://jqlang.github.io/jq/

Conceptually, this is fairly simple, but there are plenty of ways to do this
wrong (as I learned).

The input document is represented as a `Document` object:

```go
type Document struct {
	input   string
	filter  string
	options Options
}
```

The `Document` object implements the `WriterTo` interface for writing to an
`io.Writer` object:

```go
// Filter the document with the given jq filter and options
func (d *Document) WriteTo(w io.Writer) (n int64, err error) {
	opts := d.options
	if _, ok := w.(*tview.TextView); ok {
		// Writer is a TextView, so set options accordingly
		opts.forceColor = true
		opts.monochrome = false
		opts.compact = false
		opts.rawOutput = false
	}

	args := append(opts.ToSlice(), d.filter)
	cmd := exec.Command(d.options.command, args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return 0, err
	}

	go func() {
		defer stdin.Close()
		_, _ = io.WriteString(stdin, d.input)
	}()

	out, err := cmd.CombinedOutput()
	if err != nil {
		if exiterr, ok := err.(*exec.ExitError); ok {
			exiterr.Stderr = out
		}
		return 0, err
	}

	if tv, ok := w.(*tview.TextView); ok {
		w = tview.ANSIWriter(tv)
		tv.Clear()
	}

	m, err := w.Write(out)
	n = int64(m)
	return n, err
}
```

If the `Writer` is a `TextView` (the TUI widget used for the input and output
panes) then we set some options which are passed to the child jq process. The
child process is started and the document's input is piped to the process's
stdin. When the process finishes, the stdout is written to the `Writer`.

The filter input text box has a callback which is fired anytime its value
changes:

```go
filterInput.SetChangedFunc(func(text string) {
	go app.QueueUpdateDraw(func() {
		errorView.Clear()
		doc.filter = text
		outputView.ScrollToBeginning()
		_, err := doc.WriteTo(outputView)
		if err != nil {
			exitErr, ok := err.(*exec.ExitError)
			if ok {
				fmt.Fprint(tview.ANSIWriter(errorView), string(exitErr.Stderr))
			}

			return
		}
	})
})
```

Whenever the input changes, we update the current `Document`'s filter and call
`WriteTo` using the output text view. If the jq subprocess returns an error,
write the error text to the error text view.

These two functions are the backbone of ijq, and both have fatal flaws
(experienced Go and/or UI developers have perhaps already spotted them)
responsible for ijq's slow performance.

Before moving on, it's worth mentioning that these problems had not been
noticed so far because I have only ever used ijq on relatively small inputs.
When the input is small enough, the typing speed of the user becomes the
bottleneck, not the jq process or updating the text views, so these issues
have gone undetected (by me) for a long time (maybe other ijq users have
noticed them, but until this issue report I was unaware!).

## Problem

Refer back to the filter input callback implementation above. The first
problem is the use of `QueueUpdateDraw`. ijq uses a TUI widget framework
called [tview][] to manage the application run loop. tview's documentation for
[`QueueUpdate`][QueueUpdate] states:

>QueueUpdate is used to synchronize access to primitives from non-main
>goroutines. The provided function will be executed as part of the event loop
>and thus will not cause race conditions with other such update functions or
>the Draw() function.

[tview]: https://github.com/rivo/tview
[QueueUpdate]: https://pkg.go.dev/github.com/rivo/tview#Application.QueueUpdate

`QueueUpdate` (and `QueueUpdateDraw`) is used to modify UI primitives from
non-main threads. Importantly, these functions block the caller until the
main thread processes the callback and synchronizes the state. tview's wiki
page on [Concurrency][] says:

>Any event handlers you install, e.g. InputField.SetChangedFunc() or
>Table.SetSelectedFunc(), are invoked from the main goroutine. It is safe to
>make changes to your primitives in these handlers. If they are invoked in
>response to a key event, you must not call Application.Draw() as the
>application's main loop will do that for you and calling Application.Draw()
>(or Application.QueueUpdate() or Application.QueueUpdateDraw()) from within
>an event handler will lead to a deadlock.

[Concurrency]: https://github.com/rivo/tview/wiki/Concurrency

The use of `QueueUpdateDraw()` in this handler is in violation of this
advice. The function is started in a separate goroutine (it's called with
`go`), so this avoids deadlock, but it still blocks the main thread until the
`WriteTo` function finishes. Recall that `WriteTo` runs the jq subprocess,
so effectively this runs each jq process on the main thread **every time the
filter input changes**.

This change was added (by [me][1d73d4c]) over 3 years ago, because it
(apparently) solved another issue with race conditions in the prior
implementation (no doubt that it did: when everything is on the main thread
there are no race conditions).

[1d73d4c]: https://codeberg.org/gpanders/ijq/commit/1d73d4c407023340cad50dc995122856bbe881b5

The second important problem is in the `WriteTo` implementation above. This
function uses the [`CombinedOutput`][CombinedOutput] function to get both
stdout and stderr from the jq process. This function writes the process's
stdout and stderr into a temporary buffer. After the jq process completes,
that buffer is then written to the output text view.

[CombinedOutput]: https://pkg.go.dev/os/exec#Cmd.CombinedOutput

This is slow, because we first wait for the process to write to the buffer,
and only when that is finished do we start writing to the text view. This is
the cause of ijq's long startup time (visible in the first video at the top of
the post). Instead, we should be able to pipe the output from the subprocess
directly to the text view so that the output is visible immediately.

## Solutions

Fixing the first problem was [straightforward][ef1dc6b]: drop `QueueUpdateDraw`,
run `WriteTo` in a separate thread, and use a `ChangedFunc` on the output view
to redraw the application when the output view changes. With this change ijq
immediately becomes more responsive. User input is never blocked on the jq
process.

[ef1dc6b]: https://codeberg.org/gpanders/ijq/commit/ef1dc6b182f8e6ca81da0b83ec9bee4c5c3f428e

This is suboptimal though, because a new jq process is spawned on every input
change. We should be able to cancel old processes when the input changes, and
if multiple input change callbacks are fired before starting a new jq process,
we should only ever use the most recent input. Go's native channels are almost
a good fit here, but what we want is a LIFO (last-in, first-out), whereas Go's
channels are FIFO (first-in, first-out): every input written into a channel is
read out in the same order. On the receiving end of the channel, there's no
(easy) way to only read the most recent one. So instead of channels, we use a
regular old mutex and condition variable. The mutex guards changes to the
`Document` object and a `pending` variable. When the filter input changes, the
`Document` object is updated, `pending` is set to `true`, any existing jq
processes are cancelled, and the condition variable is signalled. A separate
thread waits for `pending` to become true and when it does, makes a copy of
the `Document` object before starting a new jq process.

Fixing the second problem was a bit trickier. Go's `Cmd` object can use any
object that implements the `io.Writer` interface in its `Stdout` and `Stderr`
fields. Instead of writing to a temporary buffer, waiting for the process to
complete, and then copying to the text view, we can simply write to the text
view immediately! This change, combined with removing another incorrect use of
`QueueUpdateDraw` in the app startup, solves the initial startup time issue.

But sometimes fixing one issue introduces another: in this case, when the jq
process writes directly to the text view, we have to clear the text view
before running the jq process (or else each successive process will append to
the previous process's output). But when we do this, the output view is
cleared every time the user updates the filter input. We only want the output
view to change when there is actually new visible output. This ensures that if
the user types in an invalid filter, the last output is still visible. This is
an important property for an interactive jq tool where experimenting with the
right filter is a large part of the value proposition.

To address this, we make a new type that wraps a `TextView` and tracks its
"dirty" state. When the text view is dirty, we call the view's `Clear()`
method before it is written (and then reset the dirty state).

```go
type pane struct {
	tv    *tview.TextView
	dirty bool
}

func (pane *pane) Write(p []byte) (n int, err error) {
	if pane.dirty {
		pane.tv.Clear()
		pane.dirty = false
	}

	return pane.tv.Write(p)
}
```

The dirty state is then set before the jq process is invoked.

With these changes, ijq's performance problems are solved!

## Conclusion

I'm not sure there is a lesson here other than re-learning that concurrency
(and UIs) are hard, even in languages like Go which give you great tools to
manage concurrency. Ultimately, for me, it was a learning experience and a fun
excuse to hack on a side project. If you are an ijq user, I hope this makes
your user experience even better!
