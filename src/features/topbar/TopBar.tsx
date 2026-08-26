import { TabBar } from "./TabBar";
import { MenuPanel } from "./MenuPanel";

export function TopBar() {
  return (
    <section className="topBar">
      <TabBar />
      <MenuPanel />
    </section>
  );
}
