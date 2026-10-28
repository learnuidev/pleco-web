import type { Metadata } from "next";

import { LearningView } from "@/components/learning/learning-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning",
};

/** `/learning` — learned characters/radicals and the characters they unlock. */
export default function LearningPage() {
  return <LearningView />;
}
