import type { Metadata } from "next";

import { Workbench } from "@/components/workbench/workbench";
import { WorkbenchProvider } from "@/components/workbench/state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dictionary",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * `/dictionary` — the workbench with nothing selected, ready for a search.
 *
 * A `?tab=…` query means the URL was shared from the Browse tab, so the shell
 * boots straight into it; the browse view itself reads the remaining parameters
 * (view, stroke, sort).
 */
export default async function DictionaryIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const browsing = typeof tab === "string" && tab.length > 0;

  return (
    <WorkbenchProvider initial={browsing ? { view: "browse" } : undefined}>
      <Workbench />
    </WorkbenchProvider>
  );
}
