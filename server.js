// Import necessary modules
const express = require("express");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

// --- Configuration Loading ---
const CONFIG_PATH = path.join(__dirname, "config.json");
// Define default config including the new mode
const DEFAULT_CONFIG = { daysToKeep: 7, serverDataMode: "daily" };
let config = { ...DEFAULT_CONFIG }; // Start with a copy of defaults

try {
    if (fs.existsSync(CONFIG_PATH)) {
        const rawConfig = fs.readFileSync(CONFIG_PATH, "utf8");
        const loadedConfig = JSON.parse(rawConfig);
        // Merge loaded config with defaults to ensure all keys exist
        config = { ...DEFAULT_CONFIG, ...loadedConfig };

        // Validate serverDataMode
        if (config.serverDataMode !== "daily" && config.serverDataMode !== "single") {
            console.warn(
                `Invalid 'serverDataMode' in config.json ("${config.serverDataMode}"). Using default: "${DEFAULT_CONFIG.serverDataMode}"`,
            );
            config.serverDataMode = DEFAULT_CONFIG.serverDataMode;
        }
        // Validate daysToKeep (only relevant for 'daily' mode)
        if (config.serverDataMode === "daily" && typeof config.daysToKeep !== "number") {
            console.warn(
                `Invalid 'daysToKeep' in config.json for daily mode. Using default: ${DEFAULT_CONFIG.daysToKeep}`,
            );
            config.daysToKeep = DEFAULT_CONFIG.daysToKeep;
        }
        console.log("Loaded configuration from config.json:", config);
    } else {
        fs.writeFileSync(
            CONFIG_PATH,
            JSON.stringify(DEFAULT_CONFIG, null, 2),
            "utf8",
        );
        console.log(
            "config.json not found. Created with default settings:",
            DEFAULT_CONFIG,
        );
        config = { ...DEFAULT_CONFIG }; // Use defaults
    }
} catch (error) {
    console.error(
        "Error loading or creating config.json. Using default settings.",
        error,
    );
    config = { ...DEFAULT_CONFIG }; // Reset to defaults on error
}

// --- Constants and Initialization ---
const app = express();
const PORT = 3000;
const SERVER_DATA_DIR = path.join(__dirname, "server_data");
const DAYS_TO_KEEP = config.daysToKeep; // Still used for 'daily' mode cleanup
const SERVER_DATA_MODE = config.serverDataMode; // 'daily' or 'single'
const SINGLE_DATA_FILENAME = "server_data.bin"; // Fixed name for single mode

// Create the directory for server data files if it doesn't exist
if (!fs.existsSync(SERVER_DATA_DIR)) {
    fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
    console.log(`Created directory: ${SERVER_DATA_DIR}`);
}

/**
 * Gets the expected server data filename based on the current mode.
 * For 'daily' mode, it includes the date.
 * For 'single' mode, it's a fixed name.
 * @returns {string} The filename.
 */
function getServerDataFilename() {
    if (SERVER_DATA_MODE === "single") {
        return SINGLE_DATA_FILENAME;
    } else {
        // Default to daily mode behavior
        const date = new Date().toISOString().split("T")[0];
        return `server_data_${date}.bin`;
    }
}

/**
 * Gets the full path for the server data file based on the current mode.
 * @param {string} [date] - Optional date string (YYYY-MM-DD) for daily mode lookup.
 *                          If omitted in daily mode, uses today's date.
 * @returns {string} The full file path.
 */
function getServerDataFilePath(date) {
    if (SERVER_DATA_MODE === "single") {
        return path.join(SERVER_DATA_DIR, SINGLE_DATA_FILENAME);
    } else {
        const targetDate = date || new Date().toISOString().split("T")[0];
        const fileName = `server_data_${targetDate}.bin`;
        return path.join(SERVER_DATA_DIR, fileName);
    }
}

/**
 * Creates the server data file if it doesn't exist (for single mode)
 * or creates today's file (for daily mode).
 */
function createServerDataFileIfNeeded() {
    const filePath = getServerDataFilePath(); // Gets path based on mode (today's date if daily)
    const fileName = path.basename(filePath);

    // In single mode, only create if it *doesn't* exist.
    if (SERVER_DATA_MODE === "single" && fs.existsSync(filePath)) {
        console.log(
            `Single data file '${fileName}' already exists. No action needed.`,
        );
        return;
    }

    // In daily mode, we always create/overwrite today's file (handled by manage function)
    // This function ensures *initial* creation or creation if missing.

    console.log(`Attempting to create server data file: ${fileName}`);
    const sizeInBytes = 1024 * 1024 * 10; // 10 MB
    const buffer = Buffer.alloc(sizeInBytes);
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
    }

    try {
        fs.writeFileSync(filePath, buffer);
        console.log(`${fileName} created successfully.`);
    } catch (err) {
        console.error(`Error creating file ${fileName}:`, err);
    }
}

/**
 * Deletes old server data files ONLY if in 'daily' mode and DAYS_TO_KEEP is not -1.
 */
function deleteOldestServerDataFiles() {
    // Only run cleanup in daily mode
    if (SERVER_DATA_MODE !== "daily") {
        console.log(
            `Server mode is '${SERVER_DATA_MODE}'. Skipping daily file cleanup.`,
        );
        return;
    }

    // If daysToKeep is -1 in daily mode, keep files indefinitely
    if (DAYS_TO_KEEP === -1) {
        console.log(
            "Daily mode with file retention set to indefinite (daysToKeep = -1). Skipping cleanup.",
        );
        return;
    }

    const effectiveDaysToKeep = Math.max(1, DAYS_TO_KEEP);

    try {
        // Read only .bin files to avoid issues with other files
        const files = fs
            .readdirSync(SERVER_DATA_DIR)
            .filter((file) => file.startsWith("server_data_") && file.endsWith(".bin"));

        files.sort(); // Sorts oldest to newest (YYYY-MM-DD)

        const filesToDeleteCount = files.length - effectiveDaysToKeep;

        if (filesToDeleteCount > 0) {
            console.log(
                `Daily Mode: Found ${files.length} files, configured to keep ${effectiveDaysToKeep}. Deleting ${filesToDeleteCount} oldest files.`,
            );
            const filesToDelete = files.slice(0, filesToDeleteCount);
            for (const fileToDelete of filesToDelete) {
                const filePathToDelete = path.join(SERVER_DATA_DIR, fileToDelete);
                try {
                    fs.unlinkSync(filePathToDelete);
                    console.log(`${fileToDelete} deleted.`);
                } catch (unlinkErr) {
                    console.error(`Error deleting file ${fileToDelete}:`, unlinkErr);
                }
            }
        } else {
            console.log(
                `Daily Mode: Found ${files.length} files, within limit of ${effectiveDaysToKeep}. No files deleted.`,
            );
        }
    } catch (err) {
        console.error(
            "Error during daily file cleanup:",
            err,
        );
    }
}

/**
 * Manages the server data files based on the configured mode.
 * Daily: Deletes old files and creates today's file.
 * Single: Does nothing (creation handled at startup if needed).
 */
function manageServerDataFiles() {
    if (SERVER_DATA_MODE === "daily") {
        console.log("Running daily server data file management...");
        deleteOldestServerDataFiles();
        createServerDataFileIfNeeded(); // Creates today's file
    } else {
        // No daily action needed for single mode
        console.log("Server mode is 'single'. Daily management task skipped.");
    }
}

// --- Initialization ---
console.log(`Server starting in '${SERVER_DATA_MODE}' mode.`);
try {
    // Check if the *required* file for the current mode exists, create if not.
    const requiredFilePath = getServerDataFilePath();
    if (!fs.existsSync(requiredFilePath)) {
        console.log(
            `Initial data file (${path.basename(requiredFilePath)}) not found. Creating...`,
        );
        createServerDataFileIfNeeded();
    } else {
        console.log(
            `Initial data file (${path.basename(requiredFilePath)}) found.`,
        );
    }

    // Run cleanup on startup only if in daily mode
    if (SERVER_DATA_MODE === "daily") {
        deleteOldestServerDataFiles();
    }
} catch (err) {
    console.error("Error during server initialization:", err);
}

// --- Scheduled Task ---
// Cron job only relevant for 'daily' mode file management
if (SERVER_DATA_MODE === "daily") {
    cron.schedule(
        "0 0 * * *", // Daily at midnight
        () => {
            manageServerDataFiles();
        },
        {
            scheduled: true,
            timezone: "Etc/UTC",
        },
    );
    console.log("Scheduled daily task for 'daily' mode.");
} else {
    console.log("Daily task scheduling skipped for 'single' mode.");
}

// --- Server Setup ---
app.use(express.static("public"));

// --- API Endpoints ---

// Endpoint to provide configuration to the frontend
app.get("/config", (req, res) => {
    // Send necessary config values
    res.json({
        daysToKeep: DAYS_TO_KEEP,
        serverDataMode: SERVER_DATA_MODE,
    });
});

// Endpoint to download server data.
// In 'single' mode, ignores the date param and serves the single file.
// In 'daily' mode, uses the date param to find the correct file.
app.get("/download/:date", (req, res) => {
    const requestedDate = req.params.date; // Might be ignored
    let filePath;
    let fileName;

    if (SERVER_DATA_MODE === "single") {
        filePath = getServerDataFilePath(); // Gets the single file path
        fileName = SINGLE_DATA_FILENAME;
        console.log(
            `Single mode: Request received (date param ignored), serving '${fileName}'`,
        );
    } else {
        // Daily mode: use the requested date
        filePath = getServerDataFilePath(requestedDate);
        fileName = path.basename(filePath);
        console.log(`Daily mode: Request received for date ${requestedDate}.`);
    }

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error(`Error sending file ${fileName}:`, err);
            } else {
                console.log(`Successfully sent file: ${fileName}`);
            }
        });
    } else {
        console.log(`File not found: ${filePath}`);
        res
            .status(404)
            .send(
                `File (${fileName}) not found. Data may not exist or has expired (if applicable).`,
            );
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving data files from: ${SERVER_DATA_DIR}`);
    console.log(`Operating in '${SERVER_DATA_MODE}' mode.`);
    if (SERVER_DATA_MODE === "daily") {
        if (DAYS_TO_KEEP === -1) {
            console.log("-> Configured to keep daily data files indefinitely.");
        } else {
            console.log(`-> Configured to keep daily data files for ${DAYS_TO_KEEP} days.`);
        }
    } else {
        console.log(`-> Using single data file: ${SINGLE_DATA_FILENAME}`);
    }
});
