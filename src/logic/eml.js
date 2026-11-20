import { categoryLabel } from './category.js';
import { milDate } from './dates.js';
import { moneyText, properCase } from './normalize.js';
import { effectiveEmail, effectiveRank } from './tracker.js';
import { letterBaseName, suspenseISO } from './letter.js';

function bytesToBase64(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(data).toString('base64');
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    bin += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function foldBase64(value) {
  const parts = [];
  for (let i = 0; i < value.length; i += 76) parts.push(value.slice(i, i + 76));
  return parts.join('\r\n');
}

function headerSafe(value) {
  return String(value ?? '').replace(/[^\x20-\x7E]/g, '-');
}

export function ccAddresses(row, settings) {
  const parts = [];
  if (settings.ccDtas !== false && row.dtaCc) parts.push(row.dtaCc);
  if (row.supervisor) parts.push(String(row.supervisor).trim());
  if (settings.ccApc !== false && settings.apcEmail) parts.push(String(settings.apcEmail).trim());
  return parts.filter(Boolean).join('; ');
}

export function emailSubject(row) {
  const cat = categoryLabel(row.category);
  return `GTCC Delinquency Notification - ${cat}-Day Status - ${row.last}, ${row.first}`;
}

export function emailBody(row, settings) {
  const rank = effectiveRank(row);
  const cat = categoryLabel(row.category);
  const asOf = milDate(settings.reportAsOf || settings.letterDate);
  const suspense = milDate(suspenseISO(settings));
  const past = moneyText(row.pastDue) || '[see memo]';
  const balance = moneyText(row.balance) || '[see memo]';
  const sigName = String(settings.pocName || '').trim() || '[POC Name, rank]';
  const sigPos = String(settings.pocPosition || '').trim() || '[POC position]';
  const sigRest = [settings.pocPhone, settings.pocEmail].map((part) => String(part || '').trim()).filter(Boolean).join(' | ');
  const lines = [
    `${rank ? `${rank} ` : ''}${properCase(row.last)},`,
    '',
    `Attached is a Government Travel Charge Card (GTCC) Delinquency Notification for your account, which reflects a ${cat}-day delinquent status as of ${asOf}.`,
    '',
    `Past due amount: $${past}`,
    `Total outstanding balance: $${balance}`,
    '',
    'Please review the attached memorandum, reconcile any open DTS authorizations or unsettled vouchers, and make payment to Citibank to bring the account current. '
      + `Provide confirmation of resolution NLT ${suspense}.`,
    '',
    'If you believe this status is in error (for example, a reimbursement that has not yet posted), contact the APC or your unit DTS Administrator listed in the memorandum. '
      + 'Your chain of command / DTA is copied for awareness and assistance.',
    '',
    'Respectfully,',
    sigName,
    sigPos,
  ];
  if (sigRest) lines.push(sigRest);
  return lines.join('\r\n');
}

/**
 * Build a draft .eml the user opens in their own mail program.
 * There is no transport here: the file is only a download.
 */
export function buildEml({ from, to, cc, subject, body, attachmentName, attachmentBytes }) {
  const boundary = `gtcc_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
  const bodyB64 = foldBase64(bytesToBase64(new TextEncoder().encode(body)));
  const fileB64 = foldBase64(bytesToBase64(attachmentBytes));
  const lines = [
    `From: ${headerSafe(from || 'draft@localhost')}`,
    `To: ${headerSafe(to || '')}`,
    `Cc: ${headerSafe(cc || '')}`,
    `Subject: ${headerSafe(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    'X-GTCC-Letters: draft-only',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
    `--${boundary}`,
    'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${headerSafe(attachmentName)}"`,
    '',
    fileB64,
    `--${boundary}--`,
    '',
  ];
  return lines.join('\r\n');
}

export function draftFields(row, settings, attachmentBytes) {
  const base = letterBaseName(row);
  return {
    from: settings.senderEmail || settings.pocEmail || '',
    to: effectiveEmail(row),
    cc: ccAddresses(row, settings),
    subject: emailSubject(row),
    body: emailBody(row, settings),
    attachmentName: `${base}.docx`,
    attachmentBytes,
    emlName: `${base}.eml`,
    docxName: `${base}.docx`,
  };
}
