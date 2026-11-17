import type { Lead, FitScore } from '../types';
import { anthropicClient, DEFAULT_ANTHROPIC_MODEL, parseJsonReply, replyText } from './llm';

const ICP_PROMPT = `You are an expert B2B sales analyst. Evaluate how well this lead matches the Ideal Customer Profile (ICP).

ICP Description:
{icp}

Lead Information:
- Name: {name}
- Type: {type}
- Location: {location}
- Website: {website}
- Description: {description}
- LinkedIn: {linkedin}
- Twitter: {twitter}

Score this lead from 0-100 based on how well it matches the ICP. Consider:
- Industry/type alignment
- Company size indicators (from description, website)
- Geographic fit
- Technology stack relevance
- Any other ICP criteria

Return ONLY valid JSON with this exact structure:
{
  "score": number,
  "reason": "string explaining the score",
  "tags": ["string", "string", "string"]
}`;

export async function scoreLeads(
  leads: Lead[],
  icpConfig: string,
  apiKey: string,
  provider: 'anthropic' | 'openai' = 'anthropic',
  model = DEFAULT_ANTHROPIC_MODEL,
): Promise<Lead[]> {
  if (provider === 'anthropic') {
    return scoreWithAnthropic(leads, icpConfig, apiKey, model);
  }
  throw new Error(`Provider ${provider} not yet implemented`);
}

async function scoreWithAnthropic(
  leads: Lead[],
  icpConfig: string,
  apiKey: string,
  model: string,
): Promise<Lead[]> {
  const client = anthropicClient(apiKey);
  const scoredLeads = [...leads];

  // Process in batches of 10 to avoid token limits
  const batchSize = 10;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    // Process individually for better accuracy
    for (let j = 0; j < batch.length; j++) {
      const lead = batch[j];
      const leadPrompt = ICP_PROMPT
        .replace('{icp}', icpConfig)
        .replace('{name}', lead.name)
        .replace('{type}', lead.type)
        .replace('{location}', lead.location)
        .replace('{website}', lead.website || 'N/A')
        .replace('{description}', lead.description || 'N/A')
        .replace('{linkedin}', lead.linkedin || 'N/A')
        .replace('{twitter}', lead.twitter || 'N/A');

      try {
        const response = await client.messages.create({
          model,
          max_tokens: 2048,
          system: 'You are a B2B sales analyst. Always return valid JSON only.',
          messages: [{ role: 'user', content: leadPrompt }],
        });

        const text = replyText(response.content);
        const fitScore = parseJsonReply<FitScore>(text);
        
        if (typeof fitScore.score === 'number' && fitScore.reason && Array.isArray(fitScore.tags)) {
          const leadIndex = leads.findIndex(l => l.id === lead.id);
          if (leadIndex !== -1) {
            scoredLeads[leadIndex] = {
              ...scoredLeads[leadIndex],
              fit_score: {
                score: Math.max(0, Math.min(100, fitScore.score)),
                reason: fitScore.reason,
                tags: fitScore.tags.slice(0, 5),
              },
            };
          }
        }
      } catch (err) {
        console.error(`Failed to score lead ${lead.id}:`, err);
        // Leave lead without score
      }
    }
  }

  return scoredLeads;
}