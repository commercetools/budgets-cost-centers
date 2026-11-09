// Saves text as a file in the browser, without a server round trip. [BCC-VIEW-7]
export function downloadText(
  fileName: string,
  text: string,
  type = 'text/csv;charset=utf-8'
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
