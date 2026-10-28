"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import { useDictionarySearch } from "@/hooks/use-dictionary-search";
import type { ApiSearchResponse } from "@/lib/api-types";
import { characterHref, syncDictionaryUrl } from "@/lib/routes";
import { WORKBENCH_STORAGE_KEY } from "@/lib/storage";

export type Script = "simplified" | "traditional";

export type SavedItem = {
  id: number;
  headword: string;
  traditional: string;
  pinyin: string;
  gloss: string;
  addedAt: number;
};

export type HistoryItem = {
  id: number;
  headword: string;
  pinyin: string;
  gloss: string;
  at: number;
};

export type WorkbenchState = {
  query: string;
  script: Script;
  showPinyinMarks: boolean;
  selectedId: number | null;
  /** Set when the user picked a word from the result list, so the list keeps its own highlight. */
  activeHitId: number | null;
  saved: SavedItem[];
  history: HistoryItem[];
  textInput: string;
  theme: "light" | "dark";
  resultLimit: number;
};

export type WorkbenchAction =
  | { type: "set-query"; query: string }
  | { type: "new-search"; query: string; selectFirstId?: number | null }
  | { type: "set-script"; script: Script }
  | { type: "toggle-pinyin-marks" }
  | { type: "select-entry"; id: number | null; hitId?: number | null }
  | { type: "open-entry"; id: number }
  /** Seeds state from the URL (`/dictionary/:character?tab=…`). */
  | { type: "route-entry"; query?: string; selectedId?: number | null }
  | { type: "toggle-save"; item: SavedItem }
  | { type: "remove-saved"; id: number }
  | { type: "push-history"; item: HistoryItem }
  | { type: "set-text-input"; value: string }
  | { type: "set-theme"; theme: "light" | "dark" }
  | { type: "hydrate"; state: Partial<WorkbenchState> };

const HISTORY_LIMIT = 40;

function uniqueHistory(history: HistoryItem[]): HistoryItem[] {
  const seen = new Set<number>();
  const out: HistoryItem[] = [];
  for (const item of history) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= HISTORY_LIMIT) break;
  }
  return out;
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "set-query":
      return { ...state, query: action.query };
    case "new-search":
      return {
        ...state,
        query: action.query,
        selectedId: action.selectFirstId ?? state.selectedId,
      };
    case "set-script":
      return { ...state, script: action.script };
    case "toggle-pinyin-marks":
      return { ...state, showPinyinMarks: !state.showPinyinMarks };
    case "select-entry":
      return {
        ...state,
        selectedId: action.id,
        activeHitId: action.hitId === undefined ? action.id : action.hitId,
      };
    case "open-entry":
      // Picking an entry from Recent, Saved or the text reader always shows the
      // reader tab, whatever view was open before.
      return {
        ...state,
        selectedId: action.id,
        activeHitId: action.id,
      };
    case "route-entry":
      return {
        ...state,
        query: action.query ?? state.query,
        selectedId: action.selectedId === undefined ? state.selectedId : action.selectedId,
        activeHitId: action.selectedId === undefined ? state.activeHitId : action.selectedId,
      };
    case "toggle-save": {
      const exists = state.saved.some((item) => item.id === action.item.id);
      return {
        ...state,
        saved: exists
          ? state.saved.filter((item) => item.id !== action.item.id)
          : [action.item, ...state.saved].slice(0, 500),
      };
    }
    case "remove-saved":
      return { ...state, saved: state.saved.filter((item) => item.id !== action.id) };
    case "push-history":
      return { ...state, history: uniqueHistory([action.item, ...state.history]) };
    case "set-text-input":
      return { ...state, textInput: action.value };
    case "set-theme":
      return { ...state, theme: action.theme };
    case "hydrate":
      return { ...state, ...action.state };
    default:
      return state;
  }
}

const initialState: WorkbenchState = {
  query: "",
  script: "simplified",
  showPinyinMarks: true,
  selectedId: null,
  activeHitId: null,
  saved: [],
  history: [],
  textInput: "",
  theme: "light",
  resultLimit: 60,
};

type WorkbenchContextValue = {
  state: WorkbenchState;
  dispatch: Dispatch<WorkbenchAction>;
  /** The most relevant headword characters to display for a given entry. */
  headword: (entry: { simplified: string; traditional: string }) => string;
  traditionalHint: (entry: { simplified: string; traditional: string }) => string | null;
  /** Live search state, shared by the result list, shortcuts and the status bar. */
  result: ApiSearchResponse | null;
  loading: boolean;
  error: string | null;
  selectEntry: (id: number) => void;
  openEntry: (id: number, headword?: string) => void;
  runSearch: (query: string) => void;
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workbenchReducer, initialState);
  const router = useRouter();
  const pathname = usePathname();
  const { data: result, loading, error } = useDictionarySearch(state.query, state.resultLimit);

  // Restore then persist. Reading in an effect (not during render) keeps SSR and
  // the first client render identical.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKBENCH_STORAGE_KEY);
      const parsed = (raw ? JSON.parse(raw) : {}) as Partial<WorkbenchState>;
      dispatch({
        type: "hydrate",
        state: {
          saved: parsed.saved ?? [],
          history: parsed.history ?? [],
          script: parsed.script ?? "simplified",
          showPinyinMarks: parsed.showPinyinMarks ?? true,
          textInput: parsed.textInput ?? "",
          // query / selectedId / the reader tab are owned by the URL (or the session),
          // never by storage: a shared link must not be overridden by whatever
          // this browser looked at last.
          // An explicit appearance choice sticks across reloads; the OS
          // preference is only a first-run default.
          theme:
            parsed.theme ??
            (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
        },
      });
    } catch {
      // Corrupt storage should never break the app.
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          WORKBENCH_STORAGE_KEY,
          JSON.stringify({
            saved: state.saved,
            history: state.history,
            script: state.script,
            showPinyinMarks: state.showPinyinMarks,
            textInput: state.textInput,
            theme: state.theme,
          }),
        );
      } catch {
        // Storage full or unavailable: ignore.
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [
    state.saved,
    state.history,
    state.script,
    state.showPinyinMarks,
    state.textInput,
    state.theme,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.theme === "dark");
    root.style.colorScheme = state.theme;
  }, [state.theme]);

  const headword = useCallback(
    (entry: { simplified: string; traditional: string }) =>
      state.script === "traditional" && entry.traditional ? entry.traditional : entry.simplified,
    [state.script],
  );

  const traditionalHint = useCallback(
    (entry: { simplified: string; traditional: string }) => {
      if (entry.traditional === entry.simplified) return null;
      return state.script === "traditional" ? entry.simplified : entry.traditional;
    },
    [state.script],
  );

  const selectEntry = useCallback(
    (id: number) => {
      dispatch({ type: "select-entry", id });
    },
    [dispatch],
  );

  const runSearch = useCallback(
    (query: string) => {
      dispatch({ type: "new-search", query });
    },
    [dispatch],
  );

  /** Opening from Recent/Saved/reader: show the reader, keep the URL on the entry. */
  const openEntry = useCallback(
    (id: number, entryHeadword?: string) => {
      dispatch({ type: "open-entry", id });
      if (!entryHeadword) {
        if (!pathname.startsWith("/dictionary")) router.push("/dictionary");
        return;
      }
      if (pathname.startsWith("/dictionary")) {
        syncDictionaryUrl(entryHeadword);
      } else {
        router.push(characterHref(entryHeadword));
      }
    },
    [pathname, router],
  );

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      state,
      dispatch,
      headword,
      traditionalHint,
      result,
      loading,
      error,
      selectEntry,
      openEntry,
      runSearch,
    }),
    [state, headword, traditionalHint, result, loading, error, selectEntry, openEntry, runSearch],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const context = useContext(WorkbenchContext);
  if (!context) throw new Error("useWorkbench must be used inside <WorkbenchProvider>");
  return context;
}
