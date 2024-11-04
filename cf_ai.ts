const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || '';
const CLOUDFLARE_AUTH_TOKEN = Deno.env.get('CLOUDFLARE_AUTH_TOKEN') || '';

export async function cfAI(
	prompt: string,
	system: string = 'you are a AI helper.',
): Promise<string> {
	const url = 'https://api.cloudflare.com/client/v4/accounts/' +
		CLOUDFLARE_ACCOUNT_ID +
		'/ai/run/@cf/meta/llama-3-8b-instruct';
	const payload = {
		temperature: 0.01,
		stream: false,
		messages: [
			{ 'role': 'system', 'content': system },
			{ 'role': 'user', 'content': prompt },
		],
	};
	const options = {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${CLOUDFLARE_AUTH_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	};
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.statusText}  ${await response
				.text()}`,
		);
	}
	const result: { result: { response: string }; success: boolean } =
		await response.json();
	if (!result.success) {
		throw new Error(`Failed to fetch ${url}: ${result}`);
	}
	return result.result.response;
}

export async function cfAIstream(
	prompt: string,
	system: string = 'you are a AI helper.',
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	const url = 'https://api.cloudflare.com/client/v4/accounts/' +
		CLOUDFLARE_ACCOUNT_ID + '/ai/run/@cf/meta/llama-3-8b-instruct';
	const payload = {
		temperature: 0.01,
		stream: true,
		messages: [
			{ 'role': 'system', 'content': system },
			{ 'role': 'user', 'content': prompt },
		],
	};
	const options = {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${CLOUDFLARE_AUTH_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	};
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.statusText}  ${await response
				.text()}`,
		);
	}
	return response.body!.getReader();
}
