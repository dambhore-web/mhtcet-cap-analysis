import { createContext, useContext, useState, type ReactNode } from "react";
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
