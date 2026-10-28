import type { Metadata } from "next";

import { BrowseView } from "@/components/browse/browse-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse",
};

/**
 * `/browse` — radicals, stroke counts and frequency, with the axis, chart, filter
 * and sort carried in the query string (`?tab=strokes&view=chart`).
 */
export default function BrowsePage() {
  return <BrowseView />;
}
