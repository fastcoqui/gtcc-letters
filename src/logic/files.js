import JSZip from 'jszip';
import { buildEml, draftFields } from './eml.js';
import { letterBytes } from './letter.js';
import { safeName } from './normalize.js';

export async function buildOneDraft(row, settings) {
  const docx = await letterBytes(row, settings);
  const fields = draftFields(row, settings, docx);
  const eml = buildEml(fields);
  return { ...fields, docx, eml };
}

export async function buildZip(rows, settings) {
  const zip = new JSZip();
  const folderName = `GTCC_Letters_${settings.letterDate || 'letters'}`;
  const root = zip.folder(folderName);
  for (const row of rows) {
    const one = await buildOneDraft(row, settings);
    const bde = safeName(row.bde || 'UNKNOWN');
    const dir = root.folder(bde);
    dir.file(one.docxName, one.docx);
    dir.file(one.emlName, one.eml);
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { bytes, count: rows.length, folderName };
}
