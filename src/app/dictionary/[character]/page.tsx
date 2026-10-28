import type { Metadata } from "next";

import { Workbench } from "@/components/workbench/workbench";
import { WorkbenchProvider } from "@/components/workbench/state";
import { entryIdForHeadword } from "@/lib/dictionary/headword";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ character: string }> };

/** URLs are hand-edited and shared, so be forgiving about encoding and length. */
function queryFrom(character: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(character);
    } catch {
      return character;
    }
  })();
  return decoded.trim().slice(0, 32);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const query = queryFrom((await params).character);
  if (!query) return { title: "Dictionary" };
  const entryId = entryIdForHeadword(query);
  return { title: entryId === null ? `${query} — dictionary` : query };
}

/**
 * `/dictionary/:character` — the dictionary itself, at a real per-entry address.
 *
 * The page boots the ordinary workbench (sidebar, search, results, reader) with
 * the entry in the URL already selected; everything after that is the same
 * single-page experience, and the address bar keeps following the selection.
 */
export default async function DictionaryEntryPage({ params }: PageProps) {
  const query = queryFrom((await params).character);
  const selectedId = entryIdForHeadword(query);

  return (
    // `key` remounts the shell when the URL moves to another character: Next
    // reuses the page component between params of the same route, and the
    // workbench's first render is driven by the param.
    <WorkbenchProvider key={query} initial={{ query, selectedId, view: "dictionary" }}>
      <Workbench />
    </WorkbenchProvider>
  );
}
