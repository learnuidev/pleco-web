import { Workbench } from "@/components/workbench/workbench";
import { WorkbenchProvider } from "@/components/workbench/state";

export default function Home() {
  return (
    <WorkbenchProvider>
      <Workbench />
    </WorkbenchProvider>
  );
}
