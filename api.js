// api.js — Groq API integration for ICP Scoring Agent

// ── Custom error types ──────────────────────────────────────────────────────
export class AuthError extends Error { constructor(m) { super(m); this.name = 'AuthError'; } }
export class RateLimitError extends Error { constructor(m) { super(m); this.name = 'RateLimitError'; } }
export class NetworkError extends Error { constructor(m) { super(m); this.name = 'NetworkError'; } }
export class ParseError extends Error { constructor(m) { super(m); this.name = 'ParseError'; } }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

// ── Prompt builder ──────────────────────────────────────────────────────────
/**
 * Build system + user messages from ICP config + prospect text.
 * @param {object} icpConfig
 * @param {string} prospectText
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildPrompt(icpConfig, prospectText) {
  const systemPrompt = `You are an ICP scoring engine for a B2B SaaS outbound team.
Your task: evaluate a prospect against an Ideal Customer Profile (ICP) and return a structured JSON score.

SCORING DIMENSIONS (each 0–25, total 0–100):

| Dimension     | What to evaluate                                                      |
|---------------|-----------------------------------------------------------------------|
| title_fit     | How closely their current role matches the ICP target titles          |
| company_fit   | Industry, headcount, geography alignment with ICP                     |
| pain_signal   | Explicit or implicit evidence of the pain the product solves          |
| timing_signal | Urgency cues — recent hiring, funding, reorg, stated Q-level priority |

TIER THRESHOLDS:
- Hot:  75–100
- Warm: 45–74
- Cold: 0–44

ICP DEFINITION:
Target Titles: ${icpConfig.titles || 'Not specified'}
Industries: ${icpConfig.industries || 'Not specified'}
Company Size: ${icpConfig.companySize || 'Not specified'}
Geography: ${icpConfig.geography || 'Not specified'}
Pain Points: ${icpConfig.painPoints || 'Not specified'}
Budget Signals: ${icpConfig.budgetSignals || 'Not specified'}

OUTPUT RULES:
- Respond ONLY with valid JSON matching this exact schema. No preamble, no explanation outside JSON.
- Dimension scores must sum to the total score.
- Tier must match the score range.
- next_action must be specific and actionable (1–2 sentences).
- profile_summary must be a 2–3 sentence gist summarizing the prospect's background, role, and key experience.
- reasoning must be 2–3 sentences synthesising the score.

JSON SCHEMA:
{
  "score": <integer 0-100>,
  "tier": <"Hot" | "Warm" | "Cold">,
  "profile_summary": "<2-3 sentence summary gist>",
  "dimensions": {
    "title_fit":     { "score": <0-25>, "note": "<one sentence>" },
    "company_fit":   { "score": <0-25>, "note": "<one sentence>" },
    "pain_signal":   { "score": <0-25>, "note": "<one sentence>" },
    "timing_signal": { "score": <0-25>, "note": "<one sentence>" }
  },
  "reasoning": "<2-3 sentences>",
  "next_action": "<specific outbound action>"
}`;

  const userMessage = `Score this prospect against the ICP:

${prospectText.trim()}`;

  return { systemPrompt, userMessage };
}

// ── Response validator ──────────────────────────────────────────────────────
function validateResult(obj) {
  if (typeof obj.score !== 'number') throw new ParseError('Missing or invalid score');
  if (!['Hot', 'Warm', 'Cold'].includes(obj.tier)) throw new ParseError('Invalid tier');
  if (!obj.dimensions) throw new ParseError('Missing dimensions');
  const dims = ['title_fit', 'company_fit', 'pain_signal', 'timing_signal'];
  for (const d of dims) {
    if (!obj.dimensions[d]) throw new ParseError(`Missing dimension: ${d}`);
    if (typeof obj.dimensions[d].score !== 'number') throw new ParseError(`Invalid score for ${d}`);
  }
  if (!obj.profile_summary) throw new ParseError('Missing profile_summary');
  if (!obj.reasoning) throw new ParseError('Missing reasoning');
  if (!obj.next_action) throw new ParseError('Missing next_action');
  return obj;
}

// ── Core API call ───────────────────────────────────────────────────────────
async function callGroq(apiKey, systemPrompt, userMessage, model) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })
  });

  if (res.status === 401) throw new AuthError('Invalid API key. Check your Groq console.');
  if (res.status === 429) throw new RateLimitError('Rate limit hit');
  if (!res.ok) throw new NetworkError(`Groq returned ${res.status}`);

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new ParseError('Empty response from model');

  let parsed;
  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new ParseError('Model returned invalid JSON');
  }

  return validateResult(parsed);
}

// ── Public API: scoreProspect ───────────────────────────────────────────────
/**
 * Score a prospect against the ICP.
 * Auto-retries with fallback model on rate limit.
 * @param {string} apiKey
 * @param {object} icpConfig
 * @param {string} prospectText
 * @param {string} [model]
 * @returns {Promise<{ result: ScoreResult, modelUsed: string }>}
 */
export async function scoreProspect(apiKey, icpConfig, prospectText, model = PRIMARY_MODEL) {
  const { systemPrompt, userMessage } = buildPrompt(icpConfig, prospectText);

  try {
    const result = await callGroq(apiKey, systemPrompt, userMessage, model);
    return { result, modelUsed: model };
  } catch (err) {
    // Auto-fallback on rate limit
    if (err instanceof RateLimitError && model === PRIMARY_MODEL) {
      const result = await callGroq(apiKey, systemPrompt, userMessage, FALLBACK_MODEL);
      return { result, modelUsed: FALLBACK_MODEL };
    }
    throw err;
  }
}
