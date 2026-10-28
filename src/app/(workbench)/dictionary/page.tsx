import type { Metadata } from "next";

import { DictionaryView } from "@/components/dictionary/dictionary-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dictionary",
};

/** `/dictionary` — the workbench with nothing selected, ready for a search. */
export default function DictionaryIndexPage() {
  return <DictionaryView />;
}
