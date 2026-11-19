import type { Lead } from '../types';
import { joinEmails, joinPhones } from './contacts';

export type ExportFormat = 'csv' | 'json' | 'sheets' | 'word' | 'excel' | 'notepad' | 'docs';

export interface ExportFile {
  content: string;
  filename: string;
  type: string;
}

const COLUMNS = [
  'Name', 'Type', 'Location', 'Website', 'Email', 'Phone', 'Description', 'Source',
  'Outreach Subject', 'Outreach Icebreaker', 'Outreach Hook', 'Talking Points',
] as const;

function rowsOf(leads: Lead[]): string[][] {
  return leads.map(lead => [
    lead.name,
    lead.type,
    lead.location,
    lead.website ?? '',
    joinEmails(lead),
    joinPhones(lead),
    lead.description ?? '',
    lead.source_actor,
    lead.outreach_draft?.subject ?? '',
    lead.outreach_draft?.icebreaker ?? '',
    lead.outreach_draft?.hook ?? '',
    lead.outreach_draft?.talking_points?.join('; ') ?? '',
  ]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// RFC 4180 quoting; also neutralises spreadsheet formula injection (=, +, -, @ at cell start)
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(leads: Lead[]): string {
  return [COLUMNS.map(csvCell).join(','), ...rowsOf(leads).map(row => row.map(csvCell).join(','))].join('\r\n');
}

function toJson(leads: Lead[]): string {
  const data = leads.map(lead => ({
    name: lead.name,
    type: lead.type,
    location: lead.location,
    website: lead.website ?? '',
    email: joinEmails(lead),
    phone: joinPhones(lead),
    description: lead.description ?? '',
    source_actor: lead.source_actor,
    outreach_draft: lead.outreach_draft ?? null,
  }));
  return JSON.stringify(data, null, 2);
}

// Excel and Word open HTML tables natively; the MIME type tells them which app to use
function toHtmlTable(leads: Lead[], title: string): string {
  const head = COLUMNS.map(c => `<th>${escapeHtml(c)}</th>`).join('');
  const body = rowsOf(leads)
    .map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#1e3a8a;color:#fff}</style>
</head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

// Plain-text report sized for an 80-column page: one block per lead, ready for Notepad or a printer
function toNotepad(leads: Lead[]): string {
  const width = 80;
  const rule = '-'.repeat(width);
  const wrap = (label: string, value: string) => {
    const prefix = `  ${label.padEnd(12)}: `;
    const indent = ' '.repeat(prefix.length);
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = prefix;
    for (const word of words) {
      if (line.length + word.length + 1 > width && line.trim() !== prefix.trim()) {
        lines.push(line);
        line = indent + word;
      } else {
        line = line === prefix || line === indent ? line + word : `${line} ${word}`;
      }
    }
    lines.push(line);
    return lines.join('\r\n');
  };

  const header = [
    'BUSINESS LEAD FINDER',
    `Exported ${new Date().toLocaleString()}  |  ${leads.length} leads`,
    rule,
  ];
  const blocks = leads.map((lead, i) => {
    const fields: [string, string][] = [
      ['Website', lead.website ?? ''],
      ['Email', joinEmails(lead)],
      ['Phone', joinPhones(lead)],
      ['Location', lead.location],
      ['Type', lead.type],
      ['Description', lead.description ?? ''],
      ['Source', lead.source_actor],
      ['Subject', lead.outreach_draft?.subject ?? ''],
      ['Icebreaker', lead.outreach_draft?.icebreaker ?? ''],
      ['Hook', lead.outreach_draft?.hook ?? ''],
      ['Talking points', lead.outreach_draft?.talking_points?.join('; ') ?? ''],
    ];
    const body = fields
      .filter(([, value]) => value !== '')
      .map(([label, value]) => wrap(label, value));
    return [`${String(i + 1).padStart(3)}. ${lead.name}`, ...body, ''].join('\r\n');
  });
  return [...header, '', ...blocks].join('\r\n');
}

// Google Docs imports HTML with headings and tables, so each lead becomes a labelled section
function toDocsHtml(leads: Lead[]): string {
  const sections = leads.map(lead => {
    const rows: [string, string][] = [
      ['Type', lead.type],
      ['Location', lead.location],
      ['Website', lead.website ?? ''],
      ['Email', joinEmails(lead)],
      ['Phone', joinPhones(lead)],
      ['Source', lead.source_actor],
      ['Subject', lead.outreach_draft?.subject ?? ''],
      ['Icebreaker', lead.outreach_draft?.icebreaker ?? ''],
      ['Hook', lead.outreach_draft?.hook ?? ''],
      ['Talking points', lead.outreach_draft?.talking_points?.join('; ') ?? ''],
    ];
    const table = rows
      .filter(([, value]) => value !== '')
      .map(([label, value]) => `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`)
      .join('');
    const description = lead.description ? `<p>${escapeHtml(lead.description)}</p>` : '';
    return `<h2>${escapeHtml(lead.name)}</h2><table border="1" cellpadding="4" cellspacing="0">${table}</table>${description}`;
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Business Lead Finder</title></head><body><h1>Business Lead Finder</h1><p>${leads.length} leads, exported ${escapeHtml(new Date().toLocaleDateString())}</p>${sections.join('')}</body></html>`;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function buildExport(leads: Lead[], format: ExportFormat): ExportFile {
  const base = `business-lead-finder-${stamp()}`;
  switch (format) {
    case 'csv':
      return { content: `\uFEFF${toCsv(leads)}`, filename: `${base}.csv`, type: 'text/csv;charset=utf-8' };
    case 'json':
      return { content: toJson(leads), filename: `${base}.json`, type: 'application/json' };
    case 'sheets':
      // Sheets imports CSV from a file, so the output is CSV with a BOM for accented names
      return { content: `\uFEFF${toCsv(leads)}`, filename: `${base}-sheets.csv`, type: 'text/csv;charset=utf-8' };
    case 'excel':
      return {
        content: toHtmlTable(leads, 'Business Lead Finder'),
        filename: `${base}.xls`,
        type: 'application/vnd.ms-excel',
      };
    case 'word':
      return {
        content: toHtmlTable(leads, 'Business Lead Finder'),
        filename: `${base}.doc`,
        type: 'application/msword',
      };
    case 'notepad':
      return { content: toNotepad(leads), filename: `${base}.txt`, type: 'text/plain;charset=utf-8' };
    case 'docs':
      return { content: toDocsHtml(leads), filename: `${base}.html`, type: 'text/html;charset=utf-8' };
  }
}

export const EXPORT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: 'sheets', label: 'Google Sheets' },
  { id: 'docs', label: 'Google Docs' },
  { id: 'excel', label: 'Excel' },
  { id: 'word', label: 'Word' },
  { id: 'notepad', label: 'Notepad' },
  { id: 'csv', label: 'CSV' },
  { id: 'json', label: 'JSON' },
];
