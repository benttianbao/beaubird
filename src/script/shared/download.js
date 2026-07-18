// Functions extracted from the legacy script.js shared/download domain.
export function installDownloads(runtime) {
function toCsvText(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

function escapeCsvField(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

async function saveTextFile(filename, mimeType, content) {
  if (window.BeauBirdAndroid && typeof window.BeauBirdAndroid.saveTextFile === "function") {
    return window.BeauBirdAndroid.saveTextFile(filename, mimeType, content) || filename;
  }

  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "CSV 表格",
            accept: {
              [mimeType]: [".csv"]
            }
          }
        ]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return fileHandle.name || filename;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
      console.warn("showSaveFilePicker failed, falling back to anchor download:", error);
    }
  }

  if (window.location.protocol === "file:") {
    triggerFileDownload(filename, `data:${mimeType},${encodeURIComponent(content)}`);
    return filename;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  triggerFileDownload(filename, url, () => URL.revokeObjectURL(url));
  return filename;
}

function triggerFileDownload(filename, href, cleanup) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);

  try {
    anchor.dispatchEvent(new MouseEvent("click", { view: window, bubbles: true, cancelable: true }));
  } finally {
    setTimeout(() => {
      anchor.remove();
      cleanup?.();
    }, 60 * 1000);
  }
}

  Object.assign(runtime, {
    toCsvText,
    escapeCsvField,
    saveTextFile,
    triggerFileDownload
  });
}
