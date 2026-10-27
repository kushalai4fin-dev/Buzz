// AI provider interface for Buzz explainers.
// A provider is { name, model, generate({ system, user }) -> { text, inputTokens, outputTokens } }.
// Errors carry flags the runner understands:  err.quota = true (rate or quota limit: stop for today)
//                                            err.fatal = true (bad key or no access: stop the run)
// The model is chosen by the repository owner (GEMINI_MODEL) and is NEVER switched automatically,
// so a run can never quietly move to a paid model. The key is read from the environment only.

export function geminiProvider({ apiKey, model, fetchFn = fetch, timeoutMs = 60000 }) {
  return {
    name: 'gemini',
    model,
    async generate({ system, user }) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      let res;
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 7000, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        throw new Error('Network error calling the AI provider');
      }
      if (res.status === 429) {
        const e = new Error('AI provider rate or quota limit reached (HTTP 429)');
        e.quota = true;
        throw e;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const e = new Error(`AI provider refused the request (HTTP ${res.status}). Check the key and the model name.`);
        e.fatal = true;
        throw e;
      }
      if (!res.ok) throw new Error(`AI provider error (HTTP ${res.status})`);
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('AI provider returned something that is not JSON');
      }
      if (data.promptFeedback && data.promptFeedback.blockReason) throw new Error('AI provider blocked the prompt');
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map((p) => p.text || '').join('') : '';
      if (!text) throw new Error('AI provider returned no text');
      if (cand.finishReason && cand.finishReason !== 'STOP') throw new Error(`AI provider stopped early (${cand.finishReason})`);
      const u = data.usageMetadata || {};
      return { text, inputTokens: u.promptTokenCount || 0, outputTokens: u.candidatesTokenCount || 0 };
    },
  };
}

// Returns a provider, or null when no AI is configured (the site then simply has no explainers).
export function getProvider(env = process.env, fetchFn = fetch) {
  const name = String(env.EXPLAIN_PROVIDER || (env.GEMINI_API_KEY ? 'gemini' : 'none')).toLowerCase();
  if (name === 'gemini' && env.GEMINI_API_KEY) {
    return geminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-2.5-flash', fetchFn });
  }
  return null;
}
