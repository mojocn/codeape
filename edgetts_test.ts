import { assertExists } from "@std/assert";
import { EdgeTts } from "./edgetts.ts";

const txt = `Would you like to use a free text-to-speech service that produces high-quality voices?
I wrote a TypeScript Deno repository to demonstrate how to use the amazing free text-to-speech.
You can find the GitHub repository link below.
Let's figure out how it works.
To understand the repository, you need to know how WebSockets work.
A tech-savvy person used a special tool to see how the online text-to-speech worked on the Microsoft Edge web browser.
He discovered that the text-to-speech server uses a special WebSocket to convert text into speech.
I won't share the step-by-step process for locating the internal text-to-speech API in Microsoft Edge browser.
But I'd be happy to share the detailed logs of the Burp-suite from text-to-speech WebSocket.
We can find the link to the text-to-speech WebSocket protocol documentation below.
Let's go straight to the codebase and see how it really works.


STEP 1:  Edge Text to Speech Voices
Get a list of all the voices that are supported by Microsoft Edge's text-to-speech feature.
The Voice List API looks like this.
We can simply use the 'fetch' function to get the JSON response.
This is what an available voices response looks like.


STEP 2: Edge Text-to-Speech
Let's start looking at how to turn text into speech.
The text to speech uses WebSockets.
WebSockets are a bit more complex than HTTP.
We need to manage several Websocket events to access voice and speaking word information.
First, let's connect the WebSocket endpoint.
We cannot customize headers to create a WebSocket connection in Deno without using a library, unlike in Go or Python where the standard library allows it.
If we can't customize the headers of a WebSocket connection, it may cause connection problems or even get blocked by Microsoft.
After the WebSocket open event, We will respond with an initial message.
This message contains information about what details the text-to-speech endpoint should return.
Metadata options include things like the audio output format, timestamps for speaking words, and timestamps for speaking sentences."
At the same time, we need to listen for both the error and close events.
Let's start with the speaking part of the codebase.
We combine the text and speaking options, then send the message to the Websocket.
We Create a promise to handle WebSocket message for text-to-speech processing.
The text to speech result will be filled once the promise is completed successfully.
In the WebSocket message event listener, we deal with two types of data.
The path audio separator is used for audio files.
The path audio metadata separator is used to mark the time when word or sentence are spoken.


STEP 3: Write Audio to File
After everything is done, we can use the text to speech result to write a file or create a subtitle.
We put the parts of the MP3 audio together.
Use the 'deno write sync' function to write the blob data into an MP3 file, making sure the file is saved successfully.
Now we can easily turn our text into an audio file using the free text-to-speech.
If you're interested in the codebase,
You can find the link to the GitHub repository in the video below.
If you enjoy watching this video, please show your appreciation by liking it and considering subscribing to my channel.`

Deno.test({
   name: "test edge TTS speak",
   sanitizeOps: false,//disable test case warning
   sanitizeResources: false,
   async fn() {
      const tts = new EdgeTts();
      try {
         const result = await tts.speak({ 
            text: txt,
            voice: "en-US-AndrewNeural",
          });
         console.log(result);
         result.writeToFile("text-tts.mp3");
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