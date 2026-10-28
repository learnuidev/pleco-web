import type { Metadata } from "next";

import { TextAnalyzer } from "@/components/text/text-analyzer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Text",
};

/** `/text` — paste a passage and read it word by word. */
export default function TextPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TextAnalyzer />
    </div>
  );
}
