import { createContext, useContext } from "react";
export interface SaveCopy {
  name: string;
  content: string;
  mediaType: string;
}
export interface FilePort {
  saveCopy: (file: SaveCopy) => Promise<string>;
}
export const browserFilePort: FilePort = {
  async saveCopy(file) {
    const url = URL.createObjectURL(
      new Blob([file.content], { type: file.mediaType }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "Download requested. Check your browser downloads.";
  },
};
export const FilePortContext = createContext<FilePort>(browserFilePort);
export const useFilePort = () => useContext(FilePortContext);
