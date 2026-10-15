"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, Eraser, Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Glyph } from "@/components/glyph";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

type Token = {
  text: string;
  isHan: boolean;
  entryId: number | null;
  pinyin: string | null;
  gloss: string | null;
};

type CharacterEntry = {
  character: string;
  entryId: number | null;
  pinyin: string | null;
};

const SAMPLES = [
  "我們都是陌生人。",
  "今天天气很好，我们一起去公园散步吧。",
  "学而不思则罔，思而不学则殆。",
];

/**
 * Text view: paste a passage, get longest-match segmentation against the
 * dictionary, clickable words with pinyin + gloss, and a character grid with a
 * pinyin reading and stroke-order shortcut for every unique character.
 */
export function TextAnalyzer({ onSelectEntry }: { onSelectEntry: (id: number) => void }) {
  const [text, setText] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [activeToken, setActiveToken] = useState<number | null>(null);
  const debounced = useDebouncedValue(text, 320);

  useEffect(() => {
    const value = debounced.trim();
    if (!value) {
      setTokens([]);
      setCharacters([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    fetch("/api/segment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { tokens: Token[]; characters: CharacterEntry[] } | null) => {
        if (cancelled || !data) return;
        setTokens(data.tokens);
        setCharacters(data.characters);
      })
      .catch(() => {
        // aborted or offline
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debounced]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hairline-b flex items-center gap-2 px-4 py-2">
        <Wand2 className="size-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Text reader
        </span>
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-[12px]"
            onClick={() => setShowPinyin((value) => !value)}
          >
            <ArrowLeftRight className="size-3.5" />
            {showPinyin ? "Hide pinyin" : "Show pinyin"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-[12px]"
            onClick={() => {
              setText("");
              setTokens([]);
              setCharacters([]);
            }}
            disabled={!text}
          >
            <Eraser className="size-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-3 shadow-raised ring-1 ring-black/5 dark:ring-white/8">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste or type Chinese text — sentences, subtitles, a paragraph from a book…"
              rows={4}
              spellCheck={false}
              className="focus-halo w-full resize-y rounded-xl bg-transparent px-2 py-2 font-hanzi text-[17px] leading-relaxed outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-muted-foreground"
            />
            <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1 pt-1.5">
              <span className="text-[11px] text-muted-foreground">Try:</span>
              {SAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setText(sample)}
                  className="glyph focus-halo rounded-full bg-foreground/6 px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary"
                >
                  {sample.slice(0, 8)}…
                </button>
              ))}
            </div>
          </div>

          {tokens.length > 0 ? (
            <>
              <section className="rounded-2xl bg-card p-4 shadow-raised ring-1 ring-black/5 dark:ring-white/8">
                <h3 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Segmentation
                </h3>
                <div className="flex flex-wrap items-end gap-x-1 gap-y-2">
                  {tokens.map((token, index) =>
                    token.isHan ? (
                      <motion.button
                        key={`${token.text}-${index}`}
                        type="button"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index, 30) * 0.008 }}
                        onMouseEnter={() => setActiveToken(index)}
                        onMouseLeave={() => setActiveToken(null)}
                        disabled={token.entryId === null}
                        onClick={() => token.entryId !== null && onSelectEntry(token.entryId)}
                        className={cn(
                          "focus-halo group relative flex flex-col items-center rounded-lg px-1.5 pt-1 transition-colors",
                          token.entryId === null
                            ? "cursor-default opacity-70"
                            : "hover:bg-primary/10",
                          activeToken === index && "bg-primary/10",
                        )}
                      >
                        <span className="glyph text-[21px] leading-tight">{token.text}</span>
                        <span
                          className={cn(
                            "h-4 text-[10.5px] leading-4 text-primary transition-opacity",
                            showPinyin ? "opacity-100" : "opacity-0",
                          )}
                        >
                          {token.pinyin ?? ""}
                        </span>
                        {token.gloss && activeToken === index ? (
                          <span className="material-strong hairline-ring pointer-events-none absolute -top-7 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] text-foreground shadow-float">
                            {token.gloss}
                          </span>
                        ) : null}
                      </motion.button>
                    ) : (
                      <span
                        key={`${token.text}-${index}`}
                        className="whitespace-pre-wrap break-all px-0.5 text-[15px] leading-tight text-muted-foreground"
                      >
                        {token.text}
                      </span>
                    ),
                  )}
                </div>
              </section>

              {characters.length > 0 ? (
                <section className="rounded-2xl bg-card p-4 shadow-raised ring-1 ring-black/5 dark:ring-white/8">
                  <h3 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Characters ({characters.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {characters.map((entry) => (
                      <button
                        key={entry.character}
                        type="button"
                        disabled={entry.entryId === null}
                        onClick={() => entry.entryId !== null && onSelectEntry(entry.entryId)}
                        className={cn(
                          "focus-halo flex w-14 flex-col items-center gap-0.5 rounded-xl bg-foreground/4 pb-1 pt-1.5 transition-colors",
                          entry.entryId !== null && "hover:bg-primary/12",
                        )}
                      >
                        <Glyph size="md">{entry.character}</Glyph>
                        <span className="h-3.5 text-[10px] text-muted-foreground">
                          {entry.pinyin ?? ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-hairline-strong p-8 text-center">
              <p className="text-[12.5px] text-muted-foreground">
                {loading
                  ? "Segmenting…"
                  : "Paste Chinese text above to see it split into dictionary words, with pinyin and definitions."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
