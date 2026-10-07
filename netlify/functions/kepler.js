export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) return json({ error: 'Mensaje vacío' }, 400);
    if (!process.env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY no está configurada en Netlify.' }, 500);
    }

    const safeHistory = history
      .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
      .slice(-20)
      .map(x => ({ role: x.role, content: x.content.slice(0, 4000) }));

    // Evitamos duplicar el último mensaje si el frontend ya lo incluyó en history.
    const input = safeHistory.length &&
      safeHistory[safeHistory.length - 1].role === 'user' &&
      safeHistory[safeHistory.length - 1].content === message
      ? safeHistory
      : [...safeHistory, { role: 'user', content: message }];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-6-luna',
        instructions: `Eres KEPLER, un asistente personal de inteligencia artificial con personalidad de mayordomo futurista. Responde en español salvo que el usuario use otro idioma. Sé elegante, tranquilo, preciso y útil. No digas que eres ChatGPT; preséntate como KEPLER. No inventes capacidades que no tengas. Mantén las respuestas relativamente concisas porque serán leídas en voz alta por una voz de mayordomo.`,
        input,
        max_output_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error:', JSON.stringify(data));
      return json({ error: 'La IA no pudo procesar la solicitud.' }, response.status);
    }

    const reply = typeof data.output_text === 'string' ? data.output_text.trim() : '';
    if (!reply) return json({ error: 'La IA devolvió una respuesta vacía.' }, 502);

    return json({ reply });
  } catch (err) {
    console.error('KEPLER function error:', err);
    return json({ error: 'Error interno de Kepler.' }, 500);
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
