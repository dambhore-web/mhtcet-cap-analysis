import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SYNC_APPLIED_EVENT } from "./storage";
import { loadPinned, pinCollege, unpinCollege, isPinned, type PinnedCollege } from "./compare";

interface CompareCtx {
  pinned: PinnedCollege[];
  pin: (college: PinnedCollege) => void;
  unpin: (code: string) => void;
  isPinned: (code: string) => boolean;
  canPin: boolean;
}

const Ctx = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState<PinnedCollege[]>(() => loadPinned());

  // the account's copy arrived (#15): show it
  useEffect(() => {
    const reload = () => setPinned(loadPinned());
    window.addEventListener(SYNC_APPLIED_EVENT, reload);
    // re-read once: a change between the first render and this subscription would otherwise be missed
    reload();
    return () => window.removeEventListener(SYNC_APPLIED_EVENT, reload);
  }, []);

  function pin(college: PinnedCollege) {
    setPinned(pinCollege(college));
  }

  function unpin(code: string) {
    setPinned(unpinCollege(code));
  }

  return (
    <Ctx.Provider value={{ pinned, pin, unpin, isPinned: (c) => isPinned(c), canPin: pinned.length < 3 }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompare must be inside CompareProvider");
  return ctx;
}
