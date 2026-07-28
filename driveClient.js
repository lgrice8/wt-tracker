// Thin wrapper that builds a real Google Drive API client from a service
// account key. Kept intentionally small — this is the one part of the app
// that talks to actual Google servers, so there's less surface here to get
// wrong versus in driveStore.js (which holds the logic and is unit-tested).

const { google } = require("googleapis");

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set. Paste your service account " +
      "JSON key, base64-encoded, into Render's environment variables."
    );
  }
  let json;
  try {
    json = Buffer.from(raw, "base64").toString("utf8");
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 could not be base64-decoded");
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error("Decoded GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not valid JSON — check it was copied correctly");
  }
}

let drive = null;
function getDriveClient() {
  if (drive) return drive;
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    // Full "drive" scope on the service account is safe here: the service
    // account has NO access to anything until you explicitly share a folder
    // with its email address. Scope breadth doesn't widen that.
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  drive = google.drive({ version: "v3", auth });
  return drive;
}

function getFolderId() {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID environment variable is not set");
  return id;
}

module.exports = { getDriveClient, getFolderId };