# DOOM engine and game data

The files in this folder are not covered by tablecn's MIT license.

## Engine

`websockets-doom.js` and `websockets-doom.wasm` are [Chocolate Doom](https://www.chocolate-doom.org), built for WebAssembly from [cloudflare/doom-wasm](https://github.com/cloudflare/doom-wasm). They are licensed under the GNU General Public License, version 2. See [COPYING.md](./COPYING.md).

The complete source for this build is [doom-wasm-source.tar.gz](./doom-wasm-source.tar.gz). It is cloudflare/doom-wasm at commit `65e0d3ae2ffa604155eebd96ed40da6567bd08f4` with [doom-wasm.patch](./doom-wasm.patch) applied.

### Changes from upstream (October 2026)

- `src/doomtype.h`: `boolean` is a 4-byte `int32_t` in every translation unit. Before this, some files saw a 1-byte `bool` and others a 4-byte enum.
- `opl/opl.c`: OPL detection and delays don't wait on the audio callback, which shares the main thread in the browser. This enables music, which upstream ships disabled.
- `src/i_video.c`: no HiDPI canvas in the browser.
- `src/doom/d_main.c`: the main loop doesn't reenter while an iteration is suspended.
- `src/i_system.c`: `I_Error` traps instead of continuing with corrupt state.
- `src/doom/p_setup.c` and `src/doom/p_user.c`: extra standard includes.
- `configure.ac`: build flags for current emscripten. Source maps and `SAFE_HEAP` are off, `EXPORTED_RUNTIME_METHODS=FS,ccall,callMain,ENV`, `ASYNCIFY_STACK_SIZE=1048576`, `-std=gnu11` and `-g0`.

### Building

With emscripten 6.0.13 on the `PATH`:

```bash
tar -xzf doom-wasm-source.tar.gz
cd doom-wasm
./scripts/build.sh
```

The build writes `src/websockets-doom.js` and `src/websockets-doom.wasm`.

## Configuration

`default.cfg` and `extra.cfg` are Chocolate Doom config files, written for this page.

## Game data

`doom1.wad` is the shareware episode of DOOM 1.9 (MD5 `f0cefca49926d00903cf57551d901abe`). DOOM is © id Software. The shareware episode may be shared freely, but only unmodified and not for a fee.
