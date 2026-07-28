const express = require("express");
const path = require("path");
const { createStore } = require("./driveStore");
const { getDriveClient, getFolderId } = require("./driveClient");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

let store = null;
function getStore() {
  if (store) return store;
  store = createStore(getDriveClient(), getFolderId());
  return store;
}

app.get("/api/state", async (req, res) => {
  try {
    const data = await getStore().readData();
    res.json({ weights: data.weights || {} });
  } catch (err) {
    console.error("GET /api/state failed:", err);
    res.status(500).json({ error: err.message || "Failed to load weights" });
  }
});

app.put("/api/state", async (req, res) => {
  const { weights } = req.body || {};
  if (!weights || typeof weights !== "object") {
    return res.status(400).json({ error: "Body must include a 'weights' object" });
  }
  try {
    await getStore().withWriteLock(async () => {
      const data = await getStore().readData();
      data.weights = weights;
      await getStore().writeData(data);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/state failed:", err);
    res.status(500).json({ error: err.message || "Failed to save weights" });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const data = await getStore().readData();
    const sessions = (data.sessions || []).slice().sort((a, b) => a.ts - b.ts);
    res.json({ sessions });
  } catch (err) {
    console.error("GET /api/sessions failed:", err);
    res.status(500).json({ error: err.message || "Failed to load sessions" });
  }
});

app.post("/api/sessions", async (req, res) => {
  const { day, weights, date } = req.body || {};
  if (!day || !weights || typeof weights !== "object") {
    return res.status(400).json({ error: "Body must include 'day' and a 'weights' object" });
  }
  const ts = Date.now();
  const sessionDate = date || new Date().toISOString().slice(0, 10);
  const session = { id: ts, ts, date: sessionDate, day, weights };
  try {
    await getStore().withWriteLock(async () => {
      const data = await getStore().readData();
      data.sessions = data.sessions || [];
      data.sessions.push(session);
      data.weights = weights; // also update "current" weights
      await getStore().writeData(data);
    });
    res.status(201).json({ session });
  } catch (err) {
    console.error("POST /api/sessions failed:", err);
    res.status(500).json({ error: err.message || "Failed to log session" });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid session id" });
  try {
    await getStore().withWriteLock(async () => {
      const data = await getStore().readData();
      data.sessions = (data.sessions || []).filter((s) => s.id !== id);
      await getStore().writeData(data);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sessions/:id failed:", err);
    res.status(500).json({ error: err.message || "Failed to delete session" });
  }
});

// Confirms the service account can actually reach the shared folder —
// hit this after deploying to verify the setup worked.
app.get("/api/health", async (req, res) => {
  try {
    const fileId = await getStore().findOrCreateFile();
    res.json({ ok: true, drive: "connected", fileId });
  } catch (err) {
    res.status(500).json({ ok: false, drive: "disconnected", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Cable tracker running on port ${PORT}`));
