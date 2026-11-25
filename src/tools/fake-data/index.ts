import { defineTool } from "@/core/tools/types";
import { Dices } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "fake-data",
  name: "Lorem & fake data",
  description: "Placeholder text, people, emails and UUIDs for seeding",
  category: "generators",
  icon: Dices,
  tone: "aqua",
  keywords: ["lorem", "ipsum", "placeholder", "faker", "mock", "seed", "uuid"],
  component: lazy(() => import("./View")),
});
