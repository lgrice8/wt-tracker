// Data-layer logic for storing app data as a single JSON file in a shared
// Google Drive folder. The Drive client is injected (see driveClient.js for
// the real one) so this file's logic can be tested with a mock client.

const FILE_NAME = "cable-tracker-data.json";

function createStore(drive, folderId) {
  let cachedFileId = null;

  async function findOrCreateFile() {
    if (cachedFileId) return cachedFileId;
    if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");

    const list = await drive.files.list({
      q: `'${folderId}' in parents and name = '${FILE_NAME}' and trashed = false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (list.data.files && list.data.files.length > 0) {
      cachedFileId = list.data.files[0].id;
      return cachedFileId;
    }

    const initial = { weights: {}, sessions: [] };
    const created = await drive.files.create({
      requestBody: { name: FILE_NAME, parents: [folderId], mimeType: "application/json" },
      media: { mimeType: "application/json", body: JSON.stringify(initial) },
      fields: "id",
    });
    cachedFileId = created.data.id;
    return cachedFileId;
  }

  async function readData() {
    const fileId = await findOrCreateFile();
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    let raw = res.data;
    if (typeof raw === "object") return raw; // some transports pre-parse JSON for us
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("Drive file content was not valid JSON: " + e.message);
    }
  }

  async function writeData(data) {
    const fileId = await findOrCreateFile();
    await drive.files.update({
      fileId,
      media: { mimeType: "application/json", body: JSON.stringify(data) },
    });
  }

  // Serialize writes within this process so two near-simultaneous requests
  // (e.g. a weight autosave and a session log) can't clobber each other with
  // a stale read-modify-write. This does NOT protect against edits made
  // directly in Drive by hand while the server is also writing.
  let writeQueue = Promise.resolve();
  function withWriteLock(fn) {
    const run = writeQueue.then(fn, fn);
    writeQueue = run.then(() => {}, () => {});
    return run;
  }

  return { findOrCreateFile, readData, writeData, withWriteLock };
}

module.exports = { createStore, FILE_NAME };
