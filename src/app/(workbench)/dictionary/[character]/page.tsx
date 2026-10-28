import type { Metadata } from "next";

import { DictionaryView } from "@/components/dictionary/dictionary-view";
import { RouteEntry } from "@/components/workbench/route-entry";
import { entryIdForHeadword } from "@/lib/dictionary/headword";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ character: string }>;
};

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
 * `/dictionary/:character` — an entry at a real address.
 *
 * The shell is owned by the layout; this route tells it which entry (and which
 * reader tab) to show, then renders the ordinary dictionary view.
 */
export default async function DictionaryEntryPage({ params }: PageProps) {
  const query = queryFrom((await params).character);
  const entryId = entryIdForHeadword(query);

  return (
    <>
      <RouteEntry query={query} entryId={entryId} />
      <DictionaryView />
    </>
  );
}
