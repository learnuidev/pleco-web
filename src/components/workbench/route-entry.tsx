"use client";

import { useEffect } from "react";

import { useWorkbench } from "@/components/workbench/state";
import { isReaderTab } from "@/lib/routes";

/**
 * Seeds the workbench from the URL of an entry route.
 *
 * The shell lives in a layout, so it survives navigation; the route — not a
 * mount — is what tells it which entry and tab to show. Renders nothing.
 */
export function RouteEntry({
  query,
  entryId,
  tab,
}: {
  query: string;
  entryId: number | null;
  tab?: string | null;
}) {
  const { dispatch } = useWorkbench();

  useEffect(() => {
    dispatch({
      type: "route-entry",
      query,
      selectedId: entryId,
      readerTab: isReaderTab(tab) ? tab : "strokes",
    });
  }, [dispatch, query, entryId, tab]);

  return null;
}
