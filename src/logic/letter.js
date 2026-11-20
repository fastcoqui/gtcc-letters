import {
  Document,
  Header,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import { categoryLabel } from './category.js';
import { addBusinessDays, milDate } from './dates.js';
import { joinNonBlank, moneyText, safeName } from './normalize.js';
import { effectiveEmail, effectiveRank } from './tracker.js';

const EN = '\u2013';

function blank(value, placeholder) {
  const text = String(value ?? '').trim();
  if (!text) return { text: `[${placeholder}]`, highlight: true };
  return { text, highlight: false };
}

function runsFromParts(parts) {
  return parts.filter((part) => part && part.text != null);
}

export function letterBaseName(row) {
  const cat = String(row.category || 'X').replace('+', 'plus');
  let base = `GTCC_${cat}Day_${safeName(row.last)}_${safeName(row.first)}`;
  if (row.mi) base += `_${safeName(row.mi)}`;
  return base;
}

export function suspenseISO(settings) {
  const letterDate = settings.letterDate;
  const days = Number(settings.suspenseBusinessDays) || 10;
  return addBusinessDays(letterDate, days, settings.federalHolidays);
}

export function buildLetterBlocks(row, settings) {
  const cat = categoryLabel(row.category);
  const rank = effectiveRank(row);
  const email = effectiveEmail(row);
  const unit = row.hier6 || row.hier5 || '';
  const asOf = milDate(settings.reportAsOf || settings.letterDate);
  const letterDate = milDate(settings.letterDate);
  const suspense = milDate(suspenseISO(settings));
  const balance = moneyText(row.balance);
  const pastDue = moneyText(row.pastDue);
  const apc = joinNonBlank([settings.apcName, settings.apcEmail, settings.apcPhone], ', ');
  const daysText = row.category === '120+' && row.oldest && row.oldest !== '120'
    ? `${row.oldest} days (120+ category)`
    : `${row.oldest} days`;
  const nameBits = [
    rank ? { text: rank, highlight: false } : { text: '[RANK]', highlight: true },
    { text: ` ${row.first || ''}${row.mi ? ` ${row.mi}.` : ''} ${row.last || ''}`.replace(/ {2,}/g, ' '), highlight: false },
  ];
  const paragraphs = [
    {
      tabbed: true,
      runs: [
        blank(settings.officeSymbol, 'OFFICE SYMBOL'),
        { text: '\t', highlight: false },
        blank(letterDate, 'LETTER DATE'),
      ],
    },
    {
      runs: runsFromParts([
        { text: 'MEMORANDUM FOR ', highlight: false },
        ...nameBits,
        { text: ', ', highlight: false },
        blank(unit, `UNIT ${EN} BLANK IN REPORT`),
        { text: ', ', highlight: false },
        blank(email, `EMAIL ${EN} NOT FOUND IN DTS, VERIFY`),
        { text: ', ', highlight: false },
        blank(row.phone, 'PHONE'),
      ]),
    },
    {
      runs: [{
        text: `SUBJECT: Government Travel Charge Card (GTCC) Delinquency Notification ${EN} ${cat}-Day Status`,
        highlight: false,
        bold: true,
      }],
    },
    {
      runs: [{
        text: `The purpose of this letter is to notify you that your Government Travel Charge Card (GTCC) account has reached a ${cat}-day delinquent status. This notice is provided to give you ample time to take appropriate steps to resolve any outstanding balance and correct any issues contributing to this delinquency, including open Defense Travel System (DTS) items and Unsettled Vouchers.`,
        highlight: false,
      }],
    },
    { runs: [{ text: `As of ${asOf}, your GTCC account reflects:`, highlight: false }] },
    { runs: runsFromParts([{ text: 'Total outstanding balance: $', highlight: false }, blank(balance, `Current Balance ${EN} BLANK IN REPORT`)]) },
    { runs: runsFromParts([{ text: 'Delinquent amount (past due): $', highlight: false }, blank(pastDue, `Past Due Amount ${EN} BLANK IN REPORT`)]) },
    { runs: [{ text: `Days delinquent: ${daysText}`, highlight: false }] },
    { runs: [{ text: 'Please take the following actions immediately to remedy the delinquency:', highlight: false }] },
    { runs: [{ text: 'a. Review and reconcile pending travel documents in DTS.', highlight: false }] },
    { indent: 720, runs: [{ text: 'Log into DTS and verify that all travel authorizations and vouchers are complete and correctly submitted.', highlight: false }] },
    { indent: 720, runs: [{ text: 'Ensure that all required receipts and substantiating documents are uploaded.', highlight: false }] },
    { indent: 720, runs: [{ text: 'Confirm that any Unsettled Vouchers or returned documents are corrected and resubmitted for approval.', highlight: false }] },
    { runs: [{ text: 'b. Confirm that all travel claims are processed and paid.', highlight: false }] },
    { indent: 720, runs: [{ text: 'Check the status of your vouchers (for example, Paid, Approved, Returned, or Unsubmitted).', highlight: false }] },
    { indent: 720, runs: [{ text: 'If any vouchers are rejected or returned, address the discrepancies immediately and resubmit.', highlight: false }] },
    { runs: [{ text: 'c. Make payment to Citibank to bring your account current.', highlight: false }] },
    { indent: 720, runs: [{ text: 'If there is a remaining GTCC balance not covered by travel reimbursements, you are personally responsible for paying the amount due directly to the bank by the statement due date.', highlight: false }] },
    { indent: 720, runs: [{ text: 'You can make payments via online account access, telephone, or mail, following the instructions on your GTCC billing statement.', highlight: false }] },
    { runs: [{ text: 'Impact of continued delinquency. Failure to resolve this delinquency may result in:', highlight: false }] },
    { indent: 720, runs: [{ text: 'Suspension or cancellation of your GTCC.', highlight: false }] },
    { indent: 720, runs: [{ text: 'Command-level counseling and possible administrative action, consistent with DoD FMR, DoD GTCC policy, and local command policy.', highlight: false }] },
    { indent: 720, runs: [{ text: 'Negative impact on your ability to perform official travel and potential implications for your personnel record.', highlight: false }] },
    {
      runs: [{
        text: `Suspense: Please take all necessary actions and provide confirmation of resolution NLT ${suspense}. Confirmation should include:`,
        highlight: false,
      }],
    },
    { indent: 720, runs: [{ text: 'Status of all DTS authorizations and vouchers (submitted, corrected, or paid).', highlight: false }] },
    { indent: 720, runs: [{ text: 'Documentation or screenshot showing payment made to the GTCC account and current status (if required by local procedures).', highlight: false }] },
    { indent: 720, runs: [{ text: 'Any explanation, if applicable, for delays beyond your control (for example, system issues or rejected vouchers awaiting correction).', highlight: false }] },
    { runs: [{ text: 'If you believe there is an error with the delinquency status, such as a pending reimbursement that has not yet posted or an incorrect charge, contact:', highlight: false }] },
    {
      indent: 720,
      runs: runsFromParts([
        { text: 'GTCC Agency Program Coordinator (APC): ', highlight: false },
        blank(apc, 'APC Name, email, phone'),
      ]),
    },
    {
      indent: 720,
      runs: runsFromParts([
        { text: 'Unit DTS Administrator/ODTA: ', highlight: false },
        blank(row.dtaText, `DTA Name, email, phone ${EN} none found in DTS`),
      ]),
    },
    { runs: [{ text: 'They can assist with reviewing your DTS documents, validating the status of your reimbursements, and coordinating with the bank if needed.', highlight: false }] },
    { runs: [{ text: 'Your prompt attention to this matter is required to maintain compliance with GTCC and travel regulations and to prevent further adverse actions. Please treat this notification as a priority and coordinate with your chain of command and the APC if you require assistance.', highlight: false }] },
    {
      runs: runsFromParts([
        { text: 'Point of contact for this memorandum is ', highlight: false },
        blank(settings.pocName, 'POC Name, rank'),
        { text: ', ', highlight: false },
        blank(settings.pocPosition, 'POC position'),
        { text: ', at ', highlight: false },
        blank(settings.pocPhone, 'POC phone'),
        { text: ' or ', highlight: false },
        blank(settings.pocEmail, 'POC email'),
        { text: '.', highlight: false },
      ]),
    },
    { signature: true, runs: [blank(settings.signatureName, 'SIGNATURE NAME')] },
    { signature: true, runs: [blank(settings.signatureRank, 'RANK, BRANCH')] },
    { signature: true, runs: [blank(settings.signatureTitle, 'TITLE')] },
  ];
  const letterhead = String(settings.letterhead || '').split(/\n/).map((line) => line.trim()).filter(Boolean);
  return {
    letterhead: letterhead.length ? letterhead : ['[LETTERHEAD]'],
    letterheadMissing: letterhead.length === 0,
    paragraphs,
  };
}

export function letterPlain(blocks) {
  const head = blocks.letterhead.join('\n');
  const body = blocks.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join('')).join('\n');
  return `${head}\n${body}`;
}

function textRun(part, size = 24) {
  if (!part || part.text === '') return null;
  return new TextRun({
    text: part.text,
    font: 'Times New Roman',
    size: part.size || size,
    bold: Boolean(part.bold),
    highlight: part.highlight ? 'yellow' : undefined,
  });
}

export function letterDocument(row, settings) {
  const blocks = buildLetterBlocks(row, settings);
  const headerChildren = blocks.letterhead.map((line, index) => new Paragraph({
    alignment: 'center',
    spacing: { after: index === blocks.letterhead.length - 1 ? 120 : 0 },
    children: [new TextRun({
      text: line,
      font: 'Times New Roman',
      bold: true,
      size: index === 0 ? 22 : 18,
      highlight: blocks.letterheadMissing ? 'yellow' : undefined,
    })],
  }));
  const body = blocks.paragraphs.map((paragraph) => {
    const children = paragraph.runs.map((part) => textRun(part)).filter(Boolean);
    return new Paragraph({
      spacing: { after: 120, line: 276 },
      indent: paragraph.signature ? { left: 5040 } : (paragraph.indent ? { left: paragraph.indent } : undefined),
      tabStops: paragraph.tabbed ? [{ type: TabStopType.RIGHT, position: 9360 }] : undefined,
      children: children.length ? children : [new TextRun({ text: '', font: 'Times New Roman', size: 24 })],
    });
  });
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1080, right: 1080, header: 360, footer: 360 },
        },
      },
      headers: { default: new Header({ children: headerChildren }) },
      children: body,
    }],
  });
}

export async function letterBytes(row, settings) {
  const doc = letterDocument(row, settings);
  if (typeof window === 'undefined') {
    return new Uint8Array(await Packer.toBuffer(doc));
  }
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
