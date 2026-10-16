/**
 * Saves a text file for the user. On phones this opens the share sheet (Save to Files / Drive / email);
 * elsewhere it downloads. Resolves true if saved, false if the user cancelled the share sheet.
 */
export async function saveTextFile(name, text, mime = 'application/json') {
  const isPhone = document.documentElement.hasAttribute('data-phone');
  try {
    const file = new File([text], name, { type: mime });
    if (isPhone && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false;
    // any other share failure: fall through to a normal download
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
export const backupFileName = () => `flowmoney-backup-${new Date().toISOString().slice(0, 10)}.json`;
