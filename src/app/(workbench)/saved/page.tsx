import type { Metadata } from "next";

import { SavedView } from "@/components/saved/saved-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved words",
};

/** `/saved` — the words saved in this browser, exportable. */
export default function SavedPage() {
  return <SavedView />;
}
