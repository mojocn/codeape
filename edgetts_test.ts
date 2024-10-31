import { assertExists } from "@std/assert";
import { EdgeTts } from "./edgetts.ts";

let txt = `i actually prefer stuffs that doesn't have a talking head or a person trying to make jokes etc.. but granted the types of videos I watch on YouTube are very limited, I usually only watch videos about astrophysics, philosophy or other thoughtful contents, and i prefer AI voiceover on these because almost always there's not much bullshit speaking, with AI voiceovers it's almost always straight to the point, always see these kinds of videos with millions of views.. I personally never liked those podcast kind of videos with people`

Deno.test({
   name: "edge tts speak test",
   sanitizeOps: false,
   sanitizeResources: false,
   async fn() {
      const tts = new EdgeTts();
      try {
         const result = await tts.speak({ text: txt });
         console.log(result);
         result.writeToFile("output.mp3");
         // Add assertions to verify the output
         assertExists(result);
      } finally {
         tts.close();
      }
   },
});


Deno.test("test edge TTS voice list", async () => {
   const tts = new EdgeTts();
   const voices = await tts.voices();
   assertExists(voices);
});