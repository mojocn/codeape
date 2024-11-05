import { assertExists ,} from '@std/assert';
import { EdgeTts } from './edgetts.ts';

const txt =
	`Deno is awesome!`;

Deno.test({
	name: 'test edge TTS speak',
	sanitizeOps: false, //disable test case warning
	sanitizeResources: false,
	async fn() {
		const tts = new EdgeTts();
		try {
			const result = await tts.speak({
				text: txt,
				voice: 'en-US-AndrewNeural',
			});
			result.writeToFile('text-tts.mp3');
			// Add assertions to verify the output
			assertExists(result);
		} finally {
			tts.close();
		}
	},
});

Deno.test('test edge TTS voice list', async () => {
	const tts = new EdgeTts();
	const voices = await tts.voices();
	assertExists(voices);
});


