"use client";

import { EntryDetailPane } from "@/components/entry/entry-detail";
import { ResultList } from "@/components/search/result-list";
import { SplitPane } from "@/components/workbench/split-pane";
import { useWorkbench } from "@/components/workbench/state";

/**
 * The dictionary route's content: the result list (resizable) on the left and the
 * entry reader on the right. Both read the shared search state from the workbench
 * context, so the shell's search field drives them from anywhere.
 */
export function DictionaryView() {
  const { result, loading, error, selectEntry } = useWorkbench();

  return (
    <SplitPane
      storageKey="pleco-web:results-width"
      defaultWidth={372}
      min={300}
      max={620}
      left={
        <div className="material hairline-r flex min-h-0 flex-1 flex-col">
          <ResultList result={result} loading={loading} error={error} onSelect={selectEntry} />
        </div>
      }
      right={
        <div className="flex min-h-0 flex-1 flex-col bg-background/40">
          <EntryDetailPane />
        </div>
      }
    />
  );
}
