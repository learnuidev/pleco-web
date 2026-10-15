"use client";

import { cn } from "@/lib/utils";

/**
 * A single Chinese character set in the CJK face.
 *
 * The `display` size is fluid (`clamp`) because it heads a resizable reader
 * pane: a fixed 104px glyph overflows once the window is narrow or the user
 * drags the splitter wide.
 */
export function Glyph({
  children,
  className,
  size = "md",
}: {
  children: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "display";
}) {
  const sizes: Record<NonNullable<typeof size>, string> = {
    sm: "text-[17px] leading-none",
    md: "text-[26px] leading-none",
    lg: "text-[40px] leading-none",
    xl: "text-[64px] leading-none",
    display: "text-[clamp(56px,5.2vw,104px)] leading-[0.95]",
  };

  return (
    <span
      className={cn(
        "glyph inline-block select-none tracking-normal",
        sizes[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
