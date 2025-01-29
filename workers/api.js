export default {
    async fetch(request, env) {
        // Get client IP
        const clientIP = request.headers.get('cf-connecting-ip');
        const rateKey = `rate:${clientIP}`;

        // CORS handling - more permissive for development
        const origin = request.headers.get('Origin') || '*';

        // Common CORS headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Max-Age": "86400",
        };

        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { 
                status: 405,
                headers: corsHeaders
            });
        }

        try {
            // Rate limiting check
            let rateCheckPassed = true;
            if (env.KV_STORE) {
                try {
                    const currentRequests = await env.KV_STORE.get(rateKey);
                    const count = currentRequests ? parseInt(currentRequests) : 0;

                    if (count >= RATE_LIMIT.REQUESTS) {
                        rateCheckPassed = false;
                        return new Response(JSON.stringify({
                            error: 'Rate limit exceeded. Please try again later.'
                        }), {
                            status: 429,
                            headers: {
                                ...corsHeaders,
                                'Content-Type': 'application/json'
                            }
                        });
                    }

                    await env.KV_STORE.put(rateKey, (count + 1).toString(), {
                        expirationTtl: RATE_LIMIT.WINDOW
                    });
                } catch (kvError) {
                    console.error('KV Store error:', kvError);
                    // Continue processing if KV store fails
                }
            }

            if (!rateCheckPassed) {
                return;
            }

            const { message, target, history = [] } = await request.json();

            if (!message) {
                throw new Error("Message is required");
            }

            if (!target) {
                throw new Error("Target assistant is required");
            }

            // Message validation
            if (typeof message !== 'string' || 
                message.length > 2000 || 
                message.length < 1) {
                throw new Error("Invalid message format or length");
            }

            // Map the conversation history
            const mappedHistory = Array.isArray(history) ? history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })) : [];

            let response;

            if (target === 'gpt') {
                const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.OPENAI_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4',
                        messages: [...mappedHistory, { role: 'user', content: message }],
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                if (!gptResponse.ok) {
                    const errorData = await gptResponse.json();
                    throw new Error(`GPT API Error: ${errorData.error?.message || gptResponse.status}`);
                }

                const gptData = await gptResponse.json();
                response = {
                    gpt: gptData.choices[0].message.content
                };

            } else if (target === 'claude') {
                const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': env.ANTHROPIC_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-sonnet-latest',
                        messages: [...mappedHistory, { role: 'user', content: message }],
                        max_tokens: 500
                    })
                });

                if (!claudeResponse.ok) {
                    const errorData = await claudeResponse.json();
                    throw new Error(`Claude API Error: ${errorData.error?.message || claudeResponse.status}`);
                }

                const claudeData = await claudeResponse.json();
                response = {
                    claude: claudeData.content[0].text
                };
            }

            return new Response(JSON.stringify(response), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({ 
                error: error.message || 'An error occurred processing your request',
                code: error.name || 'UnknownError'
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
}
