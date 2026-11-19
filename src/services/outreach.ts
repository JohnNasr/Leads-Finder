import type { Lead, OutreachDraft } from '../types';
import { anthropicClient, DEFAULT_ANTHROPIC_MODEL, fillTemplate, parseJsonReply, replyText } from './llm';

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
  provider: 'anthropic' | 'openai' = 'anthropic',
  model = DEFAULT_ANTHROPIC_MODEL,
): Promise<OutreachDraft> {
  if (provider === 'anthropic') {
    return generateWithAnthropic(lead, apiKey, model);
  }
  throw new Error(`Provider ${provider} not yet implemented`);
}

async function generateWithAnthropic(lead: Lead, apiKey: string, model: string): Promise<OutreachDraft> {
  const client = anthropicClient(apiKey);

  const prompt = fillTemplate(OUTREACH_PROMPT, {
    name: lead.name,
    website: lead.website || 'N/A',
    description: lead.description || 'N/A',
    location: lead.location,
    type: lead.type,
    linkedin: lead.linkedin || 'N/A',
    twitter: lead.twitter || 'N/A',
  });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: 'You are a B2B sales assistant. Always return valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = replyText(response.content);

  let draft: OutreachDraft;
  try {
    draft = parseJsonReply<OutreachDraft>(text);
  } catch {
    const shape = response.content.map(b => b.type).join(', ') || 'none';
    console.error('Failed to parse outreach draft:', { stop_reason: response.stop_reason, blocks: shape, text });
    throw new Error(`invalid response format (stop: ${response.stop_reason ?? 'unknown'}, blocks: ${shape})`);
  }
  if (!draft.icebreaker || !draft.subject || !draft.hook || !draft.talking_points) {
    console.error('Outreach draft missing fields:', text);
    throw new Error('Failed to generate outreach draft: invalid response format');
  }
  return draft;
}
