---
title: Using Xilinx Vitis for Embedded Hardware Acceleration
date: 2020-02-12
tags: [xilinx, fpga, vitis, hardware acceleration, embedded]
featured: true
---

Xilinx recently released their new Vitis tool, which aims to ease the process
of accelerating high-level algorithms in applications in an FPGA. It is an
ambitious tool with a lot of potential. This guide will help you get started.

<!--more-->

The guide is targeted toward the Zynq Ultrascale+ MPSoC using a command line
(as opposed to a GUI) flow because that is what I use. However, where possible,
I've aimed to keep things as device agnostic as possible.

**NOTE**: Vitis is still a very new tool and is likely to change rapidly in the
near-future. I will try to keep this guide as up-to-date as possible, but be
warned that some pieces may be antiquated by the time you read it.

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

1.  [Create a hardware design (XSA file) in Vivado]
2.  [Create Linux software components]
3.  [Create a Xilinx platform file (XPFM)]
4.  [Write and compile your kernels]
5.  [Write and compile your host executable]
6.  [Run software emulation]

Pre-packaged Embedded Platforms
-------------------------------

Xilinx offers a set of standard embedded hardware platforms available
[here][platforms]. If you're just getting started or if your design does not
contain any custom IP or infrastructure, you can use one of these standard
platforms and skip steps 1-3 above.

To use one of these platforms (for example, `zcu102_base`), download the ZIP
file from Xilinx's website and extract the platform to the `platforms`
subdirectory beneath your Vitis installation. For example, if you installed
Vitis to `/opt/Xilinx/Vitis/2019.2`, you would copy the `zcu102_base` directory
to `/opt/Xilinx/Vitis/2019.2/platforms/zcu102_base`. In the rest of this guide,
you will then provide `zcu102_base` as the argument to the `--platform` command
line flag.

Also download the cross-compilation sysroot from the same [downloads
page][platforms]. After extracting the archive you'll find `sdk.sh` scripts for
both the Zynq 7000 and the Zynq Ultrascale. Execute the `sdk.sh` script for
your chip and supply an installation path for the sysroot.

[platforms]: https://www.xilinx.com/support/download/index.html/content/xilinx/en/downloadNav/embedded-platforms.html

Creating Your Hardware Design
-----------------------------

**NOTE**: You can skip this step if you are using a [pre-packaged embedded
platform](#pre-packaged-embedded-platforms).

This step is done using Vivado and is responsible for generating the Xilinx
Shell Archive (`xsa`) file (formerly known as a Hardware Description File
(`hdf`)). Your hardware design needs to include the Zynq processor IP as well
as _at least_ one external clock. You can find a simple example in [Xilinx's documentation].

Each clock also must have an accompanying Processor System Reset IP and a
`PFM.CLOCK` property that can be set either in the Vivado GUI (click
`Window > Platform Interfaces`) or in the Tcl console:

```tcl
set_property PFM.CLOCK { \
    <clk port> { \
        id "0" \
        is_default "true" \
        proc_sys_reset <proc_sys_reset name> \
        status "fixed" \
    } \
}
```

Every platform must specify one clock with `id=0`, `status="fixed"` and
`is_default="true"`.

In addition to the clocks, you must also specify the available memory ports in
your design. Again, this can be done in the GUI in the
`Window > Platform Interfaces` window or can be done directly in Tcl:

```tcl
set_property PFM.AXI_PORT { \
    <port_name> {memport <type> sptag <ID> memory <value>} \
}
```

The `sptag` and `memory` parameters are optional. For a full description of
these properties, see the [Configuring Platform Interface Properties] page.

The platform interfaces defined in this stage determine how Vitis will connect
the memory interfaces of your kernels.

Create Linux Software Components
--------------------------------

**NOTE**: You can skip this step if you are using a [pre-packaged embedded
platform](#pre-packaged-embedded-platforms).

Vitis requires the following software components:

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
basically out of the box with Vitis is to use Xilinx's [PetaLinux] tool. Note
that it is NOT _required_ to use PetaLinux, and there are many very good
reasons not to do so, but again for the sake of brevity and clarity this guide
will assume the use of PetaLinux.

If you choose to use PetaLinux, you can follow the instructions [here][1].

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

If you use plain YoctoLinux, the `xrt` and `zocl` applications can be found in
Xilinx's [meta-petalinux] layer.

One other important modification you must make is to disable the
`CONFIG_CPU_IDLE` kernel option. See [AR\# 69143] for more information. Without
this modification, QEMU will hang during bootup (**UPDATE 2020-04-14**: This
step is now included in the official Vitis documentation. See Step 9
[here][1]).

Once you run `petalinux-build`, you will find all of the requisite software
components in the `images/linux/` directory. Copy these to a location of your
choice (e.g. a `boot` subdirectory within your project directory). You will
also need to extract the `rootfs.tar.gz` archive file. This file contains the
sysroot that will be installed onto your target. For example, if our project
directory is located at `~/Projects/vitis_example/`:

```console
mkdir -p ~/Projects/vitis_example/build/{boot,sysroot}
cp images/linux/{image.ub,zynqmp_fsbl.elf,pmufw.elf,u-boot.elf,bl31.elf} ~/Projects/vitis_example/build/boot
tar -C ~/Projects/vitis_example/build/sysroot -xf images/linux/rootfs.tar.gz
```

You will also need to include a BIF file, which is a file which tells Xilinx's
`bootgen` tool how to generate the `BOOT.bin` file that is used by MPSoC's boot
ROM to boot the device. The file should have the following contents:

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

The file names within the `<>` brackets will be expanded automatically by
Vitis, so there is no need to insert absolute paths in this file. Save the BIF
file as `linux.bif` in your `boot` directory.

Finally, you will need two plain text files that provide the command line
arguments to QEMU. You can simply copy these from Xilinx's [Vitis GitHub page]
and save them to your `boot` directory. Note that, unfortunately, the names of
these two files _do_ matter: they should be named `qemu_args.txt` and
`pmu_args.txt` respectively.

Vitis uses these software components to run the software and hardware emulation
targets, which we'll get to later.

Generate a Xilinx Platform File
-------------------------------

**NOTE**: You can skip this step if you are using a [pre-packaged embedded
platform](#pre-packaged-embedded-platforms).

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
platform create -name vitis_example -hw /path/to/vitis_example.xsa -proc psu_cortexa53 -os linux -no-boot-bsp -prebuilt -out ./build/platform
domain config -image ./build/boot
domain config -sysroot ./build/sysroot
domain config -boot ./build/boot
domain config -bif ./build/boot/linux.bif
domain config -qemu-args ./build/boot/qemu_args.txt
domain config -pmuqemu-args ./build/boot/pmu_args.txt
domain config -qemu-data ./build/boot
platform generate
```

This will create an `xpfm` file in
`build/platform/vitis_example/export/vitis_example/` alongside two directories:
`hw` and `sw`. If you copy or move the `xpfm` file, you must also move the `hw`
and `sw` directories, as the `xpfm` file depends on these two directories and
expects them to be adjacent to itself.

Write and Compile Your Kernels
------------------------------

Writing OpenCL or Vivado HLS kernels is a huge topic that is beyond the scope
of this guide. As a simple example, however, assume we have the following
multiply-and-add kernel at `kernels/axpy/axpy.c`:

```c
void axpy(float const *a, float const *x, float const *y, float *out, int const len)
{
#pragma HLS INTERFACE m_axi port=a offset=slave
#pragma HLS INTERFACE m_axi port=x offset=slave
#pragma HLS INTERFACE m_axi port=y offset=slave
#pragma HLS INTERFACE m_axi port=out offset=slave
#pragma HLS INTERFACE s_axilite port=a bundle=control
#pragma HLS INTERFACE s_axilite port=x bundle=control
#pragma HLS INTERFACE s_axilite port=y bundle=control
#pragma HLS INTERFACE s_axilite port=out bundle=control
#pragma HLS INTERFACE s_axilite port=len bundle=control
#pragma HLS INTERFACE s_axilite port=return bundle=control

    for (int i = 0; i < len; i++) {
#pragma HLS PIPELINE
        out[i] = a[i]*x[i] + y[i];
    }
}
```

The first step is to compile our kernel into a Xilinx object file (`.xo`):

```console
mkdir -p build/sw_emu
v++ --platform ./build/platform/vitis_example/export/vitis_example/vitis_example.xpfm -t sw_emu -g -o build/sw_emu/axpy.xo -c kernels/axpy/axpy.c
```

Note that the `xpfm` file created in the last step is a required argument to
the `v++` compiler.

If you are using a [pre-packaged embedded
platform](#pre-packaged-embedded-platforms), supply the name of the platform as
the argument to the `--platform` command line flag. For example,

```console
v++ --platform zcu102_base ...
```

Once you have one or more `.xo` files, you can link them together into an
`.xclbin` file:

```console
v++ --platform ./build/platform/vitis_example/export/vitis_example/vitis_example.xpfm -t sw_emu -g -o build/sw_emu/axpy.xclbin -l build/sw_emu/axpy.xo
```

Also note that we passed the `-t sw_emu` option to `v++` in both the compile
and link phases. The `-t` option is mandatory and determines what actually is
produced in the `.xclbin` file. The available options are `sw_emu`, `hw_emu`,
or `hw`. For now, we'll just use `sw_emu` (meaning "software emulation").

We now have our platform file and our `xclbin` file. All that's left is to
write and compile the host code and test our application in the emulator.

For more information on using `v++` see the [official Xilinx documentation][3].

Write and Compile the Host Code
-------------------------------

Again, this step is out of scope for this guide as it is highly design
dependent. The easiest way to get started on this step is to start from an
[example].

Note that as of this writing (Feb 2020) Xilinx only supports OpenCL 1.2. This
is in part because Xilinx depends on some APIs that were deprecated in OpenCL
2.0. You can find the OpenCL 1.2 reference pages [here][4].

Run Software Emulation
----------------------

This is the point where the edge-based flow differs significantly from an
x86/PCIe platform. In order to do software emulation for the ARM CPU, Vitis
spins up a QEMU virtual machine using the parameters supplied during platform
creation. At this point, you can run your host executable with the compiled
xclbin file. The Xilinx Runtime will generate run summaries and reports on the
target VM, which you must then transfer back over to your host development
machine.

The software emulation VM is launched using a script called `launch_emulator`.
When you source the Vitis `settings64.sh` file, this script is added to your
path. When you run `launch_emulator`, the script looks for files under the
`_vimage` directory, which is created during the `v++` linking phase. This
directory contains parameters used by the `launch_emulator` script to prepare
and start the QEMU VM.

The first thing this script does is prepare a virtual SD card image which is
passed to QEMU. A file called `sd_card.manifest` tells the `launch_emulator`
script what files should go on this SD card image. Unfortunately, by default
this manifest file does not include all of files needed to run software
emulation. Before running `launch_emulator`, you will need to modify the
`sd_card.manifest` file to include the absolute path to your host executable as
well as any other files you want to include in the QEMU VM.

You should also include a `xrt.ini` file with the following contents:

```ini
[Debug]
profile=true
timeline_trace=true
data_transfer_trace=fine
```

This will generate useful output products when you run the emulation. Be sure
to include the full path to this `xrt.ini` file in the `sd_card.manifest` file.

Once the `sd_card.manifest` file is ready, run the following command to launch
the emulator:

```console
launch_emulator -no-reboot -runtime ocl -t sw_emu -forward-port 1440 1534
```

The `-no-reboot` parameter is passed to QEMU and means that instead of
rebooting, the VM will simply shutdown. The `-runtime` and `-t` flags are used
by the `launch_emulator` script itself. The `-forward-port` flag creates a port
forward to the guest VM allowing you to connect to it using `xsct`.

If everything works correctly, you should see the VM booting up in your
terminal console. Eventually, you will reach a login prompt. The username and
password are both `root`. Once logged in, you can mount the virtual SD card and
run your host executable:

```console
mount /dev/mmcblk0p1 /mnt
cd /mnt
export XILINX_XRT=/usr
XCL_EMULATION_MODE=sw_emu ./host vitis_example.xclbin
```

You can use `xsct` to transfer files between your development machine and the
guest VM:

    $ xsct
    xsct% connect -url tcp:localhost:1440
    xsct% tfile copy -from-host /path/on/host /path/on/target
    xsct% tfile copy -to-host /path/on/target /path/on/host

This allows you to make changes to your host program or `xclbin` file and
quickly transfer them to the VM without needing to restart the emulator. This
is also how you can transfer the run summaries off of the target VM onto your
host:

    $ xsct
    xsct% connect -url tcp:localhost:1440
    xsct% tfile copy -to-host /mnt/profile_summary.csv profile_summary.csv
    xsct% tfile copy -to-host /mnt/timeline_trace.csv timeline_trace.csv
    xsct% tfile copy -to-host /mnt/xclbin.run_summary xclbin.run_summary

The `xclbin.run_summary` file can be viewed using the `vitis_analyzer` tool:

```console
$ vitis_analyzer xclbin.run_summary
```

Conclusion
----------

There you have it. There are a lot of steps involved, but fortunately almost
all of them are entirely scriptable (as you can see in the reference
implementation). This means that once the process is done once, the time cost
of repeating it is negligible.

If you have any questions or feedback, please feel free to [contact me].

  [here]: https://github.com/gpanders/vitis_example
  [Vitis Tutorials]: https://github.com/Xilinx/Vitis-Tutorials
  [XRT Platform Creation]: https://github.com/Xilinx/Vitis_Embedded_Platform_Source/tree/master/Xilinx_Official_Platforms/zcu102_base
  [Vitis Documentation]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/kme1569523964461.html
  [Create a hardware design (XSA file) in Vivado]: #creating-your-hardware-design
  [Create Linux software components]: #create-linux-software-components
  [Create a Xilinx platform file (XPFM)]: #generate-a-xilinx-platform-file
  [Write and compile your kernels]: #write-and-compile-your-kernels
  [Write and compile your host executable]: #write-and-compile-the-host-code
  [Run software emulation]: #run-software-emulation
  [Xilinx's documentation]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk373975992.html#wxe1570652701297
  [Configuring Platform Interface Properties]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk440719349.html#phl1512685419302
  [PetaLinux]: https://www.xilinx.com/products/design-tools/embedded-software/petalinux-sdk.html
  [1]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk1468064742.html#ariaid-title2
  [meta-petalinux]: https://github.com/Xilinx/meta-petalinux
  [AR\# 69143]: https://www.xilinx.com/support/answers/69143.html
  [Vitis Github page]: https://github.com/Xilinx/Vitis_Embedded_Platform_Source/tree/master/Xilinx_Official_Platforms/zcu102_base/vivado/src/qemu/lnx
  [2]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk468473335.html#ariaid-title2
  [3]: https://www.xilinx.com/html_docs/xilinx2019_2/vitis_doc/Chunk1193338764.html#wrj1504034328013
  [example]: https://github.com/gpanders/vitis_example/blob/master/src/host/host.cpp
  [4]: https://www.khronos.org/registry/OpenCL/sdk/1.2/docs/man/xhtml/
  [contact me]: mailto:contact@gpanders.com
