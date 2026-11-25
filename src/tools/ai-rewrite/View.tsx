import { AiToolView } from "@/core/ai/AiToolView";
import type { ToolProps } from "@/core/tools/types";
import { preset } from "./logic";

export default function View(props: ToolProps) {
  return <AiToolView preset={preset} {...props} />;
}
