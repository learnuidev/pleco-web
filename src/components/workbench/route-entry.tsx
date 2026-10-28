"use client";

import { useEffect } from "react";

import { useWorkbench } from "@/components/workbench/state";

/**
 * Seeds the workbench from the URL of an entry route.
 *
 * The shell lives in a layout, so it survives navigation; the route — not a
 * mount — is what tells it which entry to show. The reader's tab and sub-tab are
 * read straight from the query string by the reader itself. Renders nothing.
 */
export function RouteEntry({ query, entryId }: { query: string; entryId: number | null }) {
  const { dispatch } = useWorkbench();

  useEffect(() => {
    dispatch({ type: "route-entry", query, selectedId: entryId });
  }, [dispatch, query, entryId]);

  return null;
}
