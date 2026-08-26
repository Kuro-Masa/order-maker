import { AppStoreProvider, useApp } from "./state/AppStoreContext";
import { TopBar } from "./features/topbar/TopBar";
import { BottomToolbar } from "./features/toolbar/BottomToolbar";
import { GridView } from "./features/grid/GridView";
import { ListScreen } from "./screens/ListScreen";

function ShareBanner() {
  const { shareUrl, dismissShareUrl } = useApp();
  if (!shareUrl) return null;
  return (
    <div className="shareBanner">
      <span className="shareBannerLabel">共有リンク（クリップボードにコピー済み）:</span>
      <a className="shareBannerUrl" href={shareUrl} target="_blank" rel="noopener noreferrer">
        {shareUrl}
      </a>
      <button type="button" className="shareBannerClose" onClick={dismissShareUrl} aria-label="閉じる">✕</button>
    </div>
  );
}

function EditScreen() {
  return (
    <div className="editScreen">
      <h1 className="sr-only">オーダーメーカー</h1>
      <TopBar />
      <ShareBanner />
      <div className="editBody">
        <GridView />
      </div>
      <BottomToolbar />
    </div>
  );
}

function AppShell() {
  const { screen } = useApp();
  if (screen === "list") return <ListScreen />;
  return <EditScreen />;
}

export default function App() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  );
}
