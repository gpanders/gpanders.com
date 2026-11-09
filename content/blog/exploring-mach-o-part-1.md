---
title: "Exploring Mach-O, Part 1"
date: 2022-01-16T19:13:49-07:00
tags:
  - mach-o
  - macos
  - zig
---

*This is part 1 of a 4 part series exploring the structure of the Mach-O file
format. Here are links to [part 2](/blog/exploring-mach-o-part-2/), [part 3](/blog/exploring-mach-o-part-3/), and [part 4](/blog/exploring-mach-o-part-4/).*

I recently read a great article from [Amos over at
fasterthanli.me][fasterthanli.me] that explored the ELF format for Linux
executables. Digging into these kinds of topics in a deep and thorough way has
always been super interesting to me, not to mention educational. So, I thought
I'd take a stab at doing something similar for Mach-O, the object file format
used by macOS.

Before going on this journey I didn't know anything about Mach-O except that,
well, it was the object file format used by macOS. Right now, there's still *a
lot* I don't know about Mach-O or the internal workings of macOS, but it's
definitely fair to say that I know it a bit better than I did before!

Feel free to following along if you'd like. The high-level outline of our
journey will be:

1. Create a minimal Mach-O executable
2. Create a DIY parser (in Zig!) to read Mach-O files
3. ???
4. Profit

## Getting started

The first thing we'll need is a Mach-O object file. My filesystem is filled
with these of course; every binary file on a macOS system is encoded as Mach-O.
But for learning purposes that won't do: we need to do it ourselves.

The smallest possible executable simply calls the `exit` syscall. If we were on
Linux on an x86 machine, this would just be

```asm
xor rdi, rdi    ; set rdi to 0 (exit code)
mov rax, $60    ; set rax to 60 (exit syscall number)
syscall         ; do the syscall!
```

But we're not on Linux, or on x86! So we need to figure out how to do this in
ARM64.

ARM64 doesn't have the same cryptically named registers as x86, instead using
boring old names like `x0` and `x1` for the first and second function
arguments, respectively. ARM64 shares the `mov` instruction with x86, so we
know the first line of our assembly will be

```asm
mov x0, #0
```

We want to call the `exit` syscall with argument 0 to exit the program cleanly.
We could also exit with an error code like 42 to prove to ourselves that our
program is doing what we expect:

```asm
mov x0, #42
```

Now we need to make the `exit` syscall. How do we do that? Well according to
the handy [ARM developer documentation][syscall], we want the `svc`
instruction. However, we also need to know the syscall number.

We can cheat a little bit here and just copy macOS's homework. The system
library located at `/usr/lib/system/libsystem_kernel.dylib` is part of macOS's
`libSystem.dylib`, the libc implementation. What does that library have to say
about `svc`?

<!-- target: grep_libsystem_kernel
```bash
printf '$ objdump -d /usr/lib/system/libsystem_kernel.dylib | grep -B 2 svc | head -n20\n'
objdump -d /usr/lib/system/libsystem_kernel.dylib | grep -B 2 svc | head -n20
```
-->

<!-- name: grep_libsystem_kernel -->
```console
$ objdump -d /usr/lib/system/libsystem_kernel.dylib | grep -B 2 svc | head -n20
_issetugid:
     e0c:	f0 28 80 d2	mov	x16, #327
     e10:	01 10 00 d4	svc	#0x80
--
__kernelrpc_mach_vm_allocate_trap:
     f64:	30 01 80 92	mov	x16, #-10
     f68:	01 10 00 d4	svc	#0x80
--
__kernelrpc_mach_vm_purgable_control_trap:
     f70:	50 01 80 92	mov	x16, #-11
     f74:	01 10 00 d4	svc	#0x80
--
__kernelrpc_mach_vm_deallocate_trap:
     f7c:	70 01 80 92	mov	x16, #-12
     f80:	01 10 00 d4	svc	#0x80
--
_task_dyld_process_info_notify_get:
     f88:	90 01 80 92	mov	x16, #-13
     f8c:	01 10 00 d4	svc	#0x80
--
```

Well that's a good start. Disassembling `libsystem_kernel.dylib` reveals quite
a few `svc` calls, all of which are present within procedures that look
suspiciously like system calls... So it looks like to make a syscall, we move
the syscall number into register `x16` and then use the `svc` instruction with
an immediate value of `#0x80`.

We need to know the syscall number though. Maybe we can find `exit` in there?

<!-- target: grep_libsystem_kernel_exit
```bash
printf '$ objdump -d /usr/lib/system/libsystem_kernel.dylib | grep -B 2 svc | grep -A 2 _exit\n'
objdump -d /usr/lib/system/libsystem_kernel.dylib | grep -B 2 svc | grep -A 2 _exit
```
-->

<!-- name: grep_libsystem_kernel_exit -->
```console
$ objdump -d /usr/lib/system/libsystem_kernel.dylib | grep -B 2 svc | grep -A 2 _exit
___exit:
    7b34:	30 00 80 d2	mov	x16, #1
    7b38:	01 10 00 d4	svc	#0x80
```

Bingo! So it looks like the `exit` syscall number is `#1`. Can we confirm this
in a more "official" way, perhaps through a definition in a header file or
something?

It turns out we can, by taking a peek in
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/syscall.h`[^1] [^2]. Looking in that header file, we find a list of all of the syscall
numbers on macOS:

```c
#define	SYS_syscall        0
#define	SYS_exit           1
#define	SYS_fork           2
#define	SYS_read           3
#define	SYS_write          4
#define	SYS_open           5
#define	SYS_close          6
#define	SYS_wait4          7
```

And whaddya know, there's `SYS_exit` sitting nice and pretty next to `1`.

We now know enough to create our minimal Mach-O program. Let's put it all
together:

```asm
; exit.asm
_main:
        mov x0, #42     ; exit code
        mov x16, #1     ; syscall number for exit
        svc #0x80       ; do the syscall!
```

Let's assemble it!

```console
$ as exit.asm -o exit.o
```

Technically, `exit.o` (the object file) is itself a Mach-O file. So we could
just stop here and move on with the parsing. But we should probably make sure
our tiny program works, no? So now let's link the object file into a full blown
executable.

```console
$ ld exit.o -o exit
ld: warning: arm64 function not 4-byte aligned: ltmp0 from exit.o
Undefined symbols for architecture arm64:
  "_main", referenced from:
     implicit entry/start for main executable
ld: symbol(s) not found for architecture arm64
```

Uh oh. That's not pretty. It turns out, there are a few more things our little
ASM program needs. First, we need to ensure that the start address of the
`_main` function is 4-byte aligned. We can do this by adding a line

```asm
.align 4
```

just before the start of the `_main` function. We also need to tell the
assembler to make `_main` visible to the linker by adding

```asm
.global _main
```

The final version should look like this:

```asm
; exit.asm
.global _main
.align 4
_main:
        mov x0, #42     ; exit code
        mov x16, #1     ; syscall number for exit
        svc #0x80       ; do the syscall!
```

Ok let's try linking again!

```console
$ ld exit.o -o exit
ld: dynamic main executables must link with libSystem.dylib for architecture arm64
```

Blast! This error message is pretty self-explanatory: we need to link with
`libSystem.dylib`. Ok, no problem, we'll just add `-lSystem` to the `ld`
invocation.

```console
$ ld exit.o -lSystem -o exit
ld: library not found for -lSystem
```

Eh? One might expect `libSystem.dylib` to be on the default library search
path, but apparently as of macOS 11, one would be wrong. So we need to
explicitly add the oh-God-why-is-it-so-long library path to the command line:

```console
$ ld exit.o -L /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib/ -lSystem -o exit
```

Finally, no error message, which means linking was successful! If we run our
program and check the return code, we should see `42`:

```console
$ ./exit
$ echo $?
42
```

Cool! If we disassemble our executable with `objdump` we should see the very
same commands we just wrote by hand:

```console
$ objdump -d exit

exit:   file format mach-o arm64


Disassembly of section __TEXT,__text:

0000000100003fa0 <_main>:
100003fa0: 40 05 80 d2  mov     x0, #42
100003fa4: 30 00 80 d2  mov     x16, #1
100003fa8: 01 10 00 d4  svc     #0x80
```

No surprises here. Notice that `objdump` mentioned that this is the disassembly
for "section `__TEXT,__text`". We don't know what that means yet, but we'll
find out soon enough.

## Let's get macho

Now that we have a tiny executable we can start investigating the Mach-O format
in more detail. It just so happens that archive.org has a link to the [Mac OS X
ABI Mach-O File Format Reference][mach-o reference]. Surprisingly, I wasn't
able to find anything as in-depth as this from Apple directly. This document
will guide us on our way to parsing our little Mach-O file. It is a bit old,
and there are a few things that are either missing or incorrect. We will also
reference the header files found under
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/mach-o`.

Reading through the reference document, we see that Mach-O files have three
major "regions":

1. A header
2. A list of "load commands"
3. Segments

The header is a simple 32-byte structure that looks like this:

```c
struct mach_header_64 {
   uint32_t magic;
   cpu_type_t cputype;
   cpu_subtype_t cpusubtype;
   uint32_t filetype;
   uint32_t ncmds;
   uint32_t sizeofcmds;
   uint32_t flags;
   uint32_t reserved;
};
```

Note that this is the header for 64 bit executables. 32-bit Mach-O files use a
slightly different header, but we're going to assume 64-bit for the rest of our
journey.

The first four bytes of every Mach-O file is the "magic number", just like in
ELF files. ELF uses the magic number `0x7F 0x45 0x4C 0x46` (which is just `0x7F
ELF`). According to the Mach-O File Format Reference, the magic number for
32-bit Mach-O files is defined as the constant `MH_MAGIC`. Where is this
constant defined? According to the reference, it's in
`/usr/include/mach-o/loader.h`. Let's see what it is:

```console
$ printf 'MH_MAGIC' | cc -include 'mach-o/loader.h' -E - | tail -n1
0xfeedface
```

I... uh... ok. Yes, the magic number for Mach-O files is, in fact, `feedface`.
I'll be honest, I got quite a kick out of this.

64-bit Mach-O files use the constant `MH_MAGIC_64`, which is just `MH_MAGIC +
1`, i.e. `0xfeedfacf`. Not as funny.

Let's check our `exit` program and see for ourselves:

```console
$ # -l 4 = read 4 bytes, -e = little endian
$ xxd -l 4 -e ./exit
00000000: feedfacf                             ....
```

Yup. There it is. `feedfacf`.

After the magic number are a few enums: `cpu_type_t`, `cpu_subtype_t`, and
`filetype`. We could, at this point, continue to poke around our program using
`xxd` (or your hex editor of choice) and compare the raw byte values with the
definitions of these enums in the `mach-o/loader.h` header file. But that's a
bit tedious. Let's write some code.

In [part 2](/blog/exploring-mach-o-part-2/), we'll start on our
own DIY parser to read through our Mach-O file.

[^1]: Requires the [Command Line Tools for Xcode][command line tools].

[^2]: By the way, since this path is painfully long to both read and write, for
the remainder of this article I'm going to pretend there is an imaginary
symlink from `/Library/Developer/CommandLineTools/SDKs/usr/include` to
`/usr/include`. So any references to `/usr/include/*` are actually under the
full path.

[fasterthanli.me]: https://fasterthanli.me/series/making-our-own-executable-packer/part-1
[syscall]: https://developer.arm.com/documentation/102374/0101/System-calls?lang=en
[command line tools]: https://developer.apple.com/download/more/
[mach-o reference]: https://web.archive.org/web/20090901205800/http://developer.apple.com/mac/library/documentation/DeveloperTools/Conceptual/MachORuntime/Reference/reference.html#//apple_ref/c/tag/section_64
