"use client";

import { Check, Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ExportItem = {
  headword: string;
  traditional: string;
  pinyin: string;
  gloss: string;
};

const FORMATS = [
  { key: "tsv", label: "Tab separated", hint: "Anki / Pleco friendly: headword ⇥ pinyin ⇥ definition" },
  { key: "csv", label: "CSV", hint: "Comma separated with quoted fields" },
  { key: "markdown", label: "Markdown", hint: "A table you can paste into notes" },
  { key: "plain", label: "Plain list", hint: "One line per word" },
] as const;

type FormatKey = (typeof FORMATS)[number]["key"];

function toTsv(items: ExportItem[]): string {
  return items.map((item) => [item.headword, item.pinyin, item.gloss].join("\t")).join("\n");
}

function toCsv(items: ExportItem[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return items
    .map((item) =>
      [item.headword, item.traditional, item.pinyin, item.gloss].map(escape).join(","),
    )
    .join("\n");
}

function toMarkdown(items: ExportItem[]): string {
  const header = "| Word | Pinyin | Definition |\n| --- | --- | --- |";
  const rows = items.map(
    (item) => `| ${item.headword} | ${item.pinyin} | ${item.gloss.replace(/\|/g, "\\|")} |`,
  );
  return [header, ...rows].join("\n");
}

function toPlain(items: ExportItem[]): string {
  return items.map((item) => `${item.headword} — ${item.pinyin} — ${item.gloss}`).join("\n");
}

const SERIALISERS: Record<FormatKey, (items: ExportItem[]) => string> = {
  tsv: toTsv,
  csv: toCsv,
  markdown: toMarkdown,
  plain: toPlain,
};

/** Export dialog for the saved list, with a live preview of the output. */
export function ExportSheet({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ExportItem[];
}) {
  const [format, setFormat] = useState<FormatKey>("tsv");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => SERIALISERS[format](items), [format, items]);

  function download() {
    const extension = format === "tsv" ? "txt" : format === "markdown" ? "md" : format;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pleco-web-saved.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Export {items.length} saved word{items.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Everything stays in your browser — copy the output or download it as a file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFormat(option.key)}
              title={option.hint}
              className={cn(
                "focus-halo rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                format === option.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/6 text-muted-foreground hover:bg-foreground/12 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <pre className="max-h-56 overflow-auto rounded-xl bg-foreground/5 p-3 font-mono text-[11.5px] leading-relaxed">
          {output || "Nothing saved yet."}
        </pre>

        <div className="flex items-center gap-2">
          <Button size="sm" className="rounded-full" onClick={copy} disabled={items.length === 0}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={download}
            disabled={items.length === 0}
          >
            <Download className="size-3.5" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
