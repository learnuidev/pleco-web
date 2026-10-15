"use client";

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

export type ViewKey = "dictionary" | "text" | "browse" | "saved";
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
  view: ViewKey;
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
  | { type: "set-view"; view: ViewKey }
  | { type: "new-search"; query: string; selectFirstId?: number | null }
  | { type: "set-script"; script: Script }
  | { type: "toggle-pinyin-marks" }
  | { type: "select-entry"; id: number | null; hitId?: number | null }
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
    case "set-view":
      return { ...state, view: action.view };
    case "new-search":
      // Running a fresh search always lands the reader on the dictionary view.
      return {
        ...state,
        query: action.query,
        view: "dictionary",
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
  view: "dictionary",
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

const STORAGE_KEY = "pleco-web:workbench:v1";

type WorkbenchContextValue = {
  state: WorkbenchState;
  dispatch: Dispatch<WorkbenchAction>;
  /** The most relevant headword characters to display for a given entry. */
  headword: (entry: { simplified: string; traditional: string }) => string;
  traditionalHint: (entry: { simplified: string; traditional: string }) => string | null;
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workbenchReducer, initialState);

  // Restore then persist. Reading in an effect (not during render) keeps SSR and
  // the first client render identical.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WorkbenchState>;
        dispatch({
          type: "hydrate",
          state: {
            saved: parsed.saved ?? [],
            history: parsed.history ?? [],
            script: parsed.script ?? "simplified",
            showPinyinMarks: parsed.showPinyinMarks ?? true,
            view: parsed.view ?? "dictionary",
            textInput: parsed.textInput ?? "",
          },
        });
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        dispatch({ type: "hydrate", state: { theme: "dark" } });
      }
    } catch {
      // Corrupt storage should never break the app.
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            saved: state.saved,
            history: state.history,
            script: state.script,
            showPinyinMarks: state.showPinyinMarks,
            view: state.view,
            textInput: state.textInput,
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
    state.view,
    state.textInput,
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

  const value = useMemo<WorkbenchContextValue>(
    () => ({ state, dispatch, headword, traditionalHint }),
    [state, headword, traditionalHint],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const context = useContext(WorkbenchContext);
  if (!context) throw new Error("useWorkbench must be used inside <WorkbenchProvider>");
  return context;
}
