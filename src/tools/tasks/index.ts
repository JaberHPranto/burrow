import { defineTool } from "@/core/tools/types";
import { ListTodo } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "tasks",
  name: "Tasks",
  description: "Personal to-dos with dates, priorities and tags",
  category: "notes",
  icon: ListTodo,
  tone: "mint",
  keywords: ["todo", "to-do", "tasks", "checklist", "planner", "reminder", "today"],
  component: lazy(() => import("./View")),
});
