# ByteVault

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ByteVault is a small, configurable web application that demonstrates a concept for file-based “keys”.
The original file is never uploaded. Instead, a local key is generated that allows you to reconstruct
the file later using server-side random data.

---

## Table of contents

* [Idea in short](#idea-in-short)
* [How it works](#how-it-works)
* [Operating modes](#operating-modes)
* [Features](#features)
* [Limitations and security model](#limitations-and-security-model)
* [Installation](#installation)
* [Configuration](#configuration)
* [Running the application](#running-the-application)
* [Notes](#notes)
* [Contributing](#contributing)
* [License](#license)

---

## Idea in short

* The server maintains one or more binary files with random bytes (`server_data*.bin`).
* The browser downloads this data and searches for the position of each byte of the original file
  in the server data.
* The byte positions plus metadata (date, file extension) are stored in a small JSON file
  (`*_key.json`).
* Later, the original file can be reconstructed locally in the browser from the matching
  `server_data*.bin` file and the key.
* The original file never leaves the user’s machine.

This repository is a proof of concept, not a production-ready solution.

---

## How it works

### 1. Server side

* On startup, the Node.js server reads a `config.json` file.
* Depending on `serverDataMode` it either:

  * creates a new random data file per day, or
  * uses a single persistent data file.
* The file(s) live in the `server_data` directory and are exposed via a download route.

### 2. Generating the key file

* The user selects a local file in the browser.
* The browser requests the corresponding server data file via `/download/...`:

  * in mode `"daily"`: the file for the current date,
  * in mode `"single"`: the fixed `server_data.bin` (the date in the URL is ignored server-side).
* In the browser:

  * the original file is read (FileReader, ArrayBuffer, Uint8Array),
  * for each byte of the original file, the index of that byte value is searched in the
    server data array,
  * the found positions, the used date, and the original file extension are stored in a
    JSON file (`<name>_key.json`).

The original file is never sent to the server.

### 3. Reconstructing the file

* The user uploads the previously generated `_key.json`.
* The browser reads from it:

  * the date (relevant for `"daily"`),
  * the byte positions,
  * the original file extension.
* The browser requests the matching server data via `/download/[date_from_key]`:

  * `"daily"`: tries to load the file for that specific date,
  * `"single"`: ignores the date and always serves `server_data.bin`.
* If the corresponding server data file still exists:

  * the bytes at the stored positions are read,
  * they are reassembled in the original order,
  * a Blob is created and offered for download.

---

## Operating modes

The mode is controlled via `serverDataMode` in `config.json`.

* `"daily"`

  * A file `server_data_YYYY-MM-DD.bin` is created per day.
  * Old files are deleted based on `daysToKeep` (unless `daysToKeep = -1`).
  * Keys are effectively usable only as long as the matching daily file exists.

* `"single"`

  * A single file `server_data.bin` is used.
  * This file is not deleted automatically.
  * Keys remain valid as long as this file exists and is unchanged.

---

## Features

* Original files are never uploaded; content-related processing happens in the browser.
* Server data is created and managed automatically:

  * daily rotation including cleanup, or
  * a single persistent file.
* Simple web UI to:

  * generate key files from local files,
  * reconstruct original files from key + server data.
* Configuration via a small JSON file.

---

## Limitations and security model

This project is a concept, not a full security product. Important aspects:

* Security depends on:

  * the key (`*_key.json`) and
  * the corresponding server data file
    not being compromised together.
* In `"daily"` mode, the limited lifetime of daily files reduces the time window
  for reconstruction.
* `server_data*.bin` only contains random bytes; it does not include any user data.
* Concept limitation:

  * If a specific byte value of the original file does not appear in the relevant
    server data file, a complete key cannot be generated.
* Performance:

  * Very large original files or very large `server_data*.bin` files can cause
    high memory and CPU usage in the browser.
* Integrity:

  * Any change to `server_data*.bin` after key generation will break existing keys.

---

## Installation

### Requirements

* Node.js (recommended: v14 or newer)
* npm or yarn

### Steps

```bash
git clone https://github.com/DieHardcoreIT/bytevault.git
cd bytevault

npm install
# or
yarn install
```

---

## Configuration

On first run, a `config.json` file is created automatically in the project root if it
does not exist:

```json
{
  "daysToKeep": 7,
  "serverDataMode": "daily"
}
```

Adjustable fields:

* `daysToKeep` (only relevant for `"daily"`):

  * number of days to keep daily files (e.g. `7`),
  * `-1`: files are never deleted automatically,
  * `0` or `1`: only keep the current day’s file.
* `serverDataMode`:

  * `"daily"`: new file per day, automatic cleanup based on `daysToKeep`,
  * `"single"`: one persistent `server_data.bin`, no automatic deletion.

---

## Running the application

```bash
node server.js
```

The server logs the active mode and the loaded configuration.

By default, the frontend is available at `http://localhost:3000`
(the port can be changed in `server.js`).

On startup:

* the `server_data` directory is created if it does not exist,
* the appropriate server data file is created or reused depending on the mode,
* in `"daily"` mode, creation and cleanup jobs are scheduled.

---

## Notes

* Key validity:

  * `"daily"`: keys are only valid as long as the server data file for the stored date exists,
  * `"single"`: keys stay valid as long as `server_data.bin` is available and unchanged.
* If, during key generation, a byte from the original file cannot be found in the
  server data file, the process fails.
* This repository is a technical demonstration of an approach for “indirect” file
  storage and reconstruction.

---

## Contributing

Issues, bug reports, and pull requests are welcome.
Open items and ideas can be found in the
[issues section](https://github.com/DieHardcoreIT/bytevault/issues).

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
