// Data-layer logic for storing app data as a single JSON file in a shared
// Google Drive folder.
//
// IMPORTANT: this deliberately never calls drive.files.create(). Service
// accounts have been given 0 GB of storage quota by Google since April 2025,
// so a service account can never own a newly-created file — every create
// attempt fails with "Service Accounts do not have storage quota", no
// matter what folder access it has. The fix is for a real Google account
// (you) to create the file once, so a real account owns it; the service
// account then only ever UPDATES that existing file's content, which never
// requires quota. See README "Step 3.5" for how to create the file.

const FILE_NAME = "cable-tracker-data.json";

function createStore(drive, folderId) {
  let cachedFileId = null;

  async function findFile() {
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

    throw new Error(
      `Couldn't find "${FILE_NAME}" in the shared Drive folder. You need to create this file ` +
      `yourself first (Google service accounts can't create new files — see README "Create the data file"), ` +
      `then make sure it's inside the folder you shared with the service account.`
    );
  }

  async function readData() {
    const fileId = await findFile();
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    let raw = res.data;
    if (typeof raw === "object") return raw; // some transports pre-parse JSON for us
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `The Drive file's content isn't valid JSON (${e.message}). If you created it by hand, ` +
        `make sure its contents are exactly: {"weights":{},"sessions":[]}`
      );
    }
  }

  async function writeData(data) {
    const fileId = await findFile();
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

  return { findFile, readData, writeData, withWriteLock };
}

module.exports = { createStore, FILE_NAME };