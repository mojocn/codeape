export const toMs = (duration: number): number => Math.floor(duration / 10_000);
interface WordBoundary {
	Type: 'WordBoundary';
	Data: {
		Offset: number; // use toMs to convert to ms
		Duration: number; // use toMs to convert to ms
		text: {
			Text: string;
			Length: number;
			BoundaryType: 'WordBoundary' | 'SentenceBoundary';
		};
	};
}

interface AudioMetadata {
	Metadata: [WordBoundary];
}

interface TTSOptions {
	/** The text that will be generated as audio */
	text: string;

	/**
	 * Voice persona used to read the message.
	 * Please refer to [Language and voice support for the Speech service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
	 *
	 * Defaults to `"en-US-AvaNeural"`
	 */
	voice?: string;

	/**
	 * Language of the message.
	 * Please refer to [Language and voice support for the Speech service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
	 *
	 * Defaults to `"en-US"`
	 */
	language?: string;

	/**
	 * Format of the audio output.
	 * Please refer to [SpeechSynthesisOutputFormat Enum](https://learn.microsoft.com/en-us/dotnet/api/microsoft.cognitiveservices.speech.speechsynthesisoutputformat?view=azure-dotnet)
	 *
	 * Defaults to `"audio-24khz-96kbitrate-mono-mp3"`
	 */
	// outputFormat?: string;

	/**
	 * Indicates the speaking rate of the text.
	 * Please refer to [Customize voice and sound with SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#adjust-prosody)
	 *
	 * Defaults to `"default"`
	 */
	rate?: string;

	/**
	 * Indicates the baseline pitch for the text.
	 * Please refer to [Customize voice and sound with SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#adjust-prosody)
	 *
	 * Defaults to `"default"`
	 */
	pitch?: string;
	/**
	 * Indicates the volume level of the speaking voice.
	 * Please refer to [Customize voice and sound with SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#adjust-prosody)
	 *
	 * Defaults to `"default"`
	 */
	volume?: string;
}

export interface VoiceTag {
	ContentCategories: string[];
	VoicePersonalities: string[];
}

export interface Voice {
	Name: string;
	ShortName: string;
	Gender: string;
	Locale: string;
	SuggestedCodec: string;
	FriendlyName: string;
	Status: string;
	VoiceTag: VoiceTag;
}

function ssmlStr(options: TTSOptions): string {
	const voice = options.voice ?? 'en-US-AvaNeural';
	const language = options.language ?? 'en-US';
	const rate = options.rate ?? 'default';
	const pitch = options.pitch ?? 'default';
	const volume = options.volume ?? 'default';
	const requestId = globalThis.crypto.randomUUID();
	return `X-RequestId:${requestId}\r\n
X-Timestamp:${new Date().toString()}Z\r\n
Content-Type:application/ssml+xml\r\n
Path:ssml\r\n\r\n
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${language}">
<voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
    ${options.text}
    </prosody>
</voice>
</speak>
  `;
}
class TtsResult {
	audioParts: Array<BlobPart>;
	marks: Array<WordBoundary>;
	constructor() {
		this.audioParts = [];
		this.marks = [];
	}
	get mp3Blob(): Blob {
		return new Blob(this.audioParts, { type: 'audio/mpeg' });
	}
	async writeToFile(path?: string) {
		path = path ?? 'output.mp3';
		const blob = new Blob(this.audioParts);
		const arrayBuffer = await blob.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		Deno.writeFileSync(path, uint8Array);
	}
}

export class EdgeTts {
	websocket?: WebSocket;
	token: string;
	constructor(token?: string) {
		this.token = token ?? '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
	}

	async voices(): Promise<Array<Voice>> {
		const url =
			`https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${this.token}`;
		const response = await fetch(url);
		const voices: Array<Voice> = await response.json();
		return voices;
	}

	connWebsocket(): Promise<WebSocket> {
		const url = new URL(
			`/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${this.token}`,
			'wss://speech.platform.bing.com',
		);
		const ws = new WebSocket(url);
		//sentenceBoundaryEnabled = true is not supported in some countries
		const initialMessage = `
X-Timestamp:${new Date().toString()}\r\n
Content-Type:application/json; charset=utf-8\r\n
Path:speech.config\r\n\r\n
{"context":{"synthesis":{"audio":{"metadataoptions":
{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"true"},
"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`;

		return new Promise<WebSocket>((resolve, reject) => {
			ws.addEventListener('open', () => {
				ws.send(initialMessage);
				resolve(ws);
			});
			ws.addEventListener('error', reject);
			ws.addEventListener('close', console.info);
		});
	}
	close() {
		if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
			this.websocket.close();
		}
		this.websocket = undefined;
	}
	async speak(options: TTSOptions): Promise<TtsResult> {
		const ws = await this.connWebsocket();
		this.websocket = ws;
		const textXml = ssmlStr(options);
		ws.send(textXml);
		const result = new TtsResult();
		const promise = new Promise<TtsResult>((resolve) => {
			ws.addEventListener(
				'message',
				async (message: MessageEvent<string | Blob>) => {
					if (typeof message.data !== 'string') {
						const blob: Blob = message.data;
						const separator = 'Path:audio\r\n';
						const text = await blob.text();
						const index = text.indexOf(separator) +
							separator.length;
						const audioBlob = blob.slice(index);
						result.audioParts.push(audioBlob);
						return;
					}
					if (message.data.includes('Path:audio.metadata')) {
						const parts = message.data.split('Path:audio.metadata');
						if (parts.length >= 2) {
							const meta = JSON.parse(parts[1]) as AudioMetadata;
							result.marks.push(meta.Metadata[0]);
						}
					} else if (message.data.includes('Path:turn.end')) {
						return resolve(result);
					}
				},
			);
		});
		return await promise;
	}
}
