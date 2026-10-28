import type { Metadata } from "next";

import { Workbench } from "@/components/workbench/workbench";
import { WorkbenchProvider } from "@/components/workbench/state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dictionary",
};

/** `/dictionary` — the workbench with nothing selected, ready for a search. */
export default function DictionaryIndexPage() {
  return (
    <WorkbenchProvider>
      <Workbench />
    </WorkbenchProvider>
  );
}
