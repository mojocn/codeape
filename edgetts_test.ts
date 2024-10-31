import { assertExists } from "@std/assert";
import { EdgeTts } from "./edgetts.ts";

const txt = `Would you like to use a free text-to-speech service that produces high-quality voices?
I wrote a TypeScript Deno repository to demonstrate how to use the amazing free Text-to-Speech API.
You can find the GitHub repository link below.
Let's figure out how it works.
To understand the repository, you need to know how WebSockets work.
A computer expert used a special tool to see how the online text-to-speech function worked on the Microsoft Edge web browser.
By doing it this way, we can access a high-quality text-to-speech API for free.
If you want to try cracking again, you'll need to download and set up a tool called Burp Suite first.
Let's go straight to the codebase and see how it really works.
STEP 2:  Edge TTS Voices
Get a list of all the voices that are supported by Microsoft Edge's text-to-speech feature.
The Voice List API looks like this.
You can simply use the fetch function to get the JSON response.
"
This is what an available voices API response looks like."
STEP 2: Edge TTS Speak
Let's start looking at how to turn text into speech.
The text to speech API uses websockets.
WebSockets are a bit more complex than HTTP.
You need to manage several Websocket events to access voice and speaking word information.
First, let's connect the WebSocket endpoint.
After the open event, We will listen and respond with an initial message.
"This message contains information about what details the text-to-speech endpoint should return.
"
Metadata options include things like the audio output format, timestamps for speaking words, and timestamps for speaking sentences."
At the same time, we need to listen for both the "error" and "close" events.
Let's start with the speaking part of the codebase.
We combine the text and speaking options, then send the message to the websocket.
We Create a "Promise" to handle WebSocket message for text-to-speech processing.
The TtsResult object will be filled once the promise is completed successfully.
In the WebSocket "message" event listener, we deal with two types of data.
The "Path:audio" separator is used for audio files.
The "Path:audio:metadata" separator is used to mark the time when word or sentence are spoken.
STEP 3: Write Audio to File
After everything is done, we can use the TtsResult to write a file or create a subtitle.
Now we can easily turn our text into an audio file using the free text-to-speech API.
If you're interested in the codebase,
"
You can find the link to the GitHub repository in the video below."
If you enjoy watching this video, please show your appreciation by liking it and considering subscribing to my channel.`

Deno.test({
   name: "test edge TTS speak",
   sanitizeOps: false,//disable test case warning
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
   for (const voice of voices) {
      console.log(voice);
   }
   assertExists(voices);
});