import { AppStoreProvider, useApp } from "./state/AppStoreContext";
import { TopBar } from "./features/topbar/TopBar";
import { BottomToolbar } from "./features/toolbar/BottomToolbar";
import { GridView } from "./features/grid/GridView";
import { ListScreen } from "./screens/ListScreen";
import { MemberChipsArea } from "./features/members/MemberPool";

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
  const { toolbarMode, members } = useApp();
  return (
    <div className="editScreen">
      <h1 className="sr-only">オーダーメーカー</h1>
      <TopBar />
      <ShareBanner />
      <div className="editBody">
        <GridView />
        {toolbarMode === "names" && members.length > 0 && (
          <div className="unplacedMembersArea">
            <p className="unplacedMembersTitle">配置していないメンバー</p>
            <MemberChipsArea />
          </div>
        )}
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
