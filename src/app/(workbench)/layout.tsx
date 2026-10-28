import { WorkbenchShell } from "@/components/workbench/shell";
import { WorkbenchProvider } from "@/components/workbench/state";

/**
 * Every in-app route shares this chrome: the title bar, sidebar and status bar
 * stay mounted across navigation, so switching between Dictionary, Browse, Text
 * and Saved only swaps the content area (and keeps search state alive).
 */
export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkbenchProvider>
      <WorkbenchShell>{children}</WorkbenchShell>
    </WorkbenchProvider>
  );
}
