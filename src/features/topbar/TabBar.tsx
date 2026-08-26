import { useApp } from "../../state/AppStoreContext";

export function TabBar() {
  const { state, switchPattern, addPattern } = useApp();

  return (
    <div className="tabBar">
      {state.patterns.map((p) => (
        <button
          key={p.id}
          type="button"
          className={"tabBtn" + (p.id === state.activeId ? " active" : "")}
          onClick={() => switchPattern(p.id)}
        >
          {p.name || "無題"}
        </button>
      ))}
      <button type="button" className="tabBtn tabAddBtn" title="新しいパターン" onClick={addPattern}>
        ＋
      </button>
    </div>
  );
}
