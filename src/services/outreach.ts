import { Anthropic } from '@anthropic-ai/sdk';
import type { Lead, OutreachDraft } from '../types';

const OUTREACH_PROMPT = `You are a B2B sales assistant. Given a lead with the following information:
- Name: {name}
- Website: {website}
- Description: {description}
- Location: {location}
- Type: {type}
- LinkedIn: {linkedin}
- Twitter: {twitter}

Write a personalized outreach draft with:
1. A personalized icebreaker (1 sentence, specific to this lead)
2. An email subject line (under 50 characters)
3. A hook (1-2 sentences that grab attention)
4. 3 talking points for the conversation

Return ONLY valid JSON with this exact structure:
{
  "icebreaker": "string",
  "subject": "string",
  "hook": "string",
  "talking_points": ["string", "string", "string"]
}`;

export async function generateOutreachDraft(
  lead: Lead,
  apiKey: string,
  provider: 'anthropic' | 'openai' = 'anthropic'
): Promise<OutreachDraft> {
  if (provider === 'anthropic') {
    return generateWithAnthropic(lead, apiKey);
  }
  throw new Error(`Provider ${provider} not yet implemented`);
}

async function generateWithAnthropic(lead: Lead, apiKey: string): Promise<OutreachDraft> {
  const client = new Anthropic({ apiKey });
  
  const prompt = OUTREACH_PROMPT
    .replace('{name}', lead.name)
    .replace('{website}', lead.website || 'N/A')
    .replace('{description}', lead.description || 'N/A')
    .replace('{location}', lead.location)
    .replace('{type}', lead.type)
    .replace('{linkedin}', lead.linkedin || 'N/A')
    .replace('{twitter}', lead.twitter || 'N/A');

  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    system: 'You are a B2B sales assistant. Always return valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const draft = JSON.parse(text) as OutreachDraft;
    // Validate required fields
    if (!draft.icebreaker || !draft.subject || !draft.hook || !draft.talking_points) {
      throw new Error('Missing required fields in response');
    }
    return draft;
  } catch {
    console.error('Failed to parse outreach draft:', text);
    throw new Error('Failed to generate outreach draft: invalid response format');
  }
}