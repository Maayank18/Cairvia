import { useEffect, useState } from "react";
import { Banner, SyncStatus } from "@cairvia/ui";
import { NowPage } from "./pages/Now";
import { ThreadPage } from "./pages/Thread";
import { AutomationsPage } from "./pages/Automations";
import { ControlPage } from "./pages/Control";
import { StoryPage } from "./story/StoryPage";
import { api } from "./api";
import { useCairviaSync } from "./useSync";

const PRODUCT = ["now", "threads", "automations", "control"] as const;
const VIEWS = ["story", ...PRODUCT] as const;
type View = (typeof VIEWS)[number];

function parseHash(): View {
  const raw = location.hash.replace("#", "");
  if (raw === "thread") {
    return "threads";
  }
  if ((PRODUCT as readonly string[]).includes(raw)) {
    return raw as View;
  }
  return "story";
}

export default function App() {
  const [view, setView] = useState<View>(parseHash);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [apiUp, setApiUp] = useState(true);
  const sync = useCairviaSync();

  useEffect(() => {
    const onHash = () => setView(parseHash());
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    void api("/health")
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false));
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  function go(next: View) {
    setView(next);
    location.hash = next === "story" ? "" : next;
  }

  const connection = offline || !apiUp ? "OFFLINE" : sync.state;

  return (
    <div className="shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go("story")}>
          CAIRVIA
        </button>
        <nav aria-label="Cairvia">
          {PRODUCT.map((item) => (
            <button
              key={item}
              type="button"
              aria-current={view === item ? "page" : undefined}
              onClick={() => go(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="sync-slot">
          <SyncStatus state={connection} lastSyncAt={sync.lastSyncAt} />
          <button type="button" className="open-cairvia" onClick={() => go("now")}>
            Open Cairvia
          </button>
        </div>
      </header>
      {view === "story" ? (
        <StoryPage onOpen={() => go("now")} />
      ) : (
        <main className="workspace">
          <header className="page-head">
            <p className="eyebrow">Control Center</p>
            <h1>Keep the thread. Continue the work.</h1>
          </header>
          {offline || !apiUp ? (
            <Banner>You're offline. Your last saved context is available.</Banner>
          ) : (
            <Banner>Using the last saved Work Thread.</Banner>
          )}
          {view === "now" ? <NowPage /> : null}
          {view === "threads" ? <ThreadPage /> : null}
          {view === "automations" ? <AutomationsPage /> : null}
          {view === "control" ? <ControlPage /> : null}
        </main>
      )}
    </div>
  );
}
