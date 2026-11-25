import { FolderOpen } from "lucide-react";
import { useRef } from "react";
import { Button, type ButtonVariant } from "./Button";

interface FilePickerProps {
  accept: string;
  onFile: (file: File) => void;
  label?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

/** A button that opens the system file dialog (no native permissions needed). */
export function FilePicker({
  accept,
  onFile,
  label = "Open file",
  variant = "secondary",
  size = "md",
}: FilePickerProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} size={size} icon={FolderOpen} onClick={() => ref.current?.click()}>
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
