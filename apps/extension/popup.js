const API = "http://127.0.0.1:47821";
const root = document.getElementById("root");

chrome.storage.local
  .get(["lastCandidate", "lastError", "duplicate", "provenance"])
  .then(render);

function render(state) {
  if (state.lastError) {
    root.innerHTML = `<p>${state.lastError}</p><p class="muted">Start the Cairvia local API if it is offline.</p>`;
    return;
  }
  const c = state.lastCandidate;
  if (!c) {
    root.innerHTML =
      "<p>Select text on a page, right-click, then Send selection to Cairvia.</p>";
    return;
  }
  const p = state.provenance;
  root.innerHTML = `
    <p class="muted">${state.duplicate ? "Duplicate event ignored." : "Candidate commitment"}</p>
    <h2>${c.proposedAction}</h2>
    <p>Deadline: ${c.deadline ?? "not stated"}</p>
    <p>Confidence: ${Number(c.confidence).toFixed(2)}</p>
    ${
      p
        ? `<p class="muted">Source: ${p.pageTitle ?? p.sourceId}<br/>Shared: ${p.shared}<br/>Not shared: ${p.notShared}</p>`
        : ""
    }
    ${c.needsClarification ? `<p>${c.clarificationPrompt}</p>` : ""}
    <div class="row">
      <button id="add" ${c.status === "WAITING_FOR_USER" ? "" : "disabled"}>Add</button>
      <button id="ignore" class="ghost">Ignore</button>
    </div>
  `;
  document.getElementById("add")?.addEventListener("click", () => decide(c.id, "add"));
  document.getElementById("ignore")?.addEventListener("click", () => decide(c.id, "reject"));
}

async function decide(id, decision) {
  try {
    await fetch(`${API}/commitments/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision })
    });
    const { lastCandidate } = await chrome.storage.local.get("lastCandidate");
    if (lastCandidate) {
      lastCandidate.status = decision === "add" ? "SUCCEEDED" : "REJECTED";
      await chrome.storage.local.set({ lastCandidate, lastError: null });
    }
    const next = await chrome.storage.local.get(["lastCandidate", "lastError", "duplicate"]);
    render(next);
  } catch {
    render({ lastError: "Could not reach Cairvia.", lastCandidate: null });
  }
}
