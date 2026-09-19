import { invoke } from "@tauri-apps/api/core";
import type { FilePort } from "@/app/file-port";
export const nativeFilePort: FilePort = {
  saveCopy: (file) =>
    invoke<string>("save_copy", { filename: file.name, content: file.content }),
};
