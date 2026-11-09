---
title: "Exploring Mach-O, Part 3"
date: 2022-01-16T19:13:51-07:00
tags: [mach-o, macos, zig]
---

*This is part 3 of a 4 part series exploring the structure of the Mach-O file
format. Here are links to [part 1](/blog/exploring-mach-o-part-1/), [part 2](/blog/exploring-mach-o-part-2/), and [part 4](/blog/exploring-mach-o-part-4/).*

We left off with a basic parser that is able to parse the Mach-O header from
our file. Now that the bones of our parser are fleshed out, it should be fairly
straightforward to parse the rest of the file.

## Load commands

Let's take a look at our header again:

```console
$ zig-out/bin/macho ../exit
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: 0x0
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
cpusubtype: 0x0
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
Command.segment_64, size: 72
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
cpusubtype: 0x0
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
Command.segment_64, size: 72
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
cpusubtype: 0x0
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
Command.segment_64, size: 72
Command.segment_64, size: 232
Command.segment_64, size: 72
Command.dyld_chained_fixups, size: 16
Command.dyld_exports_trie, size: 16
Command.symtab, size: 24
Command.dysymtab, size: 80
Command.load_dylinker, size: 32
Command.uuid, size: 24
Command.build_version, size: 32
Command.source_version, size: 16
Command.main, size: 24
Command.load_dylib, size: 56
Command.function_starts, size: 16
Command.data_in_code, size: 16
Command.code_signature, size: 16
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
cpusubtype: 0x0
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
Command.segment_64, size: 72
segname: __PAGEZERO
vmaddr: 0x0
vmsize: 0x100000000
fileoff: 0x0
filesize: 0x0
maxprot: VmProt{ .read = false, .write = false, .execute = false, ._ = 0 }
initprot: VmProt{ .read = false, .write = false, .execute = false, ._ = 0 }
nsects: 0
flags:
Command.segment_64, size: 232
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

Command.segment_64, size: 72
segname: __LINKEDIT
vmaddr: 0x100004000
vmsize: 0x4000
fileoff: 0x4000
filesize: 0x1c1
maxprot: VmProt{ .read = true, .write = false, .execute = false, ._ = 0 }
initprot: VmProt{ .read = true, .write = false, .execute = false, ._ = 0 }
nsects: 0
flags:
Command.dyld_chained_fixups, size: 16
Command.dyld_exports_trie, size: 16
Command.symtab, size: 24
Command.dysymtab, size: 80
Command.load_dylinker, size: 32
Command.uuid, size: 24
Command.build_version, size: 32
Command.source_version, size: 16
Command.main, size: 24
Command.load_dylib, size: 56
Command.function_starts, size: 16
Command.data_in_code, size: 16
Command.code_signature, size: 16
```

The first segment is called `__PAGEZERO` and has no sections. It also has both
its `fileoff` and `filesize` fields set to 0, suggesting that the `__PAGEZERO`
segment is not actually present in the on-disk file. Rather, it represents a
region of virtual memory that the operating system will create when the program
is loaded. Indeed, we see that this segment's `vmaddr` field is 0 and its
`vmsize` field is `0x100000000`. This means that the first `0x100000000` bytes
of virtual memory in our program will simply be zero. This is done
intentionally to catch null pointer dereferences.

Next is the `__TEXT` segment. This segment's `fileoff` field is also 0, but
this time it has a non-zero size of `0x4000` or 16 KiB. This tells us that the
`__TEXT` segment starts at the very beginning of the file. We'll come back to
this a little bit later.

The `vmaddr` of the `__TEXT` segment starts at `0x100000000`, immediately after
the `__PAGEZERO` segment. When the operating system loads this program, it will
map the region between `0x0` and `0x4000` of this file to the *virtual* memory
range between `0x100000000` and `0x100004000`. We also see that the protection
flags for this segment are set to read and execute, but not write, which is
what we would expect from a section containing executable machine instructions.

The `__TEXT` segment contains two sections: `__text` and `__unwind_info`. Hey,
`__TEXT,__text` sure looks familiar...

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

    pub fn skip(self: *Parser, n: usize) !void {
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

```console
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

```console
$ xxd -s $((0x308)) -l 32 ../exit
00000308: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000318: 0000 0000 0000 0000 0000 0000 0000 0000  ................
```

Hmm, just a bunch of zeros. Let's try reading some more:

```console
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

```console
$ zig build run -- ../exit
Next non-zero byte starts at 0x3fa0
```

So every byte from `0x308` to `0x3fa0` is zero (we recognize `0x3fa0` as the
start of the `__text` section). That's 15512 bytes worth of zeros! What's going
on?

The Mach-O segments are page aligned and the page size on ARM64 macOS is 16 KiB
(`0x4000`). The header and load commands are considered part of the first
segment, which in this case is the `__TEXT` segment[^1]. This makes sense,
since the `fileoff` field (which represents the start offset in the actual
on-disk file of the segment) the `__TEXT` segment is 0, which is exactly where
the header is.

I could not find any official documentation stating this, but my hypothesis is
that the starting offset of the first section in the `__TEXT` segment is
calculated by summing the size of all of the sections within the `__TEXT`
segment and then subtracting that from the nearest page boundary. The space
between the end of the load commands and the first section (`__text`) is then
filled with zeros.

For example, our `exit` program has two sections in the `__TEXT` segment:
`__text` and `__unwind_info`. The sizes of these sections are 12 (`0xc`) bytes
and 72 (`0x48`) bytes respectively, or 84 bytes total. The total size of all of
the load commands is 744 bytes (from the header), plus the 32 bytes of the
header itself. Adding all of these up we get 84 + 744 + 32 = 860. Rounding to
the nearest page boundary gets us to 16384 (`0x4000`). Subtracting the size of
the `__unwind_info` section (72) puts us at `0x3fb8`, which is 12 bytes off from
the actual start of the `__unwind_info` section, `0x3fac`. To be honest I'm not
sure where that 12 byte difference is coming from. If you know, [please send me
an email](mailto:contact@gpanders.com).

We can check this theory against another Mach-O file: the `macho` executable
itself. If we run `macho` on `macho` we see the following information (filtered
out to only the relevant parts):

```console
$ zig-out/bin/macho zig-out/bin/macho
magic: 0xfeedfacf
cputype: CpuType.arm64
cpusubtype: 0x0
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
519508 (`0x7ed54`) bytes, `__stubs` is 312 (`0x138`) bytes, `__stub_helper` is 336
(`0x150`) bytes, `__cstring` is 2439 (`0x987`) bytes, and `__const` is 60832
(`0xeda0`) bytes. Combined, the `__TEXT` sections are 583427 (`0x8e703`) bytes. When
we add the 1784 bytes from the load commands and 32 bytes from the header, the
total size of the first segment is 585243 (`0x8ee1b`) bytes. The nearest page
boundary is then `0x90000`, which is what we see for the `filesize` field of the
`__TEXT` segment.

If we subtract `0x8e703` from `0x90000` we get `0x18fd`. This is close to the first
non-zero byte at `0x18f8`, but doesn't quite match. In this case, however, we
know why: each section within the `__TEXT` segment has its own alignment, so
there are some wasted bytes in between the different sections to maintain that
alignment. When we account for these bytes, we get the expected start value of
`0x18f8`.

So that explains the mystery zeros: page alignment!

Let's go back to our `exit` program. After the `__TEXT` segment is
`__LINKEDIT`, which is mandated to always be the last segment. Because segments
are always aligned to page boundaries, this segment begins at `0x4000`.
According to the load command, this segment is 449 (`0x1c1`) bytes long. The
Mach-O file format reference tells us that the `__LINKEDIT` segment contains
"raw data used by the dynamic linker, such as symbol, string, and relocation
table entries".

This is the very end of our file, which we can confirm with `stat`:

```console
$ stat -f '%#Xz' exit
0x41c1
```

We've reached the end of our Mach-O file! The file was arranged exactly as we
expected: a header, followed by a sequence of load commands, followed by the
actual segments. We ignored most of the load commands, and our simple program
only had two actual segments, so there wasn't much to look at. In a larger or
more complex program, we would find a lot more.

In the [next and final part](/blog/exploring-mach-o-part-4/),
we'll do a recap of what we learned and discuss some other things we could try
if we wanted to dig further.

[^1]: Technically, `__PAGEZERO` is the first segment, which maps an empty
region of zeros in the virtual address range `0x0` to `0x100000000`. However,
this segment takes no space in the on-disk file, so the "first segment" is
actually the segment that comes after it (`__TEXT`).
