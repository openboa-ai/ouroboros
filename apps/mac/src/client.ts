import { invoke, isTauri } from "@tauri-apps/api/core";
export const native = isTauri();
/** Profile credentials stay in the native client; the WebView receives a display name. */
export async function connectProfile(): Promise<{ name: string }> {
  if (!native) throw new Error("Connect your operating environment in the Mac app.");
  return invoke("connect_profile");
}

/** Explicit saved-profile selection establishes a fresh native connection generation. */
export async function connectSavedProfile(): Promise<{name:string}> {
  if (!native) throw new Error("Connect your operating environment in the Mac app.");
  return invoke("connect_saved_profile");
}
