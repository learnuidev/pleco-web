import type { Metadata } from "next";

import { HistoryView } from "@/components/history/history-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History",
};

/** `/history` — everything opened in the reader, in 20-minute blocks. */
export default function HistoryPage() {
  return <HistoryView />;
}
