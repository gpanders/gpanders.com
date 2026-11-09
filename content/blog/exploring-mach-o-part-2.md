---
title: "Exploring Mach-O, Part 2"
date: 2022-01-16T19:13:50-07:00
tags:
  - mach-o
  - macos
  - zig
---

*This is part 2 of a 4 part series exploring the structure of the Mach-O file
format. Here are links to [part 1](/blog/exploring-mach-o-part-1/), [part 3](/blog/exploring-mach-o-part-3/), and [part 4](/blog/exploring-mach-o-part-4/).*

Last time, we created our own tiny Mach-O executable. This program doesn't do
anything useful, it's simply the smallest executable we can use to examine what
the Mach-O file format looks like.

From here on, we'll write our own primitive parser to examine the contents of
our program. I'm going to write my Mach-O parser in Zig. Why Zig? Mostly
because I really like it and I find it's quite easy to get simple things like
this up and running. It's also particularly well suited to tasks like this[^1].

**Note to readers in the future**: it's important to note that Zig does not yet
have a stable 1.0 release. While at this point the language itself is fairly
stable, the standard library often has breaking changes. I'll do my best to
keep the code in this article up-to-date, but be warned that it may not work by
the time you read it. You can find the full source code on
[sourcehut](https://codeberg.org/gpanders/macho).

First things first, let's bootstrap an executable:

```console
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
pub const Parser = struct {
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

pub const Parser = struct {
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

pub const Parser = struct {
    /// Field definitions
    ...

    /// Functions
    pub fn init(...) { ... }

    pub fn parseLiteral(self: *Parser, comptime T: type) !T {

    }
};
```

Let's explain what's going on here. The first argument to our function is a
pointer to a `*Parser` object. Because this function is defined within the
`Parser` struct itself, Zig treats this argument as a "receiver", meaning we
can use standard method call syntax (e.g. `parser.parseLiteral()`). The object on
which this method is called is used as the first argument (`self`). We use a
pointer to `Parser` because this function will mutate the parser object (by
removing bytes from the `data` byte slice).

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

There are also no lifetime concerns here: `bytesToValue` creates a copy of the
bytes being interpreted, but even if it didn't, the byte slice that our parser
is operating under has the same lifetime as our program since it is created in
`main()` and is not released until the program exits.

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

```console
$ zig build
```

If it compiles without error (which it should), the `macho` executable can be
found at `zig-out/bin/macho`:

```console
$ zig-out/bin/macho
Missing required argument: FILENAME
error: MissingArgument
/Users/greg/src/gpanders.com/macho/src/main.zig:13:9: 0x104f6bb9f in main (macho)
        return error.MissingArgument;
        ^
```

As expected, we get a `MissingArgument` error since we did not supply a
required argument. Let's give it our `exit` binary:

```console
$ zig-out/bin/macho ../exit
0xfeedfacf
```

Hey that's the magic number! It looks like we are successfully able to parse
integers. Before we move on, let's see what happens if we give `macho` a non
Mach-O object file:

```console
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

// NEW!
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
    cpusubtype: u32,
    filetype: Filetype,
    ncmds: u32,
    sizeofcmds: u32,
    flags: Flags,
    reserved: u32 = undefined,
};
```

Now we need to define the `CpuType` and `Filetype` enums (the enum values of
`cpusubtype` depend on the value of `cputype`. For simplicity, we'll just parse
this as a raw number rather than defining an actual enum).

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

pub const Parser = struct {
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
the `std.meta.Tag` standard library function. For the `CpuType` enum we defined
earlier, this is `u32`. Once we convert the bytes into the tag type, we can
convert the tag value into an enum value using `std.meta.intToEnum`. This will
convert a number like `7` into an enum value like `x86`. If the enum doesn't
have a value corresponding to the given tag value, `intToEnum` returns an
error. In that case, we print a helpful error message, and return the same
error from our function. Note that this *should not* happen, and indicates a
bug in our parser.

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
    const cpusubtype = try parser.parseLiteral(u32);
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
MachHeader64{ .magic = 4277009103, .cputype = CpuType.arm64, .cpusubtype = 0,
.filetype = Filetype.execute, .ncmds = 16, .sizeofcmds = 744, .flags = Flags{
.noundefs = true, .incrlink = false, .dyldlink = true, .bindatload = false,
.prebound = false, .split_segs = false, .lazy_init = false, .twolevel = true,
.force_flat = false, .nomultidefs = false, .nofixprebinding = false,
.prebindable = false, .allmodsbound = false, .subsections_via_symbols = false,
.canonical = false, .weak_defines = false, .binds_to_weak = false,
.allow_stack_execution = false, . root_safe = false, .setuid_safe = false,
.no_reexported_dylibs = false, .pie = true, .dead_strippable_dylib = false,
.has_tlv_descriptors = false, .no_heap_execution = false, .app_extension_safe
= false, .nlist_outofsync_with_dyldinfo = false, .sim_support = false,
.dylib_in_cache = false, ._ = 0 }, .reserved = 0 }
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
        try std.fmt.format(writer, "cpusubtype: 0x{x}\n", .{value.cpusubtype});
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
cpusubtype: 0x0
filetype: Filetype.execute
ncmds: 16
sizeofcmds: 744
flags: NOUNDEFS DYLDLINK TWOLEVEL PIE
```

Much nicer. This gives us a much better view into the data contained within our
Mach-O file.

We see our old friend `feedfacf`, as well as a few things that we already know,
such as the CPU type (`arm64`) and the filetype (`execute`, indicating this
file is an executable). Following that we see that this Mach-O has 16 load
commands which take up 744 total bytes. Finally, this Mach-O file has the
`NOUNDEFS`, `DYLDLINK`, `TWOLEVEL`, and `PIE` flags set:

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

pub const Parser = struct {
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
    if (comptime !std.meta.trait.hasFn("parse")(T)) {
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

pub const Parser = struct {
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
        const cpusubtype = try parser.parse(u32);
        const filetype = try parser.parse(Filetype);
        const ncmds = try parser.parse(u32);
        const sizeofcmds = try parser.parse(u32);
        const flags = try parser.parse(Flags);
        const reserved = try parser.parse(u32);

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

Let's stop here for now. In [part 3](/blog/exploring-mach-o-part-3/), we'll parse the load commands and see what else lies in store in Mach-O.

[^1]: Full disclosure: I first tried writing the parser in Rust. However, I
found the experience pretty frustrating. I don't want to put all the blame on
Rust, as it's extremely likely that I just wasn't approaching the task in an
idiomatic way, but it felt like the language was fighting me at every turn (and
I don't mean the borrow checker -- that part I have no trouble with). After
battling to get something working for a couple of days, I finally gave up and
did it in Zig and had something working in under an hour.
