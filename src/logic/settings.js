import { DEFAULT_HOLIDAYS, parseHolidayText, todayISO } from './dates.js';

export const SETTINGS_KEY = 'gtcc-letters-settings-v1';

export const DEFAULT_LETTERHEAD = [
  'DEPARTMENT OF THE ARMY',
  'HEADQUARTERS AND HEADQUARTERS DETACHMENT',
  'MILITARY INTELLIGENCE READINESS COMMAND',
  '8831 JOHN J KINGMAN ROAD',
  'FORT BELVOIR VA 22060-6208',
].join('\n');

export const DEFAULT_SETTINGS = {
  officeSymbol: 'FRMV-CO',
  letterDate: '',
  reportAsOf: '',
  suspenseBusinessDays: 10,
  federalHolidays: DEFAULT_HOLIDAYS.slice(),
  letterhead: DEFAULT_LETTERHEAD,
  apcName: '',
  apcEmail: '',
  apcPhone: '',
  pocName: '',
  pocPosition: '',
  pocPhone: '',
  pocEmail: '',
  signatureName: '',
  signatureRank: '',
  signatureTitle: '',
  senderEmail: '',
  ccApc: true,
  ccDtas: true,
  maxDtasListed: 3,
  useDtsRank: true,
  dtsRoot: 'DA240ARC99DMRC',
  unitMap: '',
};

export function prepareSettings(settings, now = todayISO()) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  if (!merged.letterDate) merged.letterDate = now;
  if (!merged.reportAsOf) merged.reportAsOf = merged.letterDate;
  merged.suspenseBusinessDays = Number(merged.suspenseBusinessDays) || 10;
  merged.maxDtasListed = Number(merged.maxDtasListed) || 3;
  if (typeof merged.federalHolidays === 'string') merged.federalHolidays = parseHolidayText(merged.federalHolidays);
  if (!Array.isArray(merged.federalHolidays) || merged.federalHolidays.length === 0) {
    merged.federalHolidays = DEFAULT_HOLIDAYS.slice();
  }
  merged.ccApc = merged.ccApc !== false;
  merged.ccDtas = merged.ccDtas !== false;
  merged.useDtsRank = merged.useDtsRank !== false;
  return merged;
}

export function loadSettings(storage) {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return prepareSettings({});
    return prepareSettings(JSON.parse(raw));
  } catch {
    return prepareSettings({});
  }
}

export function saveSettings(storage, settings) {
  const prepared = prepareSettings(settings);
  storage.setItem(SETTINGS_KEY, JSON.stringify(prepared));
  return prepared;
}
