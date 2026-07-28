const assert = require("assert");
const { createStore } = require("./driveStore");

// A small in-memory fake that mimics the shape of the googleapis Drive
// client responses this app actually uses (files.list/create/get/update).
function createMockDrive({ latencyMs = 0 } = {}) {
  const files = {};
  let idCounter = 1;
  const delay = () => (latencyMs ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve());

  return {
    files: {
      list: async ({ q }) => {
        await delay();
        const m = q.match(/'(.+)' in parents and name = '(.+)' and trashed/);
        const [, folderId, name] = m;
        const found = Object.entries(files)
          .filter(([, f]) => f.parents.includes(folderId) && f.name === name)
          .map(([id, f]) => ({ id, name: f.name }));
        return { data: { files: found } };
      },
      create: async ({ requestBody, media }) => {
        await delay();
        const id = "file" + idCounter++;
        files[id] = { name: requestBody.name, parents: requestBody.parents, content: media.body };
        return { data: { id } };
      },
      get: async ({ fileId }) => {
        await delay();
        if (!files[fileId]) throw new Error("File not found: " + fileId);
        return { data: files[fileId].content };
      },
      update: async ({ fileId, media }) => {
        await delay();
        if (!files[fileId]) throw new Error("File not found: " + fileId);
        files[fileId].content = media.body;
        return { data: {} };
      },
    },
    _debug: files,
  };
}

async function run() {
  // --- Test 1: find-or-create creates once, reuses cached id after ---
  {
    const drive = createMockDrive();
    const store = createStore(drive, "folder-abc");
    const id1 = await store.findOrCreateFile();
    const id2 = await store.findOrCreateFile();
    assert.strictEqual(id1, id2, "should reuse cached file id");
    assert.strictEqual(Object.keys(drive._debug).length, 1, "should create exactly one file");
    console.log("✅ Test 1 passed: find-or-create + caching");
  }

  // --- Test 2: initial read returns empty scaffold, write then read round-trips ---
  {
    const drive = createMockDrive();
    const store = createStore(drive, "folder-abc");
    const initial = await store.readData();
    assert.deepStrictEqual(initial, { weights: {}, sessions: [] }, "initial data should be empty scaffold");

    await store.writeData({ weights: { a_chestpress: 45 }, sessions: [{ id: 1, ts: 1, date: "2026-07-27", day: "A", weights: { a_chestpress: 45 } }] });
    const after = await store.readData();
    assert.strictEqual(after.weights.a_chestpress, 45, "weight should persist");
    assert.strictEqual(after.sessions.length, 1, "session should persist");
    console.log("✅ Test 2 passed: read/write round-trip");
  }

  // --- Test 3: withWriteLock serializes concurrent read-modify-write ops ---
  // Without the lock, two concurrent "append a session" ops that each do
  // read -> modify -> write would race and one write could clobber the
  // other, losing a session. With the lock, both should be preserved.
  {
    const drive = createMockDrive({ latencyMs: 30 }); // exaggerate race window
    const store = createStore(drive, "folder-abc");
    await store.writeData({ weights: {}, sessions: [] }); // seed

    const appendSession = (label) =>
      store.withWriteLock(async () => {
        const data = await store.readData();
        data.sessions.push({ id: Date.now() + Math.random(), label });
        await store.writeData(data);
      });

    await Promise.all([appendSession("first"), appendSession("second")]);

    const final = await store.readData();
    assert.strictEqual(final.sessions.length, 2, "both concurrent session logs should be preserved, not clobbered");
    const labels = final.sessions.map((s) => s.label).sort();
    assert.deepStrictEqual(labels, ["first", "second"]);
    console.log("✅ Test 3 passed: concurrent writes serialized correctly, no data loss");
  }

  // --- Test 4: delete-by-id logic (as used by the DELETE /api/sessions/:id route) ---
  {
    const drive = createMockDrive();
    const store = createStore(drive, "folder-abc");
    await store.writeData({
      weights: {},
      sessions: [{ id: 100, day: "A" }, { id: 200, day: "B" }, { id: 300, day: "A" }],
    });
    await store.withWriteLock(async () => {
      const data = await store.readData();
      data.sessions = data.sessions.filter((s) => s.id !== 200);
      await store.writeData(data);
    });
    const after = await store.readData();
    assert.strictEqual(after.sessions.length, 2);
    assert.ok(!after.sessions.find((s) => s.id === 200), "deleted session should be gone");
    assert.ok(after.sessions.find((s) => s.id === 100), "other sessions should remain");
    console.log("✅ Test 4 passed: session deletion");
  }

  // --- Test 5: malformed JSON in the Drive file surfaces a clear error, doesn't crash silently ---
  {
    const drive = createMockDrive();
    const store = createStore(drive, "folder-abc");
    await store.findOrCreateFile(); // creates the file
    const fileId = Object.keys(drive._debug)[0];
    drive._debug[fileId].content = "{not valid json";
    try {
      await store.readData();
      assert.fail("should have thrown on invalid JSON");
    } catch (e) {
      assert.ok(e.message.includes("not valid JSON"), "error should clearly explain the problem: " + e.message);
      console.log("✅ Test 5 passed: malformed JSON surfaces a clear error");
    }
  }

  console.log("\n🎉 ALL driveStore.js LOGIC TESTS PASSED");
}

run().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exitCode = 1;
});
