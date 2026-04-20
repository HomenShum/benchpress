/**
 * Client-side ZIP export. Uses `fflate` (~10KB gzipped) — tiny enough
 * that adding it doesn't meaningfully balloon the bundle.
 *
 * Takes an array of {path, content, language?} and produces a Blob the
 * browser downloads as a `.zip` file.
 *
 * Usage:
 *   import { downloadBundleAsZip } from "@/lib/downloadZip";
 *   await downloadBundleAsZip("my-scaffold", [{path: "runner.py", content: "..."}]);
 */

import { zipSync, strToU8 } from "fflate";

export type ZipFile = {
  path: string;
  content: string;
  language?: string;
};

export function buildZipBlob(
  bundleName: string,
  files: ZipFile[],
): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    const normPath = f.path.replace(/^[/\\]+/, "");
    entries[`${bundleName}/${normPath}`] = strToU8(f.content);
  }
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}

export async function downloadBundleAsZip(
  bundleName: string,
  files: ZipFile[],
): Promise<void> {
  const blob = buildZipBlob(bundleName, files);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundleName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revocation so the browser finishes the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
