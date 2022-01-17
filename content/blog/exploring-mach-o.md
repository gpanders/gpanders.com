---
title: "Exploring Mach-O"
date: 2022-01-16T19:13:49-07:00
draft: true
tags: [mach-o, macos, zig]
---

I recently read a great article series from [Amos over at
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

```bash
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

```bash
$ ld exit.o -o exit
ld: dynamic main executables must link with libSystem.dylib for architecture arm64
```

Blast! This error message is pretty self-explanatory: we need to link with
`libSystem.dylib`. Ok, no problem, we'll just add `-lSystem` to the `ld`
invocation.

```bash
$ ld exit.o -lSystem -o exit
ld: library not found for -lSystem
```

Eh? One might expect `libSystem.dylib` to be on the default library search
path, but apparently as of macOS 11, one would be wrong. So we need to
explicitly add the oh-God-why-is-it-so-long library path to the command line:

```bash
$ ld exit.o -L /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib/ -lSystem -o exit
```

Finally, no error message, which means linking was successful! If we run our
program and check the return code, we should see `42`:

```bash
$ ./exit
$ echo $?
42
```

Cool! If we disassemble our executable with `objdump` we should see the very
same commands we just wrote by hand:

```bash
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

```bash
$ printf 'MH_MAGIC' | cc -include 'mach-o/loader.h' -E - | tail -n1
0xfeedface
```

I... uh... ok. Yes, the magic number for Mach-O files is, in fact, `feedface`.
I'll be honest, I got quite a kick out of this.

64-bit Mach-O files use the constant `MH_MAGIC_64`, which is just `MH_MAGIC +
1`, i.e. `0xfeedfacf`. Not as funny.

Let's check our `exit` program and see for ourselves:

```bash
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

## Writing a parser

I'm going to write my Mach-O parser in Zig. Why Zig? Mostly because I really
like it and I find it's quite easy to get simple things like this up and
running. It's also particularly well suited to tasks like this[^3].

**Note to readers in the future**: it's important to note that Zig does not yet
have a stable 1.0 release. While at this point the language itself is fairly
stable, the standard library often has breaking changes. I'll do my best to
keep the code in this article up-to-date, but be warned that it may not work by
the time you read it. You can find the full source code on [sourcehut](https://git.sr.ht/~gpanders/macho.zig).

First things first, let's bootstrap an executable:

```bash
$ mkdir macho
$ cd macho
$ zig init-exe
info: Created build.zig
info: Created src/main.zig
info: Next, try `zig build --help` or `zig build run`
```

We'll leave `main.zig` simple and simply call our parsing function and then
print the parsed data. We'll put the guts of our parser in `src/macho.zig`.

```zig
/// src/macho.zig

// First, import std, cuz we're gonna need it
const std = @import("std");

// Now, let's create a Parser struct
const Parser = struct {
    /// Field definitions
    // Our parser will hold a slice of bytes
    data: []const u8,

    /// Functions
    ...
};
```

To start off, we define our `Parser` struct with a single field: a slice of
bytes (or `u8` in Zig). We mark this slice as `const` because we don't plan to
mutate the data, we are simply interpreting it.

Our parser will work by implementing a few parse functions to read off a
certain number of bytes from the front of the `data` slice and interpret those
bytes as a given value. Let's first add an `init` function to initialize a
`Parser` object from an array of bytes.

```zig
/// src/macho.zig

const Parser = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn init(data: []const u8) Parser {
        return Parser{
            .data = data,
        };
    }
};
```
Next, let's add a simple `parseLiteral` function:

```zig
/// src/macho.zig

const Parser = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn init(...) { ... }

    pub fn parseLiteral(self: *Parser, comptime T: type) !T {

    }
};
```

Let's explain what's going on here real quick. The first argument to our
function is a pointer to a `*Parser` object. Because this function is defined
within the `Parser` struct definition, Zig treats this argument as a
"receiver", meaning we can use standard method call syntax. The object on which
this method is called is used as the first argument (`self`). We use a pointer
to `Parser` because this function will mutate the parser object (by removing
bytes from the `data` byte slice).

Next, the second argument is a `comptime` argument, which means it has to be
known at compile time. It also has type `type`, which may be confusing at
first. In Zig's comptime, types are just values, which means you can do things
like

```zig
const MySuperCoolType = u32;
const y: MySuperCoolType = 42;
```

This also means that we can accept a type as an argument to our function. This
is how Zig does polymorphism. In our case, we accept a type `T` which is also
the return type. So this function will read some bytes off the front of our
`data` byte slice, interpret those bytes as a `T`, and then return the value.

Finally, the return type `!T` means that this function returns a `T` *or* an
error. If you're familiar with Rust, this is similar to `Result<T, Error>`.

This is what the implementation looks like:

```zig
    pub fn parseLiteral(self: *Parser, comptime T: type) !T {
        const size = @sizeOf(T);
        if (self.data.len < size) {
            return error.NotEnoughBytes;
        }

        const bytes = self.data[0..size];
        self.data = self.data[size..];
        return std.mem.bytesToValue(T, bytes);
    }
```

First, we use the builtin `@sizeOf` function to get the size of the type `T` in
bytes. We then ensure that our byte slice has enough data in it: if it does
not, we return a `NotEnoughBytes` error.

We then grab `size` bytes from our byte slice and then mutate the byte slice to
remove those bytes from the front. We then call `std.mem.bytesToValue(T,
bytes)` to re-interpret those bytes as a type `T`.

Is this safe to do? When we're parsing integers (which we'll be doing a lot
of), this is fine, so long as the bytes are in the endian order we expect.
On macOS, everything is little endian, so this is not an issue. We can also
parse structs that are made up strictly of integers or arrays of integers for
the same reason.

If we want to parse an enum, then we need to validate that the value we're
parsing is a valid enum value. We will do this later when we introdue a
`parseEnum` function.

In our `main.zig` file, we can test this out by adding some boilerplate to open
and `mmap` a file:

```zig
/// src/main.zig

const std = @import("std");

const macho = @import("macho.zig");

pub fn main() anyerror!void {
    // Read the first command line argument. If it doesn't exist, return an
    // error
    var args = std.process.args();
    _ = args.skip();
    const fname = args.nextPosix() orelse {
        std.debug.print("Missing required argument: FILENAME\n", .{});
        return error.MissingArgument;
    };

    // Open the file. We use `defer` to ensure the file is closed when the
    // variable goes out of scope. The `try` keyword is semantic sugar that
    // uses the result of the function if no error occurs; otherwise, it
    // returns whatever error value the function itself returned (if you're
    // familiar with Rust, this is like the `?` operator).
    var file = try std.fs.cwd().openFile(fname, .{});
    defer file.close();

    // This is a standard mmap(2) call. If you're unfamiliar with mmap, give
    // `man 2 mmap` a read. This memory maps the file's contents into our
    // program's virtual memory space. This gives us access to the bytes
    // without having to copy them. Again, we use `defer` to "clean up" the
    // mmap when `data` goes out of scope.
    const data = try std.os.mmap(null, try file.getEndPos(), std.os.PROT.READ, std.os.MAP.PRIVATE, file.handle, 0);
    defer std.os.munmap(data);

    // Finally, we initialize our parser.
    var parser = macho.Parser.init(data);

    // Let's read the magic number from the data
    const magic = try parser.parseLiteral(u32);
    if (magic != 0xfeedfacf) {
        return error.BadMagic;
    }

    std.debug.print("0x{x}\n", .{magic});
}
```

We can compile our program by running

```bash
$ zig build
```

If it compiles without error (which it should), the `macho` executable can be
found at `zig-out/bin/macho`:

```bash
$ zig-out/bin/macho
Missing required argument: FILENAME
error: MissingArgument
/Users/greg/src/gpanders.com/macho/src/main.zig:13:9: 0x104f6bb9f in main (macho)
        return error.MissingArgument;
        ^
```

As expected, we get a `MissingArgument` error since we did not supply a
required argument. Let's give it our `exit` binary:

```bash
$ zig-out/bin/macho ../exit
0xfeedfacf
```

Hey that's the magic number! It looks like we are successfully able to parse
integers. Before we move on, let's see what happens if we give `macho` a non
Mach-O object file:

```bash
$ ./zig-out/bin/macho build.zig
error: BadMagic
/Users/greg/src/gpanders.com/macho/src/main.zig:38:9: 0x1003d7de7 in main (macho)
        return error.BadMagic;
        ^
```

Good, as expected we get a `BadMagic` error.

## Inviting friends to the party

One of the great things about using Zig is how well it interacts with C headers
and libraries. This will come in handy as we flesh out our parser, because we
are going to need *lots* of enums. But the enum values are already defined for
us in `/usr/include/mach-o/loader.h` (and a few other places). So rather than
redo all that work ourselves, we can simply import the existing C header files
and reuse those definitions.

First, we need to tell Zig where to look for these header files. In
`build.zig` there is a block of lines that looks like this:

```zig
const exe = b.addExecutable("macho", "src/main.zig");
exe.setTarget(target);
exe.setBuildMode(mode);
exe.install();
```

Just above the line `exe.install()`, add

```zig
exe.addIncludeDir("/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/");
```

Now, back in `src/macho.zig`, we can include the C headers:

```zig
/// src/macho.zig

const std = @import("std");

const loader = @cImport(@cInclude("mach-o/loader.h"));
const machine = @cImport(@cInclude("mach/machine.h"));
```

Zig will translate all of the C code found in those two headers and their
declarations can be accessed under each respective namespace.

For example, in `/usr/include/mach-o/loader.h` we find the line

```c
#define	MH_MAGIC	0xfeedface	/* the mach magic number */
```

We can access this value from Zig using

```zig
loader.MH_MAGIC
```

Let's leverage this to create some data structures.

First, we'll create a Zig version of the `mach_header_64` struct. This will
allow us to use Zig's much better type system.

```zig
/// src/macho.zig

pub const MachHeader64 = struct {
    magic: u32,
    cputype: CpuType,
    cpusubtype: CpuSubType,
    filetype: Filetype,
    ncmds: u32,
    sizeofcmds: u32,
    flags: Flags,
    reserved: u32 = undefined,
};
```

Now we need to define the `CpuType`, `CpuSubType`, and `Filetype` enums.

This part is a bit tedious. We simply need to copy the `#define`s from
`loader.h` into our Zig file and transform them into valid Zig syntax. This is
no match for some `:s` Vim-fu, but if you're following along, feel free to
simply copy and paste these definitions:

```zig
/// src/macho.zig

const Filetype = enum(u32) {
    object = loader.MH_OBJECT,
    execute = loader.MH_EXECUTE,
    fvmlib = loader.MH_FVMLIB,
    core = loader.MH_CORE,
    preload = loader.MH_PRELOAD,
    dylib = loader.MH_DYLIB,
    dylinker = loader.MH_DYLINKER,
    bundle = loader.MH_BUNDLE,
    dylib_stub = loader.MH_DYLIB_STUB,
    dsym = loader.MH_DSYM,
    kext_bundle = loader.MH_KEXT_BUNDLE,
    fileset = loader.MH_FILESET,
};

const CpuType = enum(u32) {
    // @bitCast here is necessary to convert CPU_TYPE_ANY (-1) to unsigned int
    // (all 1's)
    any = @bitCast(u32, machine.CPU_TYPE_ANY),
    vax = machine.CPU_TYPE_VAX,
    mc680x0 = machine.CPU_TYPE_MC680x0,
    x86 = machine.CPU_TYPE_X86,
    x86_64 = machine.CPU_TYPE_X86 | machine.CPU_ARCH_ABI64,
    mc98000 = machine.CPU_TYPE_MC98000,
    hppa = machine.CPU_TYPE_HPPA,
    arm = machine.CPU_TYPE_ARM,
    arm64 = machine.CPU_TYPE_ARM | machine.CPU_ARCH_ABI64,
    arm64_32 = machine.CPU_TYPE_ARM | machine.CPU_ARCH_ABI64_32,
    mc88000 = machine.CPU_TYPE_MC88000,
    sparc = machine.CPU_TYPE_SPARC,
    i860 = machine.CPU_TYPE_I860,
    powerpc = machine.CPU_TYPE_POWERPC,
    powerpc64 = machine.CPU_TYPE_POWERPC | machine.CPU_ARCH_ABI64,
};

const CpuSubType = enum(u32) {
    // @bitCast here is necessary to convert CPU_SUBTYPE_ANY (-1) to
    // unsigned int (all 1's)
    any = @bitCast(u32, machine.CPU_SUBTYPE_ANY),
    little_endian = machine.CPU_SUBTYPE_LITTLE_ENDIAN,
    big_endian = machine.CPU_SUBTYPE_BIG_ENDIAN,
};

const Flags = packed struct {
    noundefs: bool,
    incrlink: bool,
    dyldlink: bool,
    bindatload: bool,
    prebound: bool,
    split_segs: bool,
    lazy_init: bool,
    twolevel: bool,
    force_flat: bool,
    nomultidefs: bool,
    nofixprebinding: bool,
    prebindable: bool,
    allmodsbound: bool,
    subsections_via_symbols: bool,
    canonical: bool,
    weak_defines: bool,
    binds_to_weak: bool,
    allow_stack_execution: bool,
    root_safe: bool,
    setuid_safe: bool,
    no_reexported_dylibs: bool,
    pie: bool,
    dead_strippable_dylib: bool,
    has_tlv_descriptors: bool,
    no_heap_execution: bool,
    app_extension_safe: bool,
    nlist_outofsync_with_dyldinfo: bool,
    sim_support: bool,
    dylib_in_cache: bool,
    _: u3, // pad to 32 bits
};
```

The `enum(u32)` syntax above means that we want those enums to be represented
using a u32. The `packed` keyword on the `Flags` struct creates a bitfield:
each `bool` field in this struct will use exactly a single bit. The `_: u3` at
the end pads our struct to a full 32 bits.

Note that we are able to use the definitions from the C header files to define
our enums. That means we don't need to know or care what those values are.

Now, let's add another function to our parser to parse enum values.

```zig
/// src/macho.zig

const Parser = struct {
    /// Field definitions
    ...


    /// Functions
    pub fn init(...) { ... }

    pub fn parseLiteral(...) { ... }

    pub fn parseEnum(self: *Parser, comptime T: type) !T) {

    }
};
```

Note that this function signature is identical to that of `parseLiteral`. We
could combine these into a single function and use Zig's type reflection to
handle literal values and enums differently. Perhaps we'll do that later, but
for now let's keep things simple and just use separate functions.

This implementation looks like this:

```zig
/// src/macho.zig

pub fn parseEnum(self: *Parser, comptime T: type) !T) {
    const size = @sizeOf(T);
    if (self.data.len < size) {
        return error.NotEnoughBytes;
    }

    const bytes = self.data[0..size];
    const tag = std.mem.bytesToValue(std.meta.Tag(T), bytes);
    const val = std.meta.intToEnum(T, tag) catch |err| {
        std.debug.print("{} is not a valid value for {s}\n", .{
            tag,
            @typeName(T),
        });
        return err;
    };
    self.data = self.data[size..];
    return val;
}
```

Once again, we check to make sure our byte slice has enough data in it. This
time, we convert our bytes into the "tag" type of our enum, which we get using
the `std.meta.Tag` standard library function. For the `CpuType` and
`CpuSubType` enums we defined earlier, this is `u32`. Once we convert the bytes
into the tag type, we can convert the tag value into an enum value using
`std.meta.intToEnum`. This will convert a number like `7` into an enum value
like `x86`. If the enum doesn't have a value corresponding to the given tag
value, `intToEnum` returns an error. In that case, we print a helpful error
message, and return the same error from our function. Note that this *should
not* happen, and indicates a bug in our parser.

It's also a good idea to encapsulate the parsing logic for our `MachHeader64`
struct within the struct definition itself. Let's add a `parse` method to that
struct:

```zig
/// src/macho.zig

pub const MachHeader64 = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(parser: *Parser) !MachHeader64 {

    }
};
```

This parse function will take a `Parser` object and return a `MachHeader64`.
This is what the implementation looks like:

```zig
/// src/macho.zig

pub fn parse(parser: *Parser) !MachHeader64 {
    const magic = try parser.parseLiteral(u32);
    if (magic != loader.MH_MAGIC_64) {
        return error.BadMagic;
    }

    const cputype = try parser.parseEnum(CpuType);
    const cpusubtype = try parser.parseEnum(CpuSubType);
    const filetype = try parser.parseEnum(Filetype);
    const ncmds = try parser.parseLiteral(u32);
    const sizeofcmds = try parser.parseLiteral(u32);
    const flags = try parser.parseLiteral(Flags);
    const reserved = try parser.parseLiteral(u32);

    return MachHeader64{
        .magic = magic,
        .cputype = cputype,
        .cpusubtype = cpusubtype,
        .filetype = filetype,
        .ncmds = ncmds,
        .sizeofcmds = sizeofcmds,
        .flags = flags,
        .reserved = reserved,
    };
}
```

Hopefully nothing here is surprising. We first parse the magic number and
return a `BadMagic` error if it doesn't match what we expect. Note that now
instead of hardcoding `0xfeedfacf` we are using the definition from the
`loader.h` header file.

Next we use our `parseEnum` and `parseLiteral` functions to parse each field of
the struct and finally place each value into the returned struct value.

Let's update `main.zig`:

```zig
/// src/main.zig

var parser = macho.Parser.init(data);

const header = try macho.MachHeader64.parse(&parser);
std.debug.print("{}\n", .{header});
```

If we build and run our program now, we should see a lot more information (note
that we are using the shorthand `zig build run` to both build and run the
program at once):

```console
$ zig build run -- ../exit
MachHeader64{ .magic = 4277009103, .cputype = CpuType.arm64, .cpusubtype = CpuSubTy
pe.little_endian, .filetype = Filetype.execute, .ncmds = 16, .sizeofcmds = 744, .fl
ags = Flags{ .noundefs = true, .incrlink = false, .dyldlink = true, .bindatload = f
alse, .prebound = false, .split_segs = false, .lazy_init = false, .twolevel = true,
 .force_flat = false, .nomultidefs = false, .nofixprebinding = false, .prebindable
= false, .allmodsbound = false, .subsections_via_symbols = false, .canonical = fals
e, .weak_defines = false, .binds_to_weak = false, .allow_stack_execution = false, .
root_safe = false, .setuid_safe = false, .no_reexported_dylibs = false, .pie = true
, .dead_strippable_dylib = false, .has_tlv_descriptors = false, .no_heap_execution
= false, .app_extension_safe = false, .nlist_outofsync_with_dyldinfo = false, .sim_
support = false, .dylib_in_cache = false, ._ = 0 }, .reserved = 0 }
```

Woof, that's not pretty. This "raw" representation is good for debugging, but
it's not very nice to look at.

We can tell `print` how we want our `MachHeader64` struct to be formatted by
adding a `format()` method to `MachHeader64`.

```zig
/// src/macho.zig

pub const MachHeader64 = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(...) { ... }

    pub fn format(value: MachHeader64, comptime fmt: []const u8, options:
    std.fmt.FormatOptions, writer: anytype) !void {
        _ = fmt;
        _ = options;
        try std.fmt.format(writer, "magic: 0x{x}\n", .{value.magic});
        try std.fmt.format(writer, "cputype: {}\n", .{value.cputype});
        try std.fmt.format(writer, "cpusubtype: {}\n", .{value.cpusubtype});
        try std.fmt.format(writer, "filetype: {}\n", .{value.filetype});
        try std.fmt.format(writer, "ncmds: {d}\n", .{value.ncmds});
        try std.fmt.format(writer, "sizeofcmds: {d}\n", .{value.sizeofcmds});
        try std.fmt.format(writer, "flags: ", .{});
        inline for (std.meta.fields(Flags)) |field| {
            if (field.field_type == bool and @field(value.flags, field.name)) {
                try std.fmt.format(writer, " ", .{});
                inline for (field.name) |c| {
                    try std.fmt.format(writer, "{c}", .{std.ascii.toUpper(c)});
                }
            }
        }
    }
};
```

The first two lines of this function suppress Zig's compiler errors for unused
function arguments. Next, we simply print each struct field in a manner
appropriate for that field's type. For the bit flags, we want a neat
representation that only shows flags that are set. We do this using an `inline
for` loop, which is a loop that is unrolled at compile time. We get a slice of
all of the fields of the `Flags` struct with `std.meta.fields`, iterate over
each of them, and print the field's name *if* it's corresponding bit is set.

Now when we rebuild and run we should see

```console
$ zig build run -- ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
```

Much nicer. This gives us a much better view into the data contained within our
Mach-O file.

We see our old friend `feedfacf`, as well as a few things that we already know,
such as the CPU type (`arm64`), the CPU subtype (`little_endian`), and the
filetype (`execute`, indicating this file is an executable). Following that we
see that this Mach-O has 16 load commands which take up 744 total bytes.
Finally, this Mach-O file has the `NOUNDEFS`, `DYLDLINK`, `TWOLEVEL`, and `PIE`
flags set:

```c
#define	MH_NOUNDEFS	0x1		/* the object file has no undefined
					   references */
#define MH_DYLDLINK	0x4		/* the object file is input for the
					   dynamic linker and can't be staticly
					   link edited again */
#define MH_TWOLEVEL	0x80		/* the image is using two-level name
					   space bindings */
#define	MH_PIE 0x200000			/* When this bit is set, the OS will
					   load the main executable at a
					   random address.  Only used in
					   MH_EXECUTE filetypes. */
```

Before we move on to parsing the load commands, let's make one more improvement
to our `Parser` struct. We added a `parse` method to the `MachHeader64` struct
which let us encapsulate the parsing logic for that data type. We want to
extend this to all of the structs that we expect to parse, and we want to be
able to easily dispatch the right method from our `Parser` struct.

To do this, we will use more comptime polymorphism. Let's add a `parseStruct`
method to our `Parser`:

```zig
/// src/macho.zig

const Parser = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn init(...) { ... }
    pub fn parseLiteral(...) { ... }
    pub fn parseEnum(...) { ... }

    pub fn parseStruct(self: *Parser, comptime T: type) !T {

    }
};
```

We'll handle this by checking if the type `T` has a `parse` method and, if so,
simply call that:

```zig
/// src/macho.zig

pub fn parseStruct(self: *Parser, comptime T: type) !T {
    if (!std.meta.trait.hasFn("parse")(T)) {
        @compileError(@typeName(T) ++ " does not have a parse() method");
    }

    const val = try T.parse(self);
    return val;
}
```

Note that in this function we are not checking to make sure our byte slice has
enough bytes, nor are we updating `self.data`. That is because both of these
things will be done by the struct's own `parse` function.

Notice that `parseStruct` has the exact same signature as both `parseLiteral`
and `parseEnum`. Perhaps this is a good type to consolidate all of these into a
single `parse` function.

```zig
/// src/macho.zig

const Parser = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn init(...) { ... }

    pub fn parse(self: *Parser, comptime T: type) !T {
        if (comptime std.meta.trait.hasFn("parse")(T)) {
            return try T.parse(self);
        }

        const size = @sizeOf(T);
        if (self.data.len < size) {
            return error.NotEnoughBytes;
        }

        const bytes = self.data[0..size];

        const val = switch (@typeInfo(T)) {
            .Enum => |info| blk: {
                const tag = std.mem.bytesToValue(info.tag_type, bytes);
                break :blk std.meta.intToEnum(T, tag) catch |err| {
                    std.debug.print("{} is not a valid value for {s}\n", .{
                        tag,
                        @typeName(T),
                    });
                    return err;
                };
            },
            .Int, .Struct => std.mem.bytesToValue(T, bytes),
            else => unreachable,
        };

        self.data = self.data[size..];
        return val;
    }
};
```

Here we see a few more Zig features. First, we use a `comptime` expression in
an `if` statement to check whether or not our `T` type has a `parse` method.

Next, we use a `switch` on `@typeInfo(T)`, which is a tagged union. The switch
branches are the different tags. The captured value (`|info|`) in the `.Enum`
branch is the payload; in this case, the actual type info of the enum. This
allows us to replace the call to `std.meta.Tag` with simply `info.tag_type`.

We also make use of Zig's labeled break to return a value from a block
expression. The `blk:` label gives a name to the succeeding block, and `break
:blk ...` uses the following value as the value of the block itself. As before,
if `std.meta.intToEnum` encounters an error, the entire function returns an
error. Otherwise, we remove the bytes from our byte slice and return the parsed
value.

Be sure to update the `parse` function in `MachHeader64` to use this new
variant as well:

```zig
/// src/macho.zig

const MachHeader64 = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(parser: *Parser) !MachHeader64 {
        const magic = try parser.parse(u32);
        if (magic != loader.MH_MAGIC_64) {
            return error.BadMagic;
        }

        const cputype = try parser.parse(CpuType);
        const cpusubtype = try parser.parse(CpuSubType);
        const filetype = try parser.parse(Filetype);
        const ncmds = try parser.parse(u32);
        const sizeofcmds = try parser.parse(u32);
        const flags = try parser.parse(Flags);
        const reserved = try parser.parse(u32);

        return Self{
            .magic = magic,
            .cputype = cputype,
            .cpusubtype = cpusubtype,
            .filetype = filetype,
            .ncmds = ncmds,
            .sizeofcmds = sizeofcmds,
            .flags = flags,
            .reserved = reserved,
        };
    }
};
```

With this abstraction in place, we can update `main.zig` again:

```zig
/// src/main.zig

var parser = macho.Parser.init(data);

const header = try parser.parse(macho.MachHeader64);
std.debug.print("{}\n", .{header});
```

This will come in handy as we move on to load commands and begin parsing a
larger variety of data structures.

## Load commands

Let's take a look at our header again:

```console
$ zig-out/bin/macho ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
```

Our header tells us that this Mach-O file has 16 load commands. Each load
command shares two common fields:

```c
struct load_comand {
	uint32_t cmd;
	uint32_t cmdsize;
};
```

The list of possible load commands is defined in `mach-o/loader.h`. Here are
just a few:

```c
/* Constants for the cmd field of all load commands, the type */
#define	LC_SEGMENT	0x1	/* segment of this file to be mapped */
#define	LC_SYMTAB	0x2	/* link-edit stab symbol table info */
#define	LC_SYMSEG	0x3	/* link-edit gdb symbol table info (obsolete) */
#define	LC_THREAD	0x4	/* thread */
#define	LC_UNIXTHREAD	0x5	/* unix thread (includes a stack) */
#define	LC_LOADFVMLIB	0x6	/* load a specified fixed VM shared library */
#define	LC_IDFVMLIB	0x7	/* fixed VM shared library identification */
#define	LC_IDENT	0x8	/* object identification info (obsolete) */
```

Each of these load commands, in turn, has its own struct representation. For
example, here is the definition for the `LC_SEGMENT_64` load command:

```c
/*
 * The 64-bit segment load command indicates that a part of this file is to be
 * mapped into a 64-bit task's address space.  If the 64-bit segment has
 * sections then section_64 structures directly follow the 64-bit segment
 * command and their size is reflected in cmdsize.
 */
struct segment_command_64 { /* for 64-bit architectures */
	uint32_t	cmd;		/* LC_SEGMENT_64 */
	uint32_t	cmdsize;	/* includes sizeof section_64 structs */
	char		segname[16];	/* segment name */
	uint64_t	vmaddr;		/* memory address of this segment */
	uint64_t	vmsize;		/* memory size of this segment */
	uint64_t	fileoff;	/* file offset of this segment */
	uint64_t	filesize;	/* amount to map from the file */
	vm_prot_t	maxprot;	/* maximum VM protection */
	vm_prot_t	initprot;	/* initial VM protection */
	uint32_t	nsects;		/* number of sections in segment */
	uint32_t	flags;		/* flags */
};
```

Converting every load command into a Zig struct is pretty tedious work. If we
were creating a production-ready Mach-O parser, it's something we would need to
do. However, since we're just exploring, we can be lazy and just implement the
load commands that are actually present in our Mach-O file.

First, let's define a struct for the shared load command fields:

```zig
/// src/macho.zig

pub const LoadCommand = struct {
    /// Field definitions
    cmd: Command,
    cmdsize: u32,
};
```

Next we need to define the list of possible commands in a `Command` enum.
Again, feel free to simply copy and paste if you're following along:

```zig
/// src/macho.zig

const Command = enum(u32) {
    segment = 0x1,
    symtab = 0x2,
    symseg = 0x3,
    thread = 0x4,
    unixthread = 0x5,
    loadfvmlib = 0x6,
    idfvmlib = 0x7,
    ident = 0x8,
    fvmfile = 0x9,
    prepage = 0xa,
    dysymtab = 0xb,
    load_dylib = 0xc,
    id_dylib = 0xd,
    load_dylinker = 0xe,
    id_dylinker = 0xf,
    prebound_dylib = 0x10,
    routines = 0x11,
    sub_framework = 0x12,
    sub_umbrella = 0x13,
    sub_client = 0x14,
    sub_library = 0x15,
    twolevel_hints = 0x16,
    prebind_cksum = 0x17,
    load_weak_dylib = (0x18 | loader.LC_REQ_DYLD),
    segment_64 = 0x19,
    routines_64 = 0x1a,
    uuid = 0x1b,
    rpath = (0x1c | loader.LC_REQ_DYLD),
    code_signature = 0x1d,
    segment_split_info = 0x1e,
    reexport_dylib = (0x1f | loader.LC_REQ_DYLD),
    lazy_load_dylib = 0x20,
    encryption_info = 0x21,
    dyld_info = 0x22,
    dyld_info_only = (0x22 | loader.LC_REQ_DYLD),
    load_upward_dylib = (0x23 | loader.LC_REQ_DYLD),
    version_min_macosx = 0x24,
    version_min_iphoneos = 0x25,
    function_starts = 0x26,
    dyld_environment = 0x27,
    main = (0x28 | loader.LC_REQ_DYLD),
    data_in_code = 0x29,
    source_version = 0x2A,
    dylib_code_sign_drs = 0x2B,
    encryption_info_64 = 0x2C,
    linker_option = 0x2D,
    linker_optimization_hint = 0x2E,
    version_min_tvos = 0x2F,
    version_min_watchos = 0x30,
    note = 0x31,
    build_version = 0x32,
    dyld_exports_trie = (0x33 | loader.LC_REQ_DYLD),
    dyld_chained_fixups = (0x34 | loader.LC_REQ_DYLD),
    fileset_entry = (0x35 | loader.LC_REQ_DYLD),
};
```

Just like our `MachHeader64` struct, let's add a `parse` function to
`LoadCommand` that tells our parser how this structure should be parsed.

```zig
/// src/macho.zig

pub const LoadCommand = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(parser: *Parser) !LoadCommand {
        const cmd = try parser.parse(Command);
        const cmdsize = try parser.parse(u32);

        std.debug.print("{}, size: {d}\n", .{cmd, cmdsize});

        return LoadCommand{
            .cmd = cmd,
            .cmdsize = cmdsize,
        };
    }
};
```

We can see that our parser API makes this pretty simple. We no longer need to
think about *how* a `Command` enum is parsed: we just tell our parser to do it.
Similarly, we can now simply use

```zig
parser.parse(LoadCommand)
```

to parse a `LoadCommand` struct. No fuss.

Let's go ahead and add that to `main.zig`.

```zig
/// src/main.zig

var parser = macho.Parser.init(data);

const header = try parser.parse(macho.MachHeader64);
std.debug.print("{}\n", .{header});

var i: usize = 0;
while (i < header.ncmds) : (i += 1) {
    _ = try parser.parse(macho.LoadCommand);
}
```

We know the number of load commands from the header, so we just need to read
each one in a loop. Since we are not using the return value from `parse` (yet),
we need to mark the variable as unused with `_`.

If we try to build and run this, we hit our first error:

```console
$ zig build run -- ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
1095786335 is not a valid value for Command
error: InvalidEnumTag
/opt/zig/lib/zig/std/meta.zig:823:5: 0x102972097 in std.meta.intToEnum (macho)
    return error.InvalidEnumTag;
    ^
/Users/greg/src/gpanders.com/macho/src/macho.zig:44:21: 0x102971633 in macho.Parser
.parse (macho)
                    return err;
                    ^
/Users/greg/src/gpanders.com/macho/src/macho.zig:224:21: 0x102971493 in macho.LoadC
ommand.parse (macho)
        const cmd = try parser.parse(Command);
                    ^
/Users/greg/src/gpanders.com/macho/src/macho.zig:26:20: 0x10296e25f in macho.Parser
.parse (macho)
            return try T.parse(self);
                   ^
/Users/greg/src/gpanders.com/macho/src/main.zig:40:30: 0x10296d7c7 in main (macho)
        const load_command = try parser.parse(macho.LoadCommand);
                             ^
```

It looks like we tried to convert an invalid int (`1095786335`) into our
`Command` enum. That enum doesn't have a value that corresponds to that
number, so `std.meta.intToEnum` threw an error.

Do you see where we went wrong? We tried parsing load commands successively, as
if they were neatly laid out in an contiguous array in the Mach-O file.
However, the file format reference tells us that each `LoadCommand` struct is
followed by more fields depending on the type of command. Further, individual
commands may themselves be followed by more data.

The `LoadCommand` struct conveniently tells us the size in bytes of each load
command. For now, we can simply use this number to skip over the rest of the
load command so that we can read each of the load command headers present in
the file.

Let's add a `skip` method to our parser:

```zig
/// src/macho.zig

pub const Parser = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn init(...) { ... }
    pub fn parse(...) { ... }

    pub fn skip(self: *Parser, n: usize) !void {
        if (self.data.len < n) {
            return error.NotEnoughBytes;
        }

        self.data = self.data[n..];
    }
};
```

This is a pretty simple function. Hopefully it's self explanatory.

Now let's add this to `LoadCommand.parse`:

```zig
/// src/macho.zig

pub const LoadCommand = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(parser: *Parser) !LoadCommand {
        const cmd = try parser.parse(Command);
        const cmdsize = try parser.parse(u32);

        try parser.skip(cmdsize);

        return LoadCommand{
            .cmd = cmd,
            .cmdsize = cmdsize,
        };
    }
};
```

Let's build and run:

```console
$ zig build run -- ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
1163157343 is not a valid value for Command
error: InvalidEnumTag
/opt/zig/lib/zig/std/meta.zig:823:5: 0x10492209b in std.meta.intToEnum (macho)
    return error.InvalidEnumTag;
    ^
/Users/greg/src/gpanders.com/macho/src/macho.zig:44:21: 0x104921637 in macho.Parser
.parse (macho)
                    return err;
                    ^
/Users/greg/src/gpanders.com/macho/src/macho.zig:224:21: 0x104921497 in macho.LoadC
ommand.parse (macho)
        const cmd = try parser.parse(Command);
                    ^
/Users/greg/src/gpanders.com/macho/src/macho.zig:26:20: 0x10491e18b in macho.Parser
.parse (macho)
            return try T.parse(self);
                   ^
/Users/greg/src/gpanders.com/macho/src/main.zig:40:30: 0x10491d67f in main (macho)
        const load_command = try parser.parse(macho.LoadCommand);
                             ^
```

Agh! We are still getting an "invalid value for Command" error. What gives?

There is a subtle mistake in our logic. Do you see it? The `cmdsize` field of
the `LoadCommand` struct gives the total size of the load command in bytes,
**including** the common fields in the `LoadCommand` struct itself. When we
skip over `cmdsize` bytes, we are skipping too far, because we are counting the
8 bytes of the `LoadCommand` struct twice.

Easy fix:

```zig
try parser.skip(cmdsize - @sizeOf(LoadCommand));
```

Let's try again:

```console
$ zig build run -- ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 232 }
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
LoadCommand{ .cmd = Command.dyld_chained_fixups, .cmdsize = 16 }
LoadCommand{ .cmd = Command.dyld_exports_trie, .cmdsize = 16 }
LoadCommand{ .cmd = Command.symtab, .cmdsize = 24 }
LoadCommand{ .cmd = Command.dysymtab, .cmdsize = 80 }
LoadCommand{ .cmd = Command.load_dylinker, .cmdsize = 32 }
LoadCommand{ .cmd = Command.uuid, .cmdsize = 24 }
LoadCommand{ .cmd = Command.build_version, .cmdsize = 32 }
LoadCommand{ .cmd = Command.source_version, .cmdsize = 16 }
LoadCommand{ .cmd = Command.main, .cmdsize = 24 }
LoadCommand{ .cmd = Command.load_dylib, .cmdsize = 56 }
LoadCommand{ .cmd = Command.function_starts, .cmdsize = 16 }
LoadCommand{ .cmd = Command.data_in_code, .cmdsize = 16 }
LoadCommand{ .cmd = Command.code_signature, .cmdsize = 16 }
```

Look at that! We now have a list of all of the load commands present in our
Mach-O file.

We're not necessarily interested in parsing all of these load commands, but
we'll certainly want to take a deeper look at the `segment_64` sections. The
commands we don't care about we can simply `skip` over, but for those we do, we
will need to define structs to represent their data.

Let's start with `segment_64`. The Mach-O headers define the following struct:

```c
struct segment_command_64 { /* for 64-bit architectures */
	uint32_t	cmd;		/* LC_SEGMENT_64 */
	uint32_t	cmdsize;	/* includes sizeof section_64 structs */
	char		segname[16];	/* segment name */
	uint64_t	vmaddr;		/* memory address of this segment */
	uint64_t	vmsize;		/* memory size of this segment */
	uint64_t	fileoff;	/* file offset of this segment */
	uint64_t	filesize;	/* amount to map from the file */
	vm_prot_t	maxprot;	/* maximum VM protection */
	vm_prot_t	initprot;	/* initial VM protection */
	uint32_t	nsects;		/* number of sections in segment */
	uint32_t	flags;		/* flags */
};
```

We will omit the first two common fields from our struct to arrive at:

```zig
/// src/macho.zig

const SegmentCommand64 = packed struct {
    segname: [16]u8,
    vmaddr: u64,
    vmsize: u64,
    fileoff: u64,
    filesize: u64,
    maxprot: VmProt,
    initprot: VmProt,
    nsects: u32,
    flags: SegmentCommandFlags,
};
```

Notice that we mark this struct as `packed`. This forces the memory layout of
this struct to match the order that we specified here. This will allow us to
safely parse an array of bytes into this struct without needing to define a
`parse()` function and have each field line up nicely. We don't need to use a
`parse()` function in this case since there are no enum fields that we need to
validate.

This also requires us to define the `VmProt` and `SegmentCommandFlags` structs.
These are both bitfields, so we again use `packed struct`s with boolean fields:

```zig
/// src/macho.zig

const VmProt = packed struct {
    read: bool,
    write: bool,
    execute: bool,
    _: u29, // pad to 32 bits
};

const SegmentCommandFlags = packed struct {
    highvm: bool,
    fvmlib: bool,
    noreloc: bool,
    protected_version_1: bool,
    read_only: bool,
    _: u27, // pad to 32 bits
};
```

Each segment contains a number of sections, determined by the `nsects` field of
`SegmentCommand64`. A section looks like this:

```zig
/// src/macho.zig

const Section64 = packed struct {
    sectname: [16]u8,
    segname: [16]u8,
    addr: u64,
    size: u64,
    offset: u32,
    @"align": u32,
    reloff: u32,
    nreloc: u32,
    flags: u32,
    reserved1: u32,
    reserved2: u32,
    reserved3: u32,
};
```

Note the syntax for `@"align"`. This is necessary because `align` is a keyword
in Zig. The `@""` syntax lets us use arbitrary identifiers for variables and
struct fields, which gets us around this restriction.

Similar to what we did with `MachHeader64` we can implement a public `format`
function for `SegmentCommand64` and `Section64` to improve how these structs
are printed out (I leave this as an exercise for the reader).

Let's update `LoadCommand.parse` with these new data structures:

```zig
/// src/macho.zig

pub const LoadCommand = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(parser: *Parser) !LoadCommand {
        const cmd = try parser.parse(Command);
        const cmdsize = try parser.parse(u32);

        switch (cmd) {
            .segment_64 => {
                const segment_command_64 = try parser.parse(SegmentCommand64);
                std.debug.print("{}\n", .{segment_command_64});

                var i: usize = 0;
                while (i < segment_command_64.nsects) : (i += 1) {
                    const section = try parser.parse(Section64);
                    std.debug.print("{}\n", .{section});
                }
            },
            else => try parser.skip(cmdsize - @sizeOf(LoadCommand)),
        }

        return LoadCommand{
            .cmd = cmd,
            .cmdsize = cmdsize,
        };
    }
};
```

When we build and run this, we see a lot of information about our executable's
segments and sections!

```console
$ zig build run -- ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
segname: __PAGEZERO
vmaddr: 0x0
vmsize: 0x100000000
fileoff: 0x0
filesize: 0x0
maxprot: VmProt{ .read = false, .write = false, .execute = false, ._ = 0 }
initprot: VmProt{ .read = false, .write = false, .execute = false, ._ = 0 }
nsects: 0
flags:
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 232 }
segname: __TEXT
vmaddr: 0x100000000
vmsize: 0x4000
fileoff: 0x0
filesize: 0x4000
maxprot: VmProt{ .read = true, .write = false, .execute = true, ._ = 0 }
initprot: VmProt{ .read = true, .write = false, .execute = true, ._ = 0 }
nsects: 2
flags:
segname: __TEXT
sectname: __text
addr: 0x100003fa0
size: 0xc
offset: 16288
align: 2^4 (16)
reloff: 0
nreloc: 0
flags: 0x80000400

segname: __TEXT
sectname: __unwind_info
addr: 0x100003fac
size: 0x48
offset: 16300
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x0

LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
segname: __LINKEDIT
vmaddr: 0x100004000
vmsize: 0x4000
fileoff: 0x4000
filesize: 0x1c1
maxprot: VmProt{ .read = true, .write = false, .execute = false, ._ = 0 }
initprot: VmProt{ .read = true, .write = false, .execute = false, ._ = 0 }
nsects: 0
flags:
LoadCommand{ .cmd = Command.dyld_chained_fixups, .cmdsize = 16 }
LoadCommand{ .cmd = Command.dyld_exports_trie, .cmdsize = 16 }
LoadCommand{ .cmd = Command.symtab, .cmdsize = 24 }
LoadCommand{ .cmd = Command.dysymtab, .cmdsize = 80 }
LoadCommand{ .cmd = Command.load_dylinker, .cmdsize = 32 }
LoadCommand{ .cmd = Command.uuid, .cmdsize = 24 }
LoadCommand{ .cmd = Command.build_version, .cmdsize = 32 }
LoadCommand{ .cmd = Command.source_version, .cmdsize = 16 }
LoadCommand{ .cmd = Command.main, .cmdsize = 24 }
LoadCommand{ .cmd = Command.load_dylib, .cmdsize = 56 }
LoadCommand{ .cmd = Command.function_starts, .cmdsize = 16 }
LoadCommand{ .cmd = Command.data_in_code, .cmdsize = 16 }
LoadCommand{ .cmd = Command.code_signature, .cmdsize = 16 }
```

The first segment is called `__PAGEZERO` and has no sections. Next is the
`__TEXT` segment, which contains two sections: `__text` and `__unwind_info`.
Hey, `__TEXT,__text` sure looks familiar...

```console
$ objdump -d ../exit

../exit:        file format mach-o arm64


Disassembly of section __TEXT,__text:

0000000100003fa0 <_main>:
100003fa0: 40 05 80 d2  mov     x0, #42
100003fa4: 30 00 80 d2  mov     x16, #1
100003fa8: 01 10 00 d4  svc     #0x80
```

That's right, that's the text section of our binary and where the actual
machine instructions live! According to our `macho` parser, the `__text`
section is `0xc` (12) bytes long and starts at offset 16288 in our file. Let's
check this for ourselves with `xxd`:

```console
$ xxd -s 16288 -l 12 ../exit
00003fa0: 4005 80d2 3000 80d2 0110 00d4            @...0.......
```

Those are the machine instructions, exactly as we expect.

## Going further

Back in the beginning I mentioned that a Mach-O file has the basic structure of
a header, followed by load commands, followed by segments. If we continue to
parse bytes past the last load command, what will we find?

First, it will be useful to keep track of how many bytes we've parsed in our
parser, which will tell us the current offset in the file. Let's add a new
`offset` field to the `Parser` struct and update it in the `parse()` and
`skip()` functions:

```zig
/// src/macho.zig

pub const Parser = struct {
    /// Field definitions
    data: []const u8,
    offset: usize = 0, // NEW!

    /// Functions
    pub fn parse(self: *Parser, comptime T: type) !T {
        ...

        self.data = self.data[size..];
        self.offset += size; // NEW!
        return val;
    }

    pub fn skip(self: *Self, n: usize) !void {
        ...

        self.data = self.data[n..];
        self.offset += n; // NEW!
    }
};
```

And now everywhere we print a parsed value we can also print the parser's
offset:

```zig
/// src/macho.zig

pub const LoadCommand = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn parse(parser: *Parser) !LoadCommand {
        const cmd = try parser.parse(Command);
        const cmdsize = try parser.parse(u32);

        std.debug.print("0x{x}: {}, size: {d}\n", .{
            parser.offset,
            cmd,
            cmdsize,
        });

        switch (cmd) {
            .segment_64 => {
                const segment_command_64 = try parser.parse(SegmentCommand64);
                std.debug.print("0x{x}: {}\n", .{ parser.offset, segment_command_64 });

                var j: usize = 0;
                while (j < segment_command_64.nsects) : (j += 1) {
                    const section = try parser.parse(Section64);
                    std.debug.print("0x{x}: {}\n", .{ parser.offset, section });
                }
            },
            else => try parser.skip(cmdsize - @sizeOf(LoadCommand)),
        }

        return LoadCommand{
            .cmd = cmd,
            .cmdsize = cmdsize,
        };
    }
};
```

When we run this we can see how much space the header and load commands take
together:

```bash
$ zig build run -- ../exit
# truncated output...
0x1a0: Command.dyld_chained_fixups, size: 16
0x1b0: Command.dyld_exports_trie, size: 16
0x1c0: Command.symtab, size: 24
0x1d8: Command.dysymtab, size: 80
0x228: Command.load_dylinker, size: 32
0x248: Command.uuid, size: 24
0x260: Command.build_version, size: 32
0x280: Command.source_version, size: 16
0x290: Command.main, size: 24
0x2a0: EntryPointCommand{ .entryoff = 16288, .stacksize = 0 }
0x2a8: Command.load_dylib, size: 56
0x2e0: Command.function_starts, size: 16
0x2f0: Command.data_in_code, size: 16
0x300: Command.code_signature, size: 16
```

The last load command starts at 0x300 and then takes another 8 bytes (16 bytes
is the command size, minus 8 bytes for the common fields). This puts us at
offset 776 (0x308). But of course, we already knew this because the header told
us that the load commands were 744 bytes long, and the header itself is 32
bytes.

So what comes after `0x308`?

```bash
$ xxd -s $((0x308)) -l 32 ../exit
00000308: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000318: 0000 0000 0000 0000 0000 0000 0000 0000  ................
```

Hmm, just a bunch of zeros. Let's try reading some more:

```bash
$ xxd -s $((0x308)) -l 64 ../exit
00000308: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000318: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000328: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000338: 0000 0000 0000 0000 0000 0000 0000 0000  ................
```

Still just zeros! How many zeros are there exactly? Let's count:

```zig
/// src/main.zig

var i: usize = 0;
while (i < header.ncmds) : (i += 1) {
    _ = try parser.parse(macho.LoadCommand);
}

// NEW!
while (true) {
    var word = try parser.parse(u32);
    if (word != 0) break;
}

std.debug.print("Next non-zero byte starts at 0x{x}\n", .{parser.offset - @sizeOf(u32)});
```

```bash
$ zig build run -- ../exit
Next non-zero byte starts at 0x3fa0
```

So every byte from 0x308 to 0x3fa0 is zero (we recognize `0x3fa0` as the start
of the `__text` section). That's 15512 bytes worth of zeros! What's going on?

The Mach-O segments are page aligned and the page size on ARM64 macOS is 16 KiB
(`0x4000`). The header and load commands are considered part of the first
segment, which is shared with the `__TEXT` segment[^4].

I could not find any official documentation stating this, but my hypothesis is
that the segment is laid out by summing the size of all of the sections within
the `__TEXT` segment and then subtracting that from the nearest page boundary.
The space between the end of the load commands and the first section (`__text`)
is then filled with zeros.

For example, our `exit` program has two sections in the `__TEXT` segment:
`__text` and `__unwind_info`. The sizes of these sections are 12 (`0xc`) bytes
and 72 (`0x48`) bytes respectively, or 84 bytes total. The total size of all of
the load commands is 744 bytes (from the header), plus the 32 bytes of the
header itself. Adding all of these up we get 84 + 744 + 32 = 860. Rounding to
the nearest page boundary gets us to 16384 (0x4000). Subtracting the size of
the `__unwind_info` section (72) puts us at 0x3fb8, which is 12 bytes off from
the actual start of the `__unwind_info` section, 0x3fac. To be honest I'm not
sure where that 12 byte difference is coming from. If you know, [please send me
an email](mailto:contact@gpanders.com).

We can check this theory against another Mach-O file: the `macho` executable
itself. If we run `macho` on `macho` we see the following information (filtered
out to only the relevant parts):

```bash
$ zig-out/bin/macho zig-out/bin/macho
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 17
sizeofcmds: 1784
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE HAS_TLV_DESCRIPTORS
0x28: Command.segment_64, size: 72
0xb0: segname: __TEXT
vmaddr: 0x100000000
vmsize: 0x90000
fileoff: 0x0
filesize: 0x90000
maxprot: VmProt{ .read = true, .write = false, .execute = true, ._ = 0 }
initprot: VmProt{ .read = true, .write = false, .execute = true, ._ = 0 }
nsects: 5
flags:
0x100: segname: __TEXT
sectname: __text
addr: 0x1000018f8
size: 0x7ed54
offset: 6392
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x80000400

0x150: segname: __TEXT
sectname: __stubs
addr: 0x10008064c
size: 0x138
offset: 525900
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x80000408

0x1a0: segname: __TEXT
sectname: __stub_helper
addr: 0x100080784
size: 0x150
offset: 526212
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x80000400

0x1f0: segname: __TEXT
sectname: __cstring
addr: 0x1000808d4
size: 0x987
offset: 526548
align: 2^0 (1)
reloff: 0
nreloc: 0
flags: 0x2

0x240: segname: __TEXT
sectname: __const
addr: 0x100081260
size: 0xeda0
offset: 528992
align: 2^4 (16)
reloff: 0
nreloc: 0
flags: 0x0

Next non-zero byte starts at 0x18f8
```

The size of the commands is 1784 bytes, the size of the `__text` section is
519508 (0x7ed54) bytes, `__stubs` is 312 (0x138) bytes, `__stub_helper` is 336
(0x150) bytes, `__cstring` is 2439 (0x987) bytes, and `__const` is 60832
(0xeda0) bytes. Combined, the `__TEXT` segment is 583427 (0x8e703) bytes. When
we add the 1784 bytes from the load commands and 32 bytes from the header, the
total size of the first segment is 585243 (0x8ee1b) bytes. The nearest page
boundary is then 0x90000, which is what we see for the `filesize` field of the
`__TEXT` segment.

If we subtract 0x8e703 from 0x90000 we get 0x18fd. This is close to the first
non-zero byte at 0x18f8, but doesn't quite match. In this case, however, we
know why: each section within the `__TEXT` segment has its own alignment, so
there are some wasted bytes in between the different sections to maintain that
alignment. When we account for these bytes, we get the expected start value of
0x18f8.

So that explains the mystery zeros: page alignment!

The next segment, `__LINKEDIT` is mandated to always be the last segment.
Because segments are always aligned to page boundaries, this segment begins at
`0x4000`. According to the load command, this segment is 449 (0x1c1) bytes
long. According to the Mach-O file format reference, the `__LINKEDIT` segment
contains "raw data used by the dynamic linker, such as symbol, string, and
relocation table entries".

This is the very end of our file. Indeed, if we open `exit` in a hex editor, we
see that byte `0x41c1` is the very last byte.

We did it! We parsed our entire `exit` Mach-O executable, and learned a lot
along the way.

## Conclusion

<!--
Let's
take a look:

```console
$ xxd -s 16288 -l 12 ../exit
00003fa0: 400580d2 300080d2 011000d4           @...0.......
```

Sure enough, those are our 3 instructions!

Noticably absent from our executable is a `__DATA` segment. This is not
surprising given how simple our `exit` program is. Let's see if we can conjure
up an executable file that has one:

```c
/// print.c

#include <stdio.h>

static int x = 42;

int main(void)
{
	printf("x is %d\n", x);
        return 0;
}
```

Now let's compile and link `print.c`:

```console
$ cc -o print print.c
```

And run `macho` on it:

```console
$ zig-out/bin/macho ../print
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: CpuSubType.little_endian
filetype: Filetype.execute
ncmds: 18
sizeofcmds: 1208
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
segname: __PAGEZERO
vmaddr: 0x0
vmsize: 0x100000000
fileoff: 0x0
filesize: 0x0
maxprot: VmProt{ .read = false, .write = false, .execute = false, ._ = 0 }
initprot: VmProt{ .read = false, .write = false, .execute = false, ._ = 0 }
nsects: 0
flags:
LoadCommand{ .cmd = Command.segment_64, .cmdsize = 392 }
segname: __TEXT
vmaddr: 0x100000000
vmsize: 0x4000
fileoff: 0x0
filesize: 0x4000
maxprot: VmProt{ .read = true, .write = false, .execute = true, ._ = 0 }
initprot: VmProt{ .read = true, .write = false, .execute = true, ._ = 0 }
nsects: 4
flags:
segname: __TEXT
sectname: __text
addr: 0x100003f58
size: 0x48
offset: 16216
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x80000400

segname: __TEXT
sectname: __stubs
addr: 0x100003fa0
size: 0xc
offset: 16288
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x80000408

segname: __TEXT
sectname: __cstring
addr: 0x100003fac
size: 0x9
offset: 16300
align: 2^0 (1)
reloff: 0
nreloc: 0
flags: 0x2

segname: __TEXT
sectname: __unwind_info
addr: 0x100003fb8
size: 0x48
offset: 16312
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x0

LoadCommand{ .cmd = Command.segment_64, .cmdsize = 152 }
segname: __DATA_CONST
vmaddr: 0x100004000
vmsize: 0x4000
fileoff: 0x4000
filesize: 0x4000
maxprot: VmProt{ .read = true, .write = true, .execute = false, ._ = 0 }
initprot: VmProt{ .read = true, .write = true, .execute = false, ._ = 0 }
nsects: 1
flags: read_only
segname: __DATA_CONST
sectname: __got
addr: 0x100004000
size: 0x8
offset: 16384
align: 2^3 (8)
reloff: 0
nreloc: 0
flags: 0x6

LoadCommand{ .cmd = Command.segment_64, .cmdsize = 152 }
segname: __DATA
vmaddr: 0x100008000
vmsize: 0x4000
fileoff: 0x8000
filesize: 0x4000
maxprot: VmProt{ .read = true, .write = true, .execute = false, ._ = 0 }
initprot: VmProt{ .read = true, .write = true, .execute = false, ._ = 0 }
nsects: 1
flags:
segname: __DATA
sectname: __data
addr: 0x100008000
size: 0x4
offset: 32768
align: 2^2 (4)
reloff: 0
nreloc: 0
flags: 0x0

LoadCommand{ .cmd = Command.segment_64, .cmdsize = 72 }
segname: __LINKEDIT
vmaddr: 0x10000c000
vmsize: 0x4000
fileoff: 0xc000
filesize: 0x322
maxprot: VmProt{ .read = true, .write = false, .execute = false, ._ = 0 }
initprot: VmProt{ .read = true, .write = false, .execute = false, ._ = 0 }
nsects: 0
flags:
LoadCommand{ .cmd = Command.dyld_chained_fixups, .cmdsize = 16 }
LoadCommand{ .cmd = Command.dyld_exports_trie, .cmdsize = 16 }
LoadCommand{ .cmd = Command.symtab, .cmdsize = 24 }
LoadCommand{ .cmd = Command.dysymtab, .cmdsize = 80 }
LoadCommand{ .cmd = Command.load_dylinker, .cmdsize = 32 }
LoadCommand{ .cmd = Command.uuid, .cmdsize = 24 }
LoadCommand{ .cmd = Command.build_version, .cmdsize = 32 }
LoadCommand{ .cmd = Command.source_version, .cmdsize = 16 }
LoadCommand{ .cmd = Command.main, .cmdsize = 24 }
LoadCommand{ .cmd = Command.load_dylib, .cmdsize = 56 }
LoadCommand{ .cmd = Command.function_starts, .cmdsize = 16 }
LoadCommand{ .cmd = Command.data_in_code, .cmdsize = 16 }
LoadCommand{ .cmd = Command.code_signature, .cmdsize = 16 }
```

There is a lot more going on here. In addition to the `__text` section from
before, the `__TEXT` segment now also contains `__cstring` and `__stubs`
sections. We also now see a `__DATA` segment that contains a `__data` section.
Unsurprisingly, we find the number 42 (`2a` in hex) there:

```console
$ xxd -s 32768 -l 4 -e ../print
00008000: 0000002a                             *...
```

We can also take a peek at the `__cstring` section in the `__TEXT` segment:

```console
$ xxd -s 16300 -l 9 -e ../print
00003fac: 73692078 0a642520       00           x is %d..
```

And there we see the string that we passed to `printf`.

## The rest of the journey

We can follow this same pattern for the remainder of the load commands. For
instance, we can quite easily view the `uuid_command` by simply adding a new
struct:

```zig
/// src/macho.zig

pub const UuidCommand = packed struct {
    uuid: [16]u8,
};
```

Now we just add a new arm to the `switch` statement in `main.zig`:

```zig
/// src/main.zig


switch (load_command.cmd) {
    .segment_64 => {
        ...
    },
    .uuid => {
        const uuid_command = try parser.parse(macho.UuidCommand);
        std.debug.print("{}\n", .{uuid_command});
    },
    else => try parser.skip(load_command.cmdsize - @sizeOf(macho.LoadCommand)),
}
```
-->

[^1]: Requires the [Command Line Tools for Xcode][command line tools].

[^2]: By the way, since this path is painfully long to both read and write, for
the remainder of this article I'm going to pretend there is an imaginary
symlink from `/Library/Developer/CommandLineTools/SDKs/usr/include` to
`/usr/include`. So any references to `/usr/include/*` are actually under the
full path.

[^3]: Full disclosure: I first tried writing the parser in Rust, similar to the
ELF parser used by [fasterthanli.me][]. However, I found the experience pretty
frustrating. I don't want to put all the blame on Rust, as it's extremely
likely that I just wasn't approaching the task in an idiomatic way, but it felt
like the language was fighting me at every turn (and I don't mean the borrow
checker: that part I have no trouble with). After battling to get something
working for a couple of days, I finally gave up and did it in Zig and had
something working in under an hour.

[^4]: Technically, `__PAGEZERO` is the first segment, which maps an empty
region of zeros in the virtual address range `0x0` to `0x100000000`. However,
this segment takes no space in the on-disk file, so the "first segment" is
actually the segment that comes after it (`__TEXT`).


[fasterthanli.me]: https://fasterthanli.me/series/making-our-own-executable-packer/part-1
[syscall]: https://developer.arm.com/documentation/102374/0101/System-calls?lang=en
[command line tools]: https://developer.apple.com/download/more/
[mach-o reference]: https://web.archive.org/web/20090901205800/http://developer.apple.com/mac/library/documentation/DeveloperTools/Conceptual/MachORuntime/Reference/reference.html#//apple_ref/c/tag/section_64
