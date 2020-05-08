---
title: "Tutorial: Booting Linux on the ZCU102"
date: 2019-02-13
tags: [linux, xilinx]
---

This post contains a step-by-step walk through on booting Linux on Xilinx's
ZCU102 MPSoC evaluation board.

<!--more-->

Installing Linux on the Zynq MPSoC board is fairly straightforward if you take
Xilinx's advice and use their PetaLinux tool; however, I wanted to try my hand
at getting a working Linux installation up and running without using PetaLinux,
for a variety of reasons. Firstly, PetaLinux is massive. The initial download
comes in close to 6 GB, with 10's of GB more during the build process.

Second, PetaLinux is a nice process abstraction if you need to get something up
quickly or if you don't particularly care about knowing how the Linux boot
process works, but that does not describe me. I didn't want Xilinx to hold my
hand and do everything for me.  Understanding how things work is what makes a
good engineer, so I wanted to at least get a working installation up on my own
before resorting to a tool like PetaLinux.

It turns out that this process is a bit more involved than I would have
assumed.  Xilinx's documentation in this area is scant and fragmented.  The
entire process is outlined in their
[wiki](https://xilinx-wiki.atlassian.net/wiki/spaces/A/pages/18841722/ZCU102+Image+creation+in+OSL+flow#ZCU102ImagecreationinOSLflow-Buildu-boot),
but the information is often stale, badly formatted, obscure, or just plain
wrong. This guide aspires to be what Xilinx's wiki should be: a step-by-step
solution from nothing to Linux.

## What You'll Need

1.  A ZCU102 evaluation board
2.  A USB-connection to the board's UART (the kit comes with this cable)
3.  An SD card with 2 partitions: a FAT32 boot partition, and an ext4
    file system partition
4.  Some kind of Linux installation (a virtual machine on Windows is fine)
5.  A Vivado installation, including the Vivado SDK. You can run Vivado and the
    SDK on Windows if you like, but **you must have SDK installed on Linux**,
    even if you don't use it. The SDK distribution contains all of the cross
    compilers and other tools required to build the Linux kernel and other
    components.

## Step 1: Build your design in Vivado

This process is pretty well outlined in [Vivado's
tutorials](https://www.xilinx.com/support/documentation/sw_manuals/xilinx2018_1/ug1209-embedded-design-tutorial.pdf)
and in many other places, so I won't go too in-depth here. Basically, create
whatever design it is you want in Vivado (using the Zynq IP and any other IP
you want to use) and create a bitstream. This part should be familiar to anyone
who's programmed an FPGA with Vivado before.

Once the bitstream is finished compiling, go to `File` > `Export` > `Export
Hardware`.  Make sure "Include bitstream" is checked.

## Step 2: Launch SDK

While still in Vivado, go to `File` > `Launch SDK`. You can accept the defaults
in the Launch SDK window or specify a custom location -- it doesn't really
matter, but just put it somewhere easy to find because you'll be digging files
out of this location eventually.

Once in SDK you'll have a hardware platform called
`<your_top_module>_hw_platform_0.hdf`. The hardware platform is what contains
all of the files to initialize the processing system (PS) to the settings you
gave it in the IP integrator. The HDF file also contains your bitstream and any
drivers for custom IP you might have included.

## Step 3: Create the First Stage Boot Loader (FSBL)

In the Vivado SDK, go to `File` > `New` > `Application Project`. In the **New
Project** dialog that appears, call the project `fsbl` and set the OS Platform
to `standalone`. Make sure your hardware platform is selected in the Hardware
Platform dropdown box, and also make sure `psu_cortexa53_0` is selected in the
Processor box. Don't worry about any of the options in the Target Software
group. Click **Next**. The next window is the **Templates** window. In the left
pane, select **Zynq MP FSBL** (near the bottom). Finally, click Finish.

You can optionally enable debugging statements in the FSBL.  In the Project
Explorer, expand the newly created `fsbl` application and open the file
`xfsbl_config.h` under the `src` directory. Enable debug printing by changing
one of the following `#define` values to `1U`. Each line enables more verbose
output, i.e. enabling `FSBL_DEBUG_DETAILED_VAL` will print basically
everything, while `FSBL_PRINT_VAL` will print much less. If you're not sure, go
ahead and enable `FSBL_DEBUG_DETAILED_VAL`, just in case:

```c
#define FSBL_PRINT_VAL              (0U)
#define FSBL_DEBUG_VAL              (0U)
#define FSBL_DEBUG_INFO_VAL         (0U)
#define FSBL_DEBUG_DETAILED_VAL     (1U)
```

## Step 4: Create the PMU Firmware (PMUFW)

This step is almost identical to the last one. Create a new Application Project
and this time call it `pmufw`. Set the Processor to `psu_pmu_0`.  Click
**Next** and select the only option in the **Templates** window (ZynqMP PMU
Firmware).  Click Finish.

## Step 5: Create the Device Tree Binary (dtb) files

First, clone Xilinx's
[device-tree-xlnx](https://github.com/Xilinx/device-tree-xlnx) repository (it
doesn't matter where). **Once cloned, make sure you check out the tag
corresponding to the Vivado version you are using**.  This is very important,
and has potential to really trip you up down the road if you forget this step.
For example, I built mine using Vivado 2018.2, so I checked out the tag
`xilinx-v2018.2` using

```console
$ git checkout tags/xilinx-v2018.2
```

Once you've checked out the correct tag, go back to Vivado SDK and click
`Xilinx` > `Repositories` in the menu bar. Click **New...** next to Global
Repositories and add the `device-tree-xlnx` directory you just cloned. Click
OK.

Go to `File` > `New` > `Board Support Package`. Near the bottom of the window
you should see a box called "Board Support Package OS". This box should now
have an option called `device_tree`. Click that option and then click Finish.
In the **Board Support Package Settings** window that comes up, click
`device_tree` on the left and enter `{BOARD zcu102-rev1.0}` in the **Value**
column of `periph_type_overrides`.

Finally, press Ctrl+B or click `Project` > `Build All` to build the FSBL, PMU
Firmware, and device tree sources. You will need to compile the device tree
sources into flattened blobs (`.dtb`) yourself. Many Linux distributions
contain a tool called `dtc` that does this, or you can clone it from
[here](https://git.kernel.org/pub/scm/utils/dtc/dtc.git) and build it yourself.
Whichever path you take, the command to use will be:

```console
$ dtc -I dts -O dtb -o system.dtb system-top.dts
```

**Note the change from system-top.dts to system.dtb.** The top-level device
tree source file from SDK is called `system-top.dts`, but the default U-Boot
configuration Xilinx expects a device tree blob called `system.dtb`. This is an
annoying gotcha.

In my case, SDK produced both a `system-top.dts` and a `system.dts` file. This
appears to be due to a bug in Xilinx's device tree generator (see
[here](https://github.com/Xilinx/device-tree-xlnx/pull/8)). The `system.dts`
file contains only a single entry that sets the local MAC address of the
Ethernet controller. You can either add the line

```dts
/include/ "system.dts"
```

to the top of your `system-top.dts` file or you can append the contents of
`system.dts` to `system-top.dts`.

Once you have your `system.dtb` file, copy it to the FAT32 (boot) partition of
your SD card.

## Step 6: Compile U-Boot

Clone Xilinx's [U-Boot repository](https://github.com/Xilinx/u-boot-xlnx).
Again, **be sure to check out the tag corresponding to the version of Vivado
you're using**. First, we need to set up our build environment:

```console
$ source /path/to/Vivado/SDK/settings64.sh
$ export CROSS_COMPILE=aarch64-linux-gnu-
```

Note that you'll need to repeat that for every new terminal window you open.

To build U-Boot, navigate to the U-Boot repository you cloned earlier and run
the following:

```console
$ make xilinx_zynqmp_zcu102_rev1_0_defconfig
$ make menuconfig
$ make
```

Once U-Boot is done compiling, you should see a `u-boot.elf` file in that
directory.

## Step 7: Compile Arm Trusted Firmware (ATF)

This process is similar to building U-Boot. Clone Xilinx's [ARM Trusted
Firmware repository](https://github.com/Xilinx/arm-trusted-firmware), check out
the tag corresponding to your Vivado version, set the `CROSS_COMPILE`
environment variable, and then run

```console
$ make PLAT=zynqmp bl31
```

Once complete, you should have a `bl31.elf` file under
`build/zynqmp/release/bl31/`.

## Step 8: Create a boot image

This step is covered pretty well in Vivado's [Embedded Design
Tutorial](https://www.xilinx.com/support/documentation/sw_manuals/xilinx2018_1/ug1209-embedded-design-tutorial.pdf).
See the chapter on Boot and Configuration. The only thing that tutorial leaves
out is including your FPGA bitstream. **The FPGA bitstream MUST be added before
the ARM Trusted Firmware (bl31.elf)**. This is because when the FSBL prepares
to load the bitstream, it loads it into the same memory region that the ATF is
loaded. If the ATF is loaded before the bitstream, then the ATF will be
overwritten.

Copy the BOOT.bin file you just created to the FAT32 (boot) partition of your
SD card.

An even easier way to do this is to use the
[zynqmp-boot-apps](https://github.com/gpanders/zynqmp-boot-apps) tool. Simply
clone the tool and follow a few simple instructions to generate both the
`BOOT.bin` file and your `system.dtb` file:

```console
$ cd ~
$ git clone https://github.com/gpanders/zynqmp-boot-apps
$ mkdir -p ~/zynqmp-boot-apps/build
$ cp /path/to/u-boot.elf ~/zynqmp-boot-apps/build
$ cp /path/to/bl31.elf ~/zynqmp-boot-apps/build
$ cp /path/to/your/hardware_description_file.hdf ~/zynqmp-boot-apps/
$ cd ~/zynqmp-boot-apps
$ source /opt/Xilinx/SDK/<version>/settings64.sh
$ make
```

If the FAT32 (boot) partition of your SD card is mounted to `/media/sd`, then
you can install the boot files using

```console
$ sudo make INSTALL_DIR=/media/sd install
```

## Step 9: Compile the Linux kernel

Clone Xilinx's [fork of the Linux kernel](https://github.com/Xilinx/linux-xlnx)
and check out the tag corresponding to your Vivado version. Again, make sure
your `CROSS_COMPILE` and `ARCH` environment variables are set to
`aarch64-linux-gnu-` and `arm64`, respectively.

Run `make xilinx_zynqmp_defconfig` to generate a default config file for the
ZCU102. You can optionally run `make menuconfig` (or `make nconfig` or `make
xconfig` or any of the other config make targets) to configure the Linux
kernel, but it's fine to leave it at the default settings if you want.

Run `make` to start building the kernel. This step usually takes a while. Once
complete, you will have a file called `Image` under `arch/arm64/boot`. The
`Image` format is uncompressed and does not have a U-Boot header. If you want
to boot this image using `bootm` in U-Boot, you must manually use the `mkimage`
utility from U-Boot to wrap this image in a U-Boot header. However, U-Boot also
has a `booti` command that allows us to use an uncompressed image with no
header and this is, in fact, what the default `bootcmd` is set to use by the
Xilinx U-Boot fork.

Copy the `Image` file to the FAT32 (boot) partition of your SD card.

## Step 10: Find or create a file system

There are a thousand and one ways to procure a file system for Linux, so do
whatever works for you. If you want just a minimal Debian or Ubuntu file system,
you can download one from [eewiki](https://rcn-ee.com/rootfs/eewiki/minfs/).

You can also use a tool like [buildroot](https://buildroot.org) or [Yocto
Linux](https://yoctoproject.org/) to generate a customized file system for your
specific application.

If your development machine is running a Debian-based distribution (such as
Ubuntu) and you also want to use a Debian-based distribution on your board, you
can use a tool called [debootstrap](https://wiki.debian.org/Debootstrap). To
create a Debian-based root file system, use the process outlined
[here](https://wiki.debian.org/Arm64Port#Debootstrap_arm64).

However you get it, install the file system to the ext4 partition of your
SD card.

## Step 12: Boot Linux

We're finally there! Put your SD card into your device and make sure the boot
pins are set to boot from SD card mode (see [ZCU102 User
Guide](https://www.xilinx.com/support/documentation/boards_and_kits/zcu102/ug1182-zcu102-eval-bd.pdf)
in the section titled "MPSoC Device Configuration"). Set up your serial console
to listen to interface 0 (on Linux this is `/dev/ttyUSB0`, on Windows it's
Silicon Labs USB to UART Bridge: Interface 0) and turn on the device. You
should see the FSBL debug statements going through each of the partitions of
the BOOT.bin. The FSBL will first program the FPGA with the bitstream, then
load the ARM Trusted Firmware, finally followed by U-Boot. If everything is
done correctly, U-Boot should then start booting Linux (assuming you don't
interrupt the autoboot process).

In the 2019.1 version of Xilinx's U-Boot fork the default `$bootcmd` has been
changed. As of this update, this new default command does not work for me, but
you can revert the `$bootcmd` to its old value by running the following from
the U-Boot prompt:

```console
ZynqMP> setenv bootcmd "run sdboot"
ZynqMP> saveenv
```

Note that using `run sdboot` is technically deprecated (you will see a message
in the console saying as much), so this should only be a temporary stopgap.

And that's it! From here, everything else is just configuration and the hardest
part is out of the way.

Feel free to [contact me](mailto:contact@gpanders.com) if you have any questions
or suggestions for improvement.
