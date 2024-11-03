import { assertEquals, assertStringIncludes } from '@std/assert';

import { cfAI } from './cf_ai.ts';

Deno.test('cfAI should return a response from Cloudflare API', async () => {
	// set ENV variables first
	// Deno.env.set('CLOUDFLARE_ACCOUNT_ID', '1234');
	// Deno.env.set('CLOUDFLARE_AUTH_TOKEN ', '1234');
	const prompt = 'What is the capital of France?';
	const system = 'You are a helpful assistant.';
	const txt = await cfAI(prompt, system);
	assertStringIncludes(txt, 'Paris');
});
