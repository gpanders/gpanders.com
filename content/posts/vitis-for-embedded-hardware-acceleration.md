---
title: Using Xilinx Vitis for Embedded Hardware Acceleration
date: 2020-02-06
tags: [xilinx, fpga]
draft: true
---

Xilinx recently released their new Vitis tool, which aims to ease the process
of accelerating high-level algorithms in applications in an FPGA. It is an
ambitious tool with a lot of potential. This guide will help you get started.

<!--more-->

The guide is targeted toward the Zynq UltraScale+ MPSoC via the command line
flow because that is what I use. However, where possible, I've aimed to keep
things as device agnostic as possible.

You can find a "reference implementation" of the steps below [here]. This
implementation uses a Makefile to automate all of the steps outlined below with
a simple example design. You are welcome to copy the reference implementation
and modify it to your own needs however you wish.

You can also find a lot of examples and Vitis tutorials online provided by
Xilinx. However, almost all of these are targeted towards using x86/PCIe
platforms and do not carry over well into edge-based/Zynq platforms (hence the
need for this guide).

-   [Vitis Tutorials]
-   [XRT Platform Creation]
-   [Vitis Documentation]

Outline
-------

The high-level outline of doing hardware acceleration in Vitis is

1.  Create a hardware design (XSA file) in Vivado
2.  Create Linux software components
3.  Create a Xilinx platform file (XPFM)
4.  Write and compile your kernels
5.  Write and compile your host executable
6.  Run software emulation

Creating Your Hardware Design
-----------------------------

This step is outlined in [Xilinx's documentation] so I will not repeat it. You
can find a scripted version of this step in the [reference implementation].

Note that it does not appear that it is actually required to have 5 different
clocks as in Xilinx's example above. This is an excerpt from their own
[documentation][]:

> Multiple clocks are supported. Every platform must provide and declare one or
> more clock nets sourced within the platform. The platform can have as many
> internal clocks as needed. These can, but are not required to, be declared
> for use by the v++ linker.
>
> -   The PFM.CLOCK property is used to set clocking and associated reset
>     information.
> -   Your design must include a clock set as the default clock, with id=`0`
>     and status=`fixed`.
> -   If available, a clock with id=`1` and status=`fixed` will be used by the
>     v++ linker to connect to the `ap_clk2` port of an acceleration kernel.
> -   Frequencies of either clock are unspecified, but the designer should
>     consider device and timing constraints. Platforms can contain other
>     clocks.

The platform interfaces defined in this stage determine how Vitis will connect
the memory interfaces of your kernels.

Create Linux Software Components
--------------------------------

Again, this step is outlined in [Xilinx's documentation][1]. I will not go over
all of the steps again, but I will provide some commentary.

Vitis requires the following Linux software components:

-   First Stage Bootloader (`fsbl.elf`)
-   PMU Firmware (`pmufw.elf`)
-   U-Boot (`u-boot.elf`)
-   ARM Trusted Firmware (`bl31.elf`)
-   Linux kernel image, device tree blob, and initramfs (`image.ub`)

Note that it is not required that your Linux kernel be packaged with the device
tree blob and initramfs into an `image.ub` file, but that is what the tools are
set up to use by default. The `image.ub` file is a FIT image file that combines
the Linux kernel image, the device tree blob, and a root file system together
into a single file.

The easiest way to generate all of these components in a way that will work
basically out of the box with Vitis is to use PetaLinux. Note that it is NOT
_required_ to use PetaLinux, and there are many very good reasons not to do so,
but again for the sake of brevity and clarity this guide will assume the use of
PetaLinux.

The most important things to notice about the instructions listed above are the
inclusion of userspace packages in the rootfs (`xrt`, `zocl`, `opencl-clhpp`,
and `opencl-headers`) and the modification of the device tree. Namely, you
_must_ have the following somewhere in your device tree source file:

```dts
&amba {
    zyxclmm_drm {
        compatible = “xlnx,zocl”;
        status = “okay”;
    };
};
```

Without this addition, the `zocl` driver will not be loaded and the Xilinx
Runtime will not be able to detect your hardware device.

One other important modification you must make that is not covered in the
Xilinx documentation is to disable the `CONFIG_CPU_IDLE` kernel option. See
[AR\# 69143] for more information. Without this modification, QEMU will hang
during bootup.

Once you run `petalinux-build`, you will find all of the requisite software
components in the `images/linux/` directory. Copy these to a location of your
choice (e.g. a `boot` subdirectory within your project directory). You will
also need to extract the `rootfs.tar.gz` archive file. This file contains the
sysroot that will be installed onto your target. For example, if our project
directory is located at `~/Projects/vitis_example/`:

```console
mkdir -p ~/Projects/vitis_example/build/boot
cp images/linux/{image.ub,zynqmp_fsbl.elf,pmufw.elf,u-boot.elf,bl31.elf} ~/Projects/vitis_example/build/boot
mkdir -p ~/Projects/vitis_example/build/sysroot
tar -C ~/Projects/vitis_example/build/sysroot -xf images/linux/rootfs.tar.gz
```

You will also need to include a BIF file, which is a file which tells Xilinx's
`bootgen` tool how to generate the `BOOT.bin` file that is used by MPSoC's boot
ROM to boot the device. The file should have the following contents:

```
/* linux */
the_ROM_image:
{
       [fsbl_config] a53_x64
       [bootloader] <zynqmp_fsbl.elf>
       [pmufw_image] <pmufw.elf>
       [destination_device=pl] <bitstream>
       [destination_cpu=a53-0, exception_level=el-3, trustzone] <bl31.elf>
       [destination_cpu=a53-0, exception_level=el-2] <u-boot.elf>
}
```

The file names within the `<>` brackets will be expanded automatically by
Vitis, so there is no need to insert absolute paths in this file. Save the BIF
file as `linux.bif` in your `boot` directory.

Finally, you will need two plain text files that provide the command line
arguments to QEMU. You can simply copy these from Xilinx's [XRT Github page]
and save them to your `boot` directory. Note that, unfortunately, the names of
these two files _do_ matter: they should be named `qemu_args.txt` and
`pmu_args.txt` respectively.

Vitis uses these software components to run the software and hardware emulation
targets, which we'll get to later.

The reference implementation takes care of all of this automatically using
PetaLinux and Makefile targets.

Generate a Xilinx Platform File
-------------------------------

Vitis introduces some new jargon: **platforms**, **domains**, and system
projects. A **platform** is essentially the hardware platform which we created
in step 1. Each **platform** has one or more **domains**. A **domain** is the
BSP or OS that controls a group of processors in the hardware. A system project
is a container for multiple applications that run on different **domains** at
the same time.

In our example, the domain is simply Linux running on the ARM Cortex A53
processor. You can create the platform file in the Vitis GUI by following the
instructions [here][2] or you can simply run the following commands from `xsct`
(assuming you're currently in your project directory):

```tcl
platform create -name vitis_example -hw /path/to/vitis_example.xsa -proc psu_cortexa53 -os linux -no-boot-bsp -prebuilt -out ./build
domain config -image ./build/boot
domain config -sysroot ./build/sysroot
domain config -boot ./build/boot
domain config -bif ./build/boot/linux.bif
domain config -qemu-args ./build/boot/qemu_args.txt
domain config -pmuqemu-args ./build/boot/pmu_args.txt
domain config -qemu-data ./build/boot
platform generate
```

This will create an `xpfm` file in `build/vitis_example/export/vitis_example`
alongside two directories: `hw` and `sw`. If you copy or move the `xpfm` file,
you must also move the `hw` and `sw` directories, as the `xpfm` file depends on
these two directories and expects them to be adjacent to itself.

Write and Compile Your Kernels
------------------------------

This process is outlined in more detail [here][3].

Writing kernels in OpenCL and/or HLS is beyond the scope of this guide because
there are so many different ways to do it and they are so project dependent.
For the sake of this guide, assume you have a simple vector addition kernel
written at `~/Projects/vitis_example/kernels/kadd.c`. We compile the kernel
using Xilinx's `v++` tool, which requires the `xpfm` file we created in the
last step.

```console
cd ~/Projects/vitis_example
v++ --platform ./build/vitis_example/export/vitis_example/vitis_example.xpfm -t sw_emu -g -o kadd.xo -c kernels/kadd.c
```

Once you have one or more `.xo` files, you can link them together into an
`.xclbin` file:

```console
v++ --platform ./build/vitis_example/export/vitis_example/vitis_example.xpfm -t sw_emu -g -o kadd.xclbin -l kadd.xo
```

Note that this flow closely mirrors that of using `gcc` or `clang` to compile
and link C code.

Also note that we passed the `-t sw_emu` option to `v++` in both the compile
and link phases. The `-t` option is mandatory and determines what actually is
produced in the `.xclbin` file. The available options are `sw_emu`, `hw_emu`,
or `hw`. For now, we'll just use `sw_emu` (meaning "software emulation").

You can find a list of `v++` options [here][4].

We now have our platform file and our `xclbin` file. All that's left is to
write and compile the host code and test our application in the emulator.

Write and Compile the Host Code
-------------------------------

Again, this step is out of scope for this guide as it is highly design
dependent. The easiest way to get started on this step is to start from an
[example].

Note that as of this writing (Feb 2020) Xilinx only supports OpenCL 1.2. This
is in part because Xilinx depends on some APIs that were deprecated in OpenCL
2.0. You can find the OpenCL 1.2 reference pages [here][5].

Run Software Emulation
----------------------

This is the point where the edge-based flow differs signifcantly from an
x86/PCIe platform. In order to do software emulation for the ARM CPU, Vitis
spins up a QEMU VM using the parameters supplied during platform creation. At
this point, you can run your host executable with the compiled xclbin file. The
Xilinx Runtime will generate run summaries and reports on the target VM, which
you must then transfer back over to your host development machine.

The software emulation VM is launched using a script called `launch_emulator`.
When you source the Vitis `settings64.sh` file, this script is added to your
path. When you run `launch_emulator`, the script looks for files under the
`_vimage` directory, which is created during the `v++` linking phase. This
directory contains parameters used by the `launch_emulator` script to prepare
and start the QEMU VM.

The first thing this script does is prepare a pseudo SD card image which is
passed to QEMU. A file called `sd_card.manifest` tells the `launch_emulator`
script what files should go on this SD card image. Unfortunately, by default
this manifest file does not include all of files needed to run software
emulation, in particular your host executable. Before running
`launch_emulator`, you will need to modify the `sd_card.manifest` file to
include the absolute path to your host executable as well as any other files
you want to include in the QEMU VM (for example, if you use an `xrt.ini` file
to set simulation parameters, you will need to add that as well).

Once the `sd_card.manifest` file is ready, run the following command to launch
the emulator:

```console
launch_emulator -no-reboot -runtime ocl -t sw_emu
```

The `-no-reboot` parameter is passed to QEMU and means that instead of
rebooting, the VM will simply shutdown. The `-runtime` and `-t` flags are used
by the `launch_emulator` script itself.

If everything works correctly, you should see the VM booting up in your
terminal console. Eventually, you will reach a login prompt. The username and
password are both `root`. Once logged in, you can mount the pseudo SD card and
run your host executable:

```console
mount /dev/mmcblk0p1 /mnt
cd /mnt
export XILINX_XRT=/usr
export XCL_EMULATION_MODE=sw_emu
./host vitis_example.xclbin
```

  [here]: https://github.com/gpanders/vitis_example
  [Vitis Tutorials]: https://github.com/Xilinx/Vitis-Tutorials
  [XRT Platform Creation]: https://github.com/Xilinx/XRT/tree/master/src/platform/zcu102_base
  [Vitis Documentation]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/kme1569523964461.html
  [Xilinx's documentation]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk1854106950.html#wxe1570652701297
  [reference implementation]: https://github.com/gpanders/vitis_example/blob/master/scripts/create_xsa.tcl
  [documentation]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk1180956723.html#itc1511211457306
  [1]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk375818786.html#hog1570652702356
  [AR\# 69143]: https://www.xilinx.com/support/answers/69143.html
  [XRT Github page]: https://github.com/Xilinx/XRT/tree/master/src/platform/zcu102_base/src/qemu/lnx
  [2]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk356017304.html#jvn1570652701832
  [3]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk595166594.html#tvy1528754367816
  [4]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk1798293725.html#wrj1504034328013
  [example]: https://github.com/gpanders/vitis_example/blob/master/src/host/host.cpp
  [5]: https://www.khronos.org/registry/OpenCL/sdk/1.2/docs/man/xhtml/
