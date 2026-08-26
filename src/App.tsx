import { AppStoreProvider, useApp } from "./state/AppStoreContext";
import { TopBar } from "./features/topbar/TopBar";
import { PartColorSettings } from "./features/settings/PartColorSettings";
import { RowLayoutSettings } from "./features/settings/RowLayoutSettings";
import { LineSettings } from "./features/settings/LineSettings";
import { Toolbar } from "./features/toolbar/Toolbar";
import { Palette } from "./features/toolbar/Palette";
import { GridView } from "./features/grid/GridView";

function Hint() {
  const { mode } = useApp();
  let text = "マスをタップして名前を入力してください";
  if (mode === "swap") text = "入れ替えたい2つのマスを順にタップしてください";
  else if (mode === "paint") text = "色を選んでからマスをタップすると塗れます";
  else if (mode === "line")
    text = "空いている場所をタップすると縦線を追加、既存の線はドラッグで移動できます(削除は下の一覧で)";
  return <p className="hint">{text}</p>;
}

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

function AppShell() {
  return (
    <div className="app">
      <h1 className="sr-only">オーダーメーカー</h1>
      <TopBar />
      <ShareBanner />
      <PartColorSettings />
      <RowLayoutSettings />
      <LineSettings />
      <Toolbar />
      <Palette />
      <Hint />
      <GridView />
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  );
}
