import { redirect } from "next/navigation";

/**
 * The dictionary is the app's home. Every entry has its own address
 * (`/dictionary/:character`), so the bare root simply forwards into it.
 */
export default function Home() {
  redirect("/dictionary");
}
