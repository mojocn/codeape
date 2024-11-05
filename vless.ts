#!/usr/bin/env -S deno run -A

function toUUIDWithoutDash(arr: Uint8Array) {
	return Array.from(arr)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

// https://xtls.github.io/development/protocols/vless.html
// https://github.com/zizifn/excalidraw-backup/blob/main/v2ray-protocol.excalidraw
export class VlessPayload {
	hasError: boolean;
	message: string;
	userUUID: string;
	remoteProtocol: string;
	remoteHost: string;
	remotePort: number;
	remoteType: number;
	version: number;
	firstChunkPayload: ArrayBuffer;

	constructor(vlessBuffer: Uint8Array) {
		this.hasError = false;
		this.message = '';
		this.userUUID = '';
		this.remoteProtocol = '';
		this.remoteHost = '';
		this.remotePort = 0;
		this.remoteType = 0;
		this.version = 0;
		this.firstChunkPayload = new ArrayBuffer(0);
		if (vlessBuffer.byteLength < 24) {
			this.hasError = true;
			this.message = 'invalid data';
			return;
		}

		const versionArr = new Uint8Array(vlessBuffer.slice(0, 1));

		this.userUUID = toUUIDWithoutDash(
			new Uint8Array(vlessBuffer.slice(1, 17)),
		);

		const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];

		// 0x01: TCP, 0x02: UDP, 0x03: MUX
		const command = new Uint8Array(
			vlessBuffer.slice(18 + optLength, 18 + optLength + 1),
		)[0];
		// 0x01 TCP
		// 0x02 UDP
		// 0x03 MUX
		if (command === 1) {
			this.remoteProtocol = 'tcp';
		} else if (command === 2) {
			this.remoteProtocol = 'udp';
		} else {
			this.hasError = true;
			this.message =
				`command ${command} is not support, command 01-tcp,02-udp,03-mux`;
			this.remoteProtocol = 'unknown';
			return;
		}
		const portIndex = 18 + optLength + 1;
		const portBuffer: Uint8Array = vlessBuffer.slice(
			portIndex,
			portIndex + 2,
		);
		const portRemote = (portBuffer[0] << 8) | portBuffer[1];

		const addressIndex = portIndex + 2;
		const addressBuffer = new Uint8Array(
			vlessBuffer.slice(addressIndex, addressIndex + 1),
		);
		//1-IPv4(4bytes), 2-domain, 3-IPv6(16bytes)
		const addressType = addressBuffer[0];
		let addressLength = 0;
		let addressValueIndex = addressIndex + 1;
		let addressValue = '';

		switch (addressType) {
			case 1: { // IPv4
				addressLength = 4;
				addressValue = new Uint8Array(
					vlessBuffer.slice(
						addressValueIndex,
						addressValueIndex + addressLength,
					),
				).join('.');
				break;
			}
			case 2: { // domain
				addressLength = new Uint8Array(
					vlessBuffer.slice(addressValueIndex, addressValueIndex + 1),
				)[0];
				addressValueIndex += 1;
				addressValue = new TextDecoder().decode(
					vlessBuffer.slice(
						addressValueIndex,
						addressValueIndex + addressLength,
					),
				);
				break;
			}
			case 3: { // IPv6
				addressLength = 16;
				const ipv6bytes: Uint8Array = vlessBuffer.slice(
					addressValueIndex,
					addressValueIndex + addressLength,
				);
				const dataView = new DataView(ipv6bytes.buffer);
				const ipv6 = [];
				for (let i = 0; i < 8; i++) {
					ipv6.push(dataView.getUint16(i * 2).toString(16));
				}
				addressValue = ipv6.join(':');
				break;
			}
			default: { // invalid addressType
				this.hasError = true;
				this.message = `invalid addressType is ${addressType}`;
				return;
			}
		}

		if (!addressValue) {
			this.hasError = true;
			this.message =
				`addressValue is empty, addressType is ${addressType}`;
			return;
		}

		this.hasError = false;
		this.message = '';
		this.remoteHost = addressValue;
		this.remoteType = addressType;
		this.remotePort = portRemote;
		const rawDataIndex = addressValueIndex + addressLength;
		this.firstChunkPayload = vlessBuffer.slice(rawDataIndex);
		this.version = versionArr[0];
	}
}

export type AuthFn = (userUuidWithoutDashes: string) => boolean;
export type TrafficFn = (uuid: string, trafficMB: number) => void;
export class Session {
	hasSentWsVersionHeader: boolean;
	outboundHost: string;
	outboundPort: number;
	outboundHostType: number; //ipv4,ipv6,domain same as v2ray spec
	vlessVersion: number;
	webSocket: WebSocket;
	outboundTcpSock?: Deno.TcpConn;
	outboundDnsSock?: TransformStream;
	userUuidWithoutDash: string;
	trafficIncoming: number; //bytes length
	trafficOutgoing: number; //bytes length
	authFn: AuthFn;
	trafficFn?: TrafficFn;

	constructor(ws: WebSocket, authFn: AuthFn, trafficFn?: TrafficFn) {
		this.hasSentWsVersionHeader = false;
		this.outboundHost = '';
		this.outboundPort = 0;
		this.outboundHostType = 0;
		this.vlessVersion = 0;
		this.userUuidWithoutDash = '';
		this.trafficIncoming = 0;
		this.trafficOutgoing = 0;
		this.webSocket = ws;
		this.authFn = authFn;
		this.trafficFn = trafficFn;
	}

	get traffic(): number {
		return (this.trafficIncoming + this.trafficOutgoing) / 1024 / 1024.0; //MB
	}

	public start() {
		this.webSocketReadStream.pipeTo(
			new WritableStream<Uint8Array>({
				write: async (chunk: Uint8Array, controller) => {
					this.trafficIncoming += chunk.byteLength;
					if (this.isOutboundSockReady) {
						await this.writeToOutbound(chunk);
						return;
					}
					// parse first chunk to get remoteHost, remotePort, remoteType
					const {
						hasError,
						message,
						userUUID,
						remoteProtocol,
						remotePort,
						remoteHost,
						remoteType,
						version,
						firstChunkPayload,
					} = new VlessPayload(chunk);
					if (hasError) {
						controller.error(
							'parse VLESS protocol data failed:' + message,
						);
						return;
					}
					if (this.authFn && !this.authFn(userUUID)) {
						controller.error('userUUID is not match:' + userUUID);
						return;
					}
					this.userUuidWithoutDash = userUUID;
					this.outboundHost = remoteHost;
					this.outboundPort = remotePort;
					this.outboundHostType = remoteType;
					this.vlessVersion = version;

					if (remoteProtocol === 'udp' && remotePort === 53) {
						this.outboundDns(firstChunkPayload).catch(
							(error) => {
								controller.error(
									'handleDnsOutBound has error:' +
										error.message,
								);
							},
						);
					} else if (remoteProtocol === 'tcp' && remotePort === 25) {
						controller.error(
							'cloudflare does not support tcp on port 25',
						);
					} else if (remoteProtocol === 'tcp') {
						//do not add await here, because we need to handle tcp out bound in parallel
						// Deno Deploy: TLS termination is required for outgoing connections to port 443 (the port used for HTTPS). Using Deno.connect to connect to these ports is prohibited.
						//If you need to establish a TLS connection to port 443, please use Deno.connectTls instead. fetch is not impacted by this restriction.
						this.outboundTcp(firstChunkPayload).catch(
							(error) => {
								controller.error(
									'handleTcpOutBoundInner has error:' +
										error.message,
								);
							},
						);
					} else if (remoteProtocol === 'udp') {
						try {
							this.outboundUdp(firstChunkPayload);
						} catch (error) {
							controller.error(
								'handleUdpOutBound has error:' + error,
							);
						}
					} else {
						console.error(
							'udp not support initial connect' + remoteProtocol +
								remotePort,
						);
						controller.error('udp not support initial connect');
					}
				},
				close: () => {
					console.info(`readableWebSocketStream is close`);
					this.closeOutboundSock();
				},
				abort: (reason) => {
					console.error(
						`readableWebSocketStream is abort`,
						JSON.stringify(reason),
					);
				},
			}),
		).catch((err) => {
			console.error('wsReadStream pipeTo error', err);
		}).finally(() => {
			//record traffic
			if (this.trafficFn) {
				this.trafficFn(this.userUuidWithoutDash, this.traffic);
			}
		});
	}

	public get isOutboundSockReady(): boolean {
		return this.outboundTcpSock !== undefined ||
			this.outboundDnsSock !== undefined;
	}

	private closeWebSocket() {
		const socket = this.webSocket;
		if (
			!socket || socket.readyState === WebSocket.CLOSING ||
			socket.readyState === WebSocket.CLOSED
		) {
			return;
		}
		try {
			socket.close();
		} catch (error) {
			console.error('close WebSocket error', error);
		}
	}

	private closeOutboundSock() {
		if (this.outboundTcpSock) {
			this.outboundTcpSock.close();
			this.outboundTcpSock = undefined;
		}
		if (this.outboundDnsSock) {
			this.outboundDnsSock.writable.close();
			this.outboundDnsSock.readable.cancel();
			this.outboundDnsSock = undefined;
		}
	}

	private get webSocketReadStream(): ReadableStream<Uint8Array> {
		return new ReadableStream({
			start: (controller) => {
				this.webSocket.onopen = (event: Event) => {
					console.info('webSocketServer is open', event);
				};
				this.webSocket.onmessage = (event: MessageEvent) => {
					controller.enqueue(new Uint8Array(event.data)); //event.data is ArrayBuffer
				};
				this.webSocket.onclose = (event: CloseEvent) => {
					console.info(
						'webSocketServer is close',
						event.code,
						event.reason,
					);
					this.closeOutboundSock;
				};
				this.webSocket.onerror = (event: Event) => {
					console.error('webSocketServer has error', event);
					controller.error(event);
				};
			},
			pull: (controller) => {},
			cancel: (reason) => {
				console.error(`ReadableStream was canceled, due to ${reason}`);
				this.closeWebSocket();
			},
		});
	}

	private async newTcpSocket(): Promise<Deno.TcpConn> {
		console.info('newTcpSocket', this.outboundHost, this.outboundPort);
		return await Deno.connect({
			hostname: this.outboundHost,
			port: this.outboundPort,
			transport: 'tcp',
		});
	}

	private async tcpSockPipeToWebSocket(): Promise<boolean> {
		if (!this.outboundTcpSock) {
			console.error('tcpSocket is undefined');
			return false;
		}
		let isRemoteSocketHasIncomingData = false;
		const webSocketWriter = new WritableStream({
			start: () => {},
			write: async (
				chunk: Uint8Array,
				controller: WritableStreamDefaultController,
			) => {
				try {
					await this.writeToWebsocket(chunk);
					isRemoteSocketHasIncomingData = true;
				} catch (error) {
					controller.error(
						'webSocketWriter!.writable has error' + error,
					);
				}
			},
			close: () => {
				console.info(
					`webSocketWriter!.writable is close with hasIncomingData is ${isRemoteSocketHasIncomingData}`,
				);
				this.outboundTcpSock && this.outboundTcpSock.close();
			},
			abort: (reason: string) => {
				console.error('tcpSockPipeToWebSocket has error', reason);
				this.closeWebSocket;
			},
		});

		await this.outboundTcpSock.readable.pipeTo(webSocketWriter).catch(
			(error) => {
				console.error(
					`tcpSocket.readable.pipeTo has exception `,
					error.stack || error,
				);
				this.closeWebSocket();
			},
		);
		if (!isRemoteSocketHasIncomingData) {
			console.log(
				'tcpSockPipeToWebSocket has no incoming data, close ws',
			);
		}
		return isRemoteSocketHasIncomingData;
	}

	private async writeToOutbound(chunk: ArrayBuffer) {
		const tcpSocket: Deno.TcpConn | TransformStream | undefined =
			this.outboundTcpSock || this.outboundDnsSock;
		if (tcpSocket) {
			console.info('remote', tcpSocket);
			const writer = tcpSocket.writable.getWriter();
			await writer.write(chunk);
			console.info('writeToRemote', chunk.byteLength);
			writer.releaseLock();
		}
	}
	private async writeToWebsocket(chunk: ArrayBuffer) {
		if (this.webSocket.readyState !== WebSocket.OPEN) return;
		this.trafficOutgoing += chunk.byteLength;
		if (this.hasSentWsVersionHeader) {
			this.webSocket.send(chunk);
		} else {
			// ["version", "extra bytes length N"]
			const vlessResponseHeader = new Uint8Array([this.vlessVersion, 0]);
			this.webSocket.send(
				await new Blob([vlessResponseHeader, chunk]).arrayBuffer(),
			);
			this.hasSentWsVersionHeader = true;
		}
	}

	private async outboundDns(initialData: ArrayBuffer) {
		const transformStream = new TransformStream<Uint8Array, Uint8Array>({
			start(controller) {
			},
			transform(chunk: Uint8Array, controller) {
				// udp message 2 byte is the the length of udp data
				// ?? this should have bug, because maybe udp chunk can be in two websocket message
				for (let index = 0; index < chunk.byteLength;) {
					const lengthBuffer = chunk.slice(index, index + 2);
					const udpPacketLength = new DataView(lengthBuffer.buffer)
						.getUint16(0);
					const udpData: Uint8Array = new Uint8Array(
						chunk.slice(index + 2, index + 2 + udpPacketLength),
					);
					index = index + 2 + udpPacketLength;
					controller.enqueue(udpData);
				}
			},
			flush(controller) {
			},
		});
		this.outboundDnsSock = transformStream;
		transformStream.readable.pipeTo(
			new WritableStream({
				write: async (chunk: Uint8Array) => {
					const resp = await fetch('https://1.1.1.1/dns-query', {
						method: 'POST',
						headers: {
							'content-type': 'application/dns-message',
						},
						body: chunk,
					});
					if (!resp.ok) {
						console.error('dns udp has error' + resp.statusText);
						return;
					}

					const dnsQueryResult = await resp.arrayBuffer();
					const udpSize = dnsQueryResult.byteLength;
					// console.log([...new Uint8Array(dnsQueryResult)].map((x) => x.toString(16)));
					const udpSizeBuffer = new Uint8Array([
						(udpSize >> 8) & 0xff,
						udpSize & 0xff,
					]);
					const udpChunk: ArrayBuffer = await new Blob([
						udpSizeBuffer,
						dnsQueryResult,
					]).arrayBuffer();
					await this.writeToWebsocket(udpChunk);
				},
			}),
		).catch((error) => {
			console.error('dns udp has error' + error);
		});
		await this.writeToOutbound(initialData);
	}

	private outboundUdp(initialPayload: ArrayBuffer) {
		throw new Error(
			'udp not support initial connect;todo when cloudflare supports udp',
		);
	}

	private async outboundTcp(initialPayload: ArrayBuffer) {
		let isRemoteSocketHasIncomingData = false;
		// 1.remote direct connect
		this.outboundTcpSock = await this.newTcpSocket();
		if (this.outboundTcpSock) {
			this.writeToOutbound(initialPayload);
			isRemoteSocketHasIncomingData = await this.tcpSockPipeToWebSocket();
		}
		if (!isRemoteSocketHasIncomingData) {
			this.closeWebSocket();
			console.error('handleTcpOutBound has no incoming data, close ws');
		}
	}
}

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

Deno.serve(handleRequest);
