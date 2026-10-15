import type { SearchHit, SearchMode } from "@/lib/dictionary/search";
import type { EntryDetail } from "@/lib/dictionary/types";

export type ApiSearchResponse = {
  query: string;
  mode: SearchMode;
  segments: string[];
  hits: SearchHit[];
  total: number;
  truncated: boolean;
  elapsedMs: number;
};

export type ApiEntryResponse = EntryDetail;

export type ApiSuggestResponse = {
  suggestions: string[];
};

export type ApiStatusResponse = {
  cedictEntries: number;
  cedictVersion: string;
  strokeCharactersLocal: number;
  strokeDataAvailable: boolean;
  indexReady: boolean;
};

export type SearchRequest = {
  query: string;
  limit?: number;
};
