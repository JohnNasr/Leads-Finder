import type { ContactEmail, Lead } from '../types';

const MARKETING = /marketing|brand|press|media|communicat|\bpr\b|advertis|growth|events/i;
const HR = /\bhr\b|human[ _-]?resources|recruit|talent|career|\bjobs?\b|hiring|people/i;

// Department from an email local part or a job title; undefined means general
export function departmentOf(text: string): ContactEmail['department'] {
  if (MARKETING.test(text)) return 'marketing';
  if (HR.test(text)) return 'hr';
  return undefined;
}

export function leadEmails(lead: Lead): ContactEmail[] {
  if (lead.emails?.length) return lead.emails;
  return lead.email ? [{ email: lead.email }] : [];
}

export function leadPhones(lead: Lead): string[] {
  if (lead.phones?.length) return lead.phones;
  return lead.phone ? [lead.phone] : [];
}

export function joinEmails(lead: Lead): string {
  return leadEmails(lead).map(c => c.email).join('; ');
}

export function joinPhones(lead: Lead): string {
  return leadPhones(lead).join('; ');
}
