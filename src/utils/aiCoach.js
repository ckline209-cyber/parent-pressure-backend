import Anthropic from '@anthropic-ai/sdk';

// Small, cheap model - this is a short structured personalization tweak on top of a
// deterministic rule, not open-ended reasoning, so it doesn't need a larger model.
const MODEL = 'claude-haiku-4-5-20251001';

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export const isAiCoachAvailable = () => client !== null;

const formatHistory = (history) => {
  if (!history.length) return 'No logged history yet.';
  return history
    .map((h, i) => {
      const reps = h.reps_per_set?.join(', ') ?? '?';
      const weight = h.weight_used_kg != null ? ` @ ${h.weight_used_kg}kg` : '';
      const rpe = h.rpe != null ? ` (RPE ${h.rpe})` : '';
      return `Session ${i + 1}: ${reps} reps${weight}${rpe}`;
    })
    .join('\n');
};

export async function getPersonalizedProgression({
  exerciseName,
  targetReps,
  baseSuggestion,
  recentHistory,
  soreness,
  notes,
}) {
  if (!client) {
    throw new Error('AI coach is not configured (missing ANTHROPIC_API_KEY)');
  }

  const baselineText =
    baseSuggestion.suggested_weight_kg != null
      ? `${baseSuggestion.suggested_weight_kg}kg`
      : `${baseSuggestion.suggested_reps} reps`;

  const prompt = `You are a fitness coach personalizing a strength training progression suggestion for one exercise.

Exercise: ${exerciseName}
Target reps per set: ${targetReps ?? 'unknown'}

Recent session history (most recent last):
${formatHistory(recentHistory)}

Rule-based baseline suggestion: ${baselineText} - "${baseSuggestion.rationale}"

Additional context from the user:
- Reported soreness: ${soreness || 'not reported'}
- Notes: ${notes || 'none'}

Decide whether to confirm the baseline suggestion or adjust it - for example, hold back or reduce the jump if soreness is significant, or flag a plateau if recent sessions have stalled. Keep any adjustment modest and safe; do not recommend large jumps.

Respond with ONLY a single JSON object, no other text, in exactly this shape:
{"suggested_weight_kg": number or null, "suggested_reps": number or null, "adjusted": true or false, "rationale": "one or two sentence explanation in a friendly coach tone"}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('No text response from AI coach');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI coach response was not valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    suggested_weight_kg: parsed.suggested_weight_kg ?? null,
    suggested_reps: parsed.suggested_reps ?? null,
    adjusted: Boolean(parsed.adjusted),
    rationale: String(parsed.rationale || ''),
  };
}
