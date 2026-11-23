# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`iobroker.wolf` is an ioBroker adapter for WOLF heating systems with the **ISM8i** (WOLF "Schnittstellenmodul ISM8i", eBus to IP). The adapter is the **TCP server**: the ISM8i connects to it (default port 12004) and pushes every datapoint change as a telegram. The adapter acknowledges each telegram, creates the objects of the reporting device on the fly, converts the values and writes them as states. Writable datapoints are sent back to the ISM8i when a state is set with `ack: false`.

The protocol (frame layout, services, datapoint types and the Wolf-specific value tables) is described in the ISM8i manual "ISM8i Schnittstellenbeschreibung". Section numbers in code comments (e.g. "8.7.8") refer to it.

TypeScript (CommonJS output). Sources live in `src/`, the published/runnable code is the compiled `build/` (`package.json` `main` is `build/main.js`). `build/` is gitignored — always run the build before starting the adapter or the tests.

## Commands

```bash
npm run build                             # tsc -p tsconfig.build.json  -> build/
npm run watch                             # same in watch mode
npm run check                             # type check only (tsconfig.json, noEmit)
npm run lint                              # eslint (@iobroker/eslint-config, flat config)
npx eslint -c eslint.config.mjs --fix src # autofix + prettier formatting

npm run test:package                      # validates package.json / io-package.json / admin JSON (fast)
npm run test:unit                         # protocol, devices, converter - runs against build/lib/*.js
npm run test:integration                  # starts a real js-controller + adapter, connects a fake ISM8i over TCP
npx mocha test/unit --exit --grep "encode" # single test
npm run release-major                     # @alcalzone/release-script, moves README changelog into io-package news
```

There is deliberately **no `prepare` script** — `npm ci`/`npm install` does not build. Run `npm run build` yourself after a fresh checkout and before the unit tests, the integration test or starting the adapter. Because `build/` is neither committed nor built on install, `common.nogit` is `true` in `io-package.json`: the adapter can only be installed from npm, not from GitHub. The integration test requires that **no** js-controller is running on the machine.

## Architecture

### Layout

| Path | Content |
| --- | --- |
| `src/main.ts` | `WolfAdapter extends utils.Adapter`: TCP server, connections, object creation, state handling |
| `src/lib/protocol.ts` | framing: `splitTelegrams()`, `parseTelegram()`, acknowledge, GetAll and write telegrams |
| `src/lib/dpt.ts` | KNX datapoint types 5, 7, 9, 10, 11, 13: raw encoding/decoding |
| `src/lib/converter.ts` | `Converter`: datapoint value ⇄ state value (texts, units, limits, Wolf program numbers) |
| `src/lib/devices.ts` | datapoint ID → device channel (`hg1_t`, `bm1_t`, …) and the ID ranges of every device |
| `src/lib/datapoints.json` | all known datapoints: name, DPT, rw, unit, `commonType`, min/max of writable values |
| `src/lib/types.ts` | shared types |
| `src/lib/adapter-config.d.ts` | augments `ioBroker.AdapterConfig` |
| `admin/jsonConfig.json` | the configuration dialog (tabs "Connection" and "Devices") |

`src/lib/adapter-config.d.ts` is hand-maintained and must be kept in sync with `native` in `io-package.json` **and** with `admin/jsonConfig.json` — nothing generates it.

### Protocol: `src/lib/protocol.ts`

- Every telegram starts with `06 20 F0 80`, bytes 4–5 are the **frame size** (whole telegram). TCP delivers telegrams split and joined arbitrarily, so `splitTelegrams()` cuts the receive buffer by frame size and returns the incomplete rest, which the socket handler keeps for the next chunk. Garbage before a header is skipped.
- `SetDatapointValue.Req` (`F0 06`) carries **several datapoints**: start DP, count, then per DP `id(2) cmd(1) len(1) value(len)`. A DP with `len = 0` exists (#124) and is skipped later.
- Every `F0 06` telegram must be answered with `SetDatapointValue.Res` (`F0 86`, start DP of the request), otherwise the ISM8i repeats it. `createAcknowledge()` returns a new buffer every time.
- `GET_ALL` (`F0 D0`) is sent after connecting and, if configured, every `polling_interval` seconds.
- Writing uses `DatapointValue.Ind` (`F0 C1`) with state byte `00`.

### Connections

- The ISM8i opens a new connection when it thinks the old one is broken, often leaving the old one half-open. A new connection from the same remote address therefore **destroys** the old socket, otherwise writes would go to a dead connection. TCP keep-alive (60 s) detects silent drops.
- `info.connection` is `true` while at least one non-destroyed socket exists.
- Telegrams are processed strictly one after another through the `processing` promise chain, so the objects of a device are completely created before the next value of the same device arrives.

### Objects and states

- State IDs are `wolf.<i>.<device>.<dp>`, the device comes from `getDevice(dp)` in `src/lib/devices.ts`. `getDevice()` and `getDeviceRanges()` describe the same mapping in two directions — the unit test checks that they agree and cover every DP of `datapoints.json`.
- Objects are created lazily: the first value of any DP of an enabled device (`config.devices.<dev>_t === 'Auto'`) creates the channel and **all** states of that device. DPs 212–250 and 252–354 are always processed.
- A device whose first "Störung" value is `1` is treated as not existing and ignored (old behavior, kept intentionally).
- On start, existing objects are registered only if they are at the expected path. Objects at other paths (created by old versions, #96) are reported as obsolete and not updated. The type of switch states (bool vs. text) and min/max of writable states are corrected; read-only states get no min/max.
- `bm0_t` is not configurable: it is enabled if one of `bm1_t`…`bm4_t` is enabled.
- A disabled device with existing objects is deleted recursively on start.

### Value conversion: `src/lib/converter.ts`

Things that look wrong but are intentional (changing them breaks existing installations and scripts):

- **Programmwahl** of heating circuit/mixer and hot water use the numbering of the **Wolf control unit** (e.g. heating circuit: 0 = Standby, 1 = Automatik, 2 = Heizbetrieb, 3 = Sparbetrieb), not the KNX values. CWL uses the KNX values. Texts are accepted, too. Invalid values are rejected.
- `DPT_OpenClose` decodes `0` as `Close`, although KNX 1.009 says `0 = Open`.
- `DPT_Power` values above 999 are divided by 1000.
- DPT 9 cannot store every value exactly; for written DPT 9 values the acknowledged state gets the limited input value, for all other types the value decoded from the sent bytes.
- Writable temperatures, Sollwertkorrektur, Sparfaktor and percentages are limited to the ranges of the manual (`min`/`max` in `datapoints.json`).

### Admin configuration

`admin/jsonConfig.json` (`common.adminUI.config = "json"`, admin >= 7). Translations are the flat `admin/i18n/<lang>.json` files, selected by `"i18n": true`. Devices are stored as the strings `"Auto"` / `"off"` (selects, not checkboxes) to stay compatible with existing instances.

Configurations of old versions (`mm11_t`…`mm13_t`, keys without `_t`/`_n`) were converted by the old HTML dialog when it was opened. JsonConfig cannot do that, so `migrateConfig()` converts them in `onReady` and writes the instance object, which restarts the instance once. `port`, `polling_interval` and `bool_bar` may still be strings in old instances.

Always use `this.setTimeout` / `this.setInterval` (adapter-core, auto-cleared on unload), never the globals.

## Conventions

- Changelog entries go under `### **WORK IN PROGRESS**` in `README.md`; `common.news` in `io-package.json` is written by the release script.
- User documentation is in `docs/de/README.md` and `docs/en/README.md`.
- Unit tests use `node:assert`, no assertion library.
- Release only after a green CI run: `npm run release-major` / `-minor` / `-patch`. The deploy job publishes to npm with trusted publishing and creates the Sentry release.
