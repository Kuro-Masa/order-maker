import { createContext, useContext, type ReactNode } from "react";
import { useAppStore, type AppStore } from "./useAppStore";

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const store = useAppStore();
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useApp(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error("useApp must be used within AppStoreProvider");
  return store;
}
