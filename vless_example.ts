import { AuthFn, Session, TrafficFn } from './vless.ts';

function vlessProxy(request: Request): Response {
	const { socket, response } = Deno.upgradeWebSocket(request);
	const envUserUUID = Deno.env.get('USER_UUID') || '';

	const checkAuth: AuthFn = (userUuidWithoutDashes: string): boolean => {
		return userUuidWithoutDashes === envUserUUID.replaceAll(/-/g, '');
	};
	const trafficFn: TrafficFn = (kk: string, trafficDeltaMB: number) => {
		console.info(`trafficFn: ${kk} ${trafficDeltaMB}`);
	};
	const session = new Session(socket, checkAuth, trafficFn);
	session.start();
	// record user's traffic
	return response;
}

async function handleRequest(request: Request): Promise<Response> {
	const env = Deno.env;
	if (request.headers.get('Upgrade') === 'websocket') {
		return await vlessProxy(request);
	}
	return new Response('Hello World', {
		headers: { 'content-type': 'text/plain' },
	});
}

export default { fetch: handleRequest };
//deno serve --allow-net --allow-env vless.ts
