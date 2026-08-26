import { EditModeIcon, ImageIcon, JsonIcon, LineModeIcon, PaintModeIcon, SwapModeIcon } from "../../icons";
import { useApp } from "../../state/AppStoreContext";
import type { Mode } from "../../types";

export function Toolbar() {
  const { mode, changeMode, exportJson, exportImageFile } = useApp();

  function modeBtnClass(m: Mode) {
    return "iconBtn mode-option" + (mode === m ? " active" : "");
  }

  return (
    <section className="toolbar">
      <div className="modeGroup">
        <button type="button" className={modeBtnClass("edit")} aria-label="編集モード" onClick={() => changeMode("edit")}>
          <EditModeIcon />
          <span>編集</span>
        </button>
        <button type="button" className={modeBtnClass("swap")} aria-label="入れ替えモード" onClick={() => changeMode("swap")}>
          <SwapModeIcon />
          <span>入れ替え</span>
        </button>
        <button type="button" className={modeBtnClass("paint")} aria-label="色塗りモード" onClick={() => changeMode("paint")}>
          <PaintModeIcon />
          <span>色塗り</span>
        </button>
        <button type="button" className={modeBtnClass("line")} aria-label="線モード" onClick={() => changeMode("line")}>
          <LineModeIcon />
          <span>線</span>
        </button>
      </div>
      <div className="toolbarSpacer" />
      <button type="button" className="iconBtn" aria-label="JSON書き出し" onClick={exportJson}>
        <JsonIcon />
        <span>JSON</span>
      </button>
      <button type="button" className="iconBtn" aria-label="画像で保存" onClick={exportImageFile}>
        <ImageIcon />
        <span>画像</span>
      </button>
    </section>
  );
}
