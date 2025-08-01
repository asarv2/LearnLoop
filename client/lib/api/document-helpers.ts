// lib/api/document-helpers.ts

/**
 * Opens the document in a new tab or triggers download
 * @param id - The document ID
 * @param options - Optional window.open options
 */
export async function openDocument(id: string, options?: string) {
  const defaultOptions = 'noopener,noreferrer';
  const windowOptions = options || defaultOptions;
  
  window.open(`/api/v1/documents/${id}/file`, '_blank', windowOptions);
}

/**
 * Downloads the document directly
 * @param id - The document ID
 * @param filename - Optional filename for the download
 */
export async function downloadDocument(id: string, filename?: string) {
  const link = document.createElement('a');
  link.href = `/api/v1/documents/${id}/file`;
  link.download = filename || `document-${id}.pdf`;
  link.target = '_blank';
  link.rel = 'noopener,noreferrer';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 