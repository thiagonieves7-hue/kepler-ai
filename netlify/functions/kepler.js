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

    if (!message) return json({ error: 'Mensaje vacio' }, 400);
    if (!process.env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY no esta configurada en Netlify.' }, 500);
    }

    let safeHistory = history
      .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
      .slice(-20)
      .map(x => ({ role: x.role, content: x.content.slice(0, 4000) }));

    while (safeHistory.length && safeHistory[0].role !== 'user') safeHistory.shift();

    const last = safeHistory[safeHistory.length - 1];
    const messages = last && last.role === 'user' && last.content === message
      ? safeHistory
      : [...safeHistory, { role: 'user', content: message }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: 'Eres KEPLER, un asistente personal de inteligencia artificial con personalidad de mayordomo futurista. Responde en espanol salvo que el usuario use otro idioma. Se elegante, tranquilo, preciso y util. Presentate como KEPLER. No inventes capacidades que no tengas. Manten las respuestas relativamente concisas porque seran leidas en voz alta por una voz de mayordomo.',
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return json({
        error: 'Anthropic rechazo la solicitud.',
        status: response.status,
        details: data
      }, response.status);
    }

    const reply = Array.isArray(data.content)
      ? data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      : '';
    if (!reply) return json({ error: 'La IA devolvio una respuesta vacia.' }, 502);

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