// --- Global variable to store config ---
let appConfig = { daysToKeep: 7, serverDataMode: "daily" }; // Default values

// --- DOM Element References ---
const uploadForm = document.getElementById("uploadForm");
const reconstructForm = document.getElementById("reconstructForm");
const fileInput = document.getElementById("fileInput");
const keyFileInput = document.getElementById("keyFileInput");
const status = document.getElementById("status");
const keyFileInfo = document.getElementById("keyFileInfo");
const validityInfoSpan = document.getElementById("validity-info");

// --- Helper function to update UI text based on config ---
function updateValidityInfo(mode, days) {
    let text = "";
    if (mode === "single") {
        text =
            "Server is in <strong>single file mode</strong>. Key files remain valid indefinitely as long as the server's single data file exists.";
    } else if (mode === "daily") {
        if (days === -1) {
            text =
                "Server is in <strong>daily file mode</strong>. Key files remain valid indefinitely as server data is configured to be kept permanently.";
        } else if (days === 1) {
            text =
                "Server is in <strong>daily file mode</strong>. Key files are valid only for <strong>1 day</strong>. After that, the server data required for reconstruction will no longer be available.";
        } else if (days >= 0) {
            const displayDays = Math.max(1, days);
            text = `Server is in <strong>daily file mode</strong>. Key files are valid for a maximum of <strong>${displayDays} days</strong>. After that, the server data required for reconstruction will no longer be available.`;
        } else {
            text =
                "Key file validity period is configured unexpectedly. Please check server configuration.";
        }
    } else {
        text = "Unknown server mode configured.";
    }

    if (validityInfoSpan) {
        validityInfoSpan.innerHTML = text; // Use innerHTML for <strong>
    }
}

// --- Function to fetch configuration from server ---
async function fetchConfig() {
    try {
        const response = await fetch("/config");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        appConfig = await response.json();
        console.log("Fetched config:", appConfig);
        updateValidityInfo(appConfig.serverDataMode, appConfig.daysToKeep);
    } catch (error) {
        console.error("Error fetching configuration:", error);
        status.textContent =
            "Error fetching server configuration. Using default settings.";
        status.className = "error-text";
        updateValidityInfo(appConfig.serverDataMode, appConfig.daysToKeep); // Update UI with defaults
    }
}

// --- Generate Key File Logic ---
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    keyFileInfo.textContent = "";
    status.className = "error-text";

    if (fileInput.files.length === 0) {
        status.textContent = "Please select a file.";
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const originalFileBuffer = new Uint8Array(event.target.result);
            // The 'date' is still relevant for *requesting* the download,
            // even if the server ignores it in single mode. Use today's date.
            const requestDate = new Date().toISOString().split("T")[0];
            const fileName = file.name.split(".").slice(0, -1).join(".");
            const fileExtension = file.name.split(".").pop();

            keyFileInfo.textContent = "Processing... Fetching server data.";
            keyFileInfo.className = "info-text";

            // Request using the date. Server decides which file to send based on its mode.
            const response = await fetch(`/download/${requestDate}`);
            if (!response.ok) {
                // Provide a more informative error based on mode potentially
                let errorMsg = `Server data for ${requestDate} not found. Status: ${response.status}.`;
                if (appConfig.serverDataMode === "single") {
                    errorMsg = `Could not fetch the single server data file. Status: ${response.status}.`;
                }
                throw new Error(errorMsg);
            }
            const serverDataBuffer = new Uint8Array(await response.arrayBuffer());

            keyFileInfo.textContent = "Processing... Generating key data.";

            const keyFileData = [];
            for (let i = 0; i < originalFileBuffer.length; i++) {
                const byte = originalFileBuffer[i];
                const position = serverDataBuffer.indexOf(byte);
                if (position === -1) {
                    throw new Error(
                        `Byte value ${byte} (at index ${i}) not found in server data (requested for ${requestDate}). Cannot generate key.`,
                    );
                }
                keyFileData.push(position);
            }

            // Store the date the key was *created* (used for the download request later)
            const keyFileContent = {
                date: requestDate, // Date used for the *request*
                fileExtension: fileExtension,
                positions: keyFileData,
            };

            keyFileInfo.textContent = "Processing... Creating download link.";

            const keyFileBlob = new Blob([JSON.stringify(keyFileContent)], {
                type: "application/json",
            });
            const url = window.URL.createObjectURL(keyFileBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${fileName}_key.json`;
            a.click();
            window.URL.revokeObjectURL(url);

            // --- Update success message based on config ---
            let validityMessage = "";
            if (appConfig.serverDataMode === "single") {
                validityMessage = "valid indefinitely (using single server file)";
            } else { // Daily mode
                if (appConfig.daysToKeep === -1) {
                    validityMessage = `valid indefinitely (using server data from ${requestDate})`;
                } else if (appConfig.daysToKeep === 1) {
                    validityMessage = `valid for 1 day (using server data from ${requestDate})`;
                } else if (appConfig.daysToKeep >= 0) {
                    const displayDays = Math.max(1, appConfig.daysToKeep);
                    validityMessage = `valid for ${displayDays} days (using server data from ${requestDate})`;
                }
            }

            keyFileInfo.textContent = `Key file (${a.download}) generated successfully. It is ${validityMessage}.`;
            // --- End of update ---
            keyFileInfo.className = "info-text";
            fileInput.value = "";
        } catch (error) {
            console.error("Key generation error:", error);
            status.textContent = `Error: ${error.message}`;
            status.className = "error-text";
            keyFileInfo.textContent = "";
        }
    };

    reader.onerror = (event) => {
        status.textContent = `File reading error: ${reader.error}`;
        status.className = "error-text";
        keyFileInfo.textContent = "";
    };

    reader.readAsArrayBuffer(file);
});

// --- Reconstruct File Logic ---
reconstructForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    keyFileInfo.textContent = "";
    status.className = "error-text";

    if (keyFileInput.files.length === 0) {
        status.textContent = "Please select a key file (.json).";
        return;
    }

    const keyFile = keyFileInput.files[0];
    if (!keyFile.name.endsWith(".json") || keyFile.type !== "application/json") {
        status.textContent = "Please select a valid JSON key file.";
        return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const keyFileContent = JSON.parse(event.target.result);
            if (
                !keyFileContent ||
                typeof keyFileContent.date !== "string" || // Still expect 'date' field
                typeof keyFileContent.fileExtension !== "string" ||
                !Array.isArray(keyFileContent.positions)
            ) {
                throw new Error("Invalid key file format.");
            }

            // Use the date from the key file for the download request.
            // The server will interpret this based on its current mode.
            const requestDate = keyFileContent.date;
            const fileExtension = keyFileContent.fileExtension;
            const keyFileData = keyFileContent.positions;

            status.textContent = "Processing... Fetching server data.";
            status.className = "info-text";

            const response = await fetch(`/download/${requestDate}`);
            if (!response.ok) {
                let errorMsg = `Server data for ${requestDate} not found. Status: ${response.status}. The key may be invalid or expired (if applicable).`;
                if (appConfig.serverDataMode === "single") {
                    errorMsg = `Could not fetch the single server data file (required by key created on ${requestDate}). Status: ${response.status}.`;
                } else if (response.status === 404) {
                    errorMsg = `Server data for ${requestDate} not found. The key has likely expired or is invalid.`;
                }
                throw new Error(errorMsg);
            }
            const serverDataBuffer = new Uint8Array(await response.arrayBuffer());

            status.textContent = "Processing... Reconstructing file.";

            const reconstructedFileBuffer = new Uint8Array(keyFileData.length);
            for (let i = 0; i < keyFileData.length; i++) {
                const position = keyFileData[i];
                if (position < 0 || position >= serverDataBuffer.length) {
                    throw new Error(
                        `Invalid position (${position}) found in key file at index ${i}. It's outside the bounds of the server data.`,
                    );
                }
                reconstructedFileBuffer[i] = serverDataBuffer[position];
            }

            status.textContent = "Processing... Creating download link.";

            const reconstructedFileBlob = new Blob([reconstructedFileBuffer], {
                type: "application/octet-stream",
            });
            const url = window.URL.createObjectURL(reconstructedFileBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reconstructed_file.${fileExtension}`;
            a.click();
            window.URL.revokeObjectURL(url);

            status.textContent = `File (${a.download}) reconstructed successfully.`;
            status.className = "info-text";
            keyFileInput.value = "";
        } catch (error) {
            console.error("Reconstruction error:", error);
            status.textContent = `Error: ${error.message}`;
            status.className = "error-text";
        }
    };

    reader.onerror = (event) => {
        status.textContent = `Key file reading error: ${reader.error}`;
        status.className = "error-text";
    };

    reader.readAsText(keyFile);
});

// --- Initial Setup ---
// Fetch the configuration when the script loads
fetchConfig();
