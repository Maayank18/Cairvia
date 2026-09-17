const API = "http://127.0.0.1:47821";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cairvia-send-selection",
    title: "Send selection to Cairvia",
    contexts: ["selection"]
  });
});

connectSync();

function connectSync() {
  try {
    const source = new EventSource(`${API}/v1/sync/stream`);
    source.addEventListener("THREAD_UPDATED", () => {
      void chrome.storage.local.set({ lastSyncAt: new Date().toISOString() });
    });
    source.addEventListener("COMMITMENT_CONFIRMED", () => {
      void chrome.storage.local.set({ lastSyncAt: new Date().toISOString() });
    });
    source.addEventListener("AUTOMATION_UPDATED", () => {
      void chrome.storage.local.set({ lastSyncAt: new Date().toISOString() });
    });
    source.onerror = () => {
      source.close();
      setTimeout(connectSync, 2000);
    };
  } catch {
    setTimeout(connectSync, 2000);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const selectedText = info.selectionText;
    if (!selectedText) {
      await chrome.storage.local.set({
        lastError: "Nothing selected.",
        lastCandidate: null
      });
      return;
    }
    const response = await fetch(`${API}/context/selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText,
        pageTitle: tab?.title ?? null,
        pageUrl: tab?.url ?? null
      })
    });
    if (!response.ok) {
      throw new Error("Cairvia API unavailable");
    }
    const result = await response.json();
    await chrome.storage.local.set({
      lastCandidate: result.candidate,
      lastError: null,
      duplicate: result.duplicate,
      provenance: {
        sourceType: "browser.selection",
        sourceId: tab?.url ?? tab?.title ?? "unknown",
        capturedAt: new Date().toISOString(),
        permissionScope: "selected-text-and-page-title",
        pageTitle: tab?.title ?? null,
        pageUrl: tab?.url ?? null,
        shared: "title + selected text",
        notShared: "full browsing history"
      }
    });
  } catch (error) {
    await chrome.storage.local.set({
      lastError: error instanceof Error ? error.message : "Capture failed",
      lastCandidate: null
    });
  }
});
