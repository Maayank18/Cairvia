import { useEffect, useState } from "react";
import { Banner } from "@cairvia/ui";
import { NowPage } from "./pages/Now";
import { ThreadPage } from "./pages/Thread";
import { AutomationsPage } from "./pages/Automations";
import { ControlPage } from "./pages/Control";
import { api } from "./api";

const SCREENS = ["now", "thread", "automations", "control"] as const;
type Screen = (typeof SCREENS)[number];

export default function App() {
  const [screen, setScreen] = useState<Screen>("now");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [apiUp, setApiUp] = useState(true);

  useEffect(() => {
    const hash = location.hash.replace("#", "") as Screen;
    if (SCREENS.includes(hash)) {
      setScreen(hash);
    }
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    void api("/health")
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false));
  }, []);

  function go(next: Screen) {
    setScreen(next);
    location.hash = next;
  }

  return (
    <div className="app">
      <header>
        <div>
          <p>Cairvia</p>
          <h1>Control Center</h1>
        </div>
        <p>Keep the thread. Continue the work.</p>
      </header>
      {offline || !apiUp ? (
        <Banner>Offline — using local Work Thread. Start the local API if this screen is empty.</Banner>
      ) : (
        <Banner>Using local Work Thread.</Banner>
      )}
      <nav aria-label="Control Center">
        {SCREENS.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={screen === item ? "page" : undefined}
            onClick={() => go(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {screen === "now" ? <NowPage /> : null}
      {screen === "thread" ? <ThreadPage /> : null}
      {screen === "automations" ? <AutomationsPage /> : null}
      {screen === "control" ? <ControlPage /> : null}
    </div>
  );
}
