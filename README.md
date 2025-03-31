# ByteVault 🔐

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A configurable web application demonstrating a concept for secure file handling using time-sensitive or persistent server data and local browser processing. Store a file reference (key) and reconstruct it later using server data, all without uploading your original file! ✨

## 🤔 How It Works

ByteVault uses a unique, locally processed approach:

1.  **Server Setup:**
    *   The Node.js server reads a `config.json` file on startup.
    *   **Mode Selection (`serverDataMode`):**
        *   `"daily"`: The server generates a *new*, large, random data file (`server_data_YYYY-MM-DD.bin`) every day at midnight. Old files are automatically deleted based on the `daysToKeep` setting in `config.json` (set to `-1` to keep forever).
        *   `"single"`: The server creates and uses *only one* fixed data file (`server_data.bin`). This file is never deleted automatically.
    *   The server makes this data file(s) available for download via an API endpoint.

2.  **Generate Key File:**
    *   You select a file on your computer.
    *   Your browser requests the *appropriate* server data file via the `/download/...` endpoint.
        *   In `"daily"` mode, it requests the file for the *current date*.
        *   In `"single"` mode, it requests the fixed `server_data.bin` (the date in the request is ignored by the server).
    *   Locally, in your browser, JavaScript finds the position (index) of *each byte* of your original file within the downloaded server data.
    *   These positions, along with the date used for the request (important for `"daily"` mode reconstruction) and the original file extension, are saved into a small JSON file (`yourfile_key.json`). This is your "key".
    *   **Crucially, your original file never leaves your computer.** Only the key file is generated.

3.  **Reconstruct File:**
    *   You upload the `_key.json` file you previously generated.
    *   The browser reads the `date` stored inside the key file.
    *   It requests the server data file via `/download/[date_from_key]`.
        *   In `"daily"` mode, the server attempts to find the data file matching that specific date.
        *   In `"single"` mode, the server ignores the date and serves the fixed `server_data.bin`.
    *   If the required server data exists (it might have been deleted in `"daily"` mode if the key is too old), it's sent to your browser.
    *   Locally, JavaScript uses the positions stored in the key file to look up the original bytes within the downloaded server data.
    *   These bytes are reassembled in the correct order, and you are prompted to download the reconstructed file.

## ✨ Key Features

*   **🔒 Privacy Focused:** Your original files are **never** uploaded to the server. All processing happens locally in your browser.
*   **⚙️ Configurable Modes:** Choose between daily rotating data files (`"daily"`) or a single persistent data file (`"single"`) via `config.json`.
*   **⏱️ Time-Limited Access (Daily Mode):** In `"daily"` mode, keys are tied to daily server data. Configure retention (`daysToKeep`) or set to `-1` for indefinite storage.
*   **♾️ Persistent Access (Single Mode):** In `"single"` mode, keys remain valid as long as the single server data file exists.
*   **💻 Simple Web Interface:** Easy-to-use interface for generating keys and reconstructing files.
*   **🤖 Automated Server Management:** Node.js backend manages data file creation and cleanup (in daily mode) automatically based on `config.json`.

## 💻 Tech Stack

*   **Backend:** Node.js, Express.js
*   **Scheduled Tasks:** node-cron (for daily mode)
*   **Frontend:** HTML, CSS, Vanilla JavaScript (ES6+)
*   **File Handling:** FileReader API, Blob, ArrayBuffer, Uint8Array

## 🚀 Getting Started

### Prerequisites

*   Node.js (v14 or later recommended)
*   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/DieHardcoreIT/bytevault.git # Replace with your repo URL
    cd bytevault
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

### Configuration

1.  A `config.json` file will be created automatically in the project root if it doesn't exist upon first run, with default settings:
    ```json
    {
      "daysToKeep": 7,
      "serverDataMode": "daily"
    }
    ```
2.  **Edit `config.json`** to your desired settings:
    *   `daysToKeep`: (Only applies when `serverDataMode` is `"daily"`)
        *   Number of days to keep daily `.bin` files (e.g., `7`).
        *   Set to `-1` to keep daily files indefinitely.
        *   Set to `0` or `1` to keep only the current day's file.
    *   `serverDataMode`:
        *   `"daily"`: Generate a new file each day, delete old ones based on `daysToKeep`.
        *   `"single"`: Use one fixed `server_data.bin` file, never delete automatically.

### Running the Application

1.  **Start the server:**
    ```bash
    node server.js
    ```
    *(The server will log the mode it's running in and the configuration it loaded)*
2.  **Access the web interface:**
    Open your browser and navigate to `http://localhost:3000` (or the port specified in `server.js`).

The server will automatically create the `server_data` directory and the necessary data file(s) based on the configuration.

## ⚠️ Important Notes

*   **Key Validity:**
    *   In `"daily"` mode, key files are only valid as long as the corresponding daily server data exists (controlled by `daysToKeep`).
    *   In `"single"` mode, key files remain valid as long as the `server_data.bin` file exists on the server.
*   **Server Data:** The `server_data*.bin` files are filled with random bytes. They do **not** contain any part of user files.
*   **Byte Not Found:** If a byte from your original file doesn't happen to exist in the relevant server data file, key generation will fail for that file. This is a limitation of this specific concept.
*   **Performance:** Processing very large files or very large server data files directly in the browser might be slow or memory-intensive.
*   **Security Concept:** This is a conceptual project. While it avoids uploading the original file, the security relies on the key file and the *correct* server data file not being compromised simultaneously. The `"daily"` mode adds a layer of temporal security by default.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/DieHardcoreIT/bytevault/issues).

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Happy Vaulting! 🎉
