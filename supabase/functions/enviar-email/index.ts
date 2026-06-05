const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { to, subject, html } = await req.json();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer re_6wWMHw6G_JKmjCqire1xwrVdQQoYwgJ5W',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Teffe Tecnologia <contato@teffe.com.br>',
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: res.status,
  });
});
