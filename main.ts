import { SSE, Event } from "./sse.ts";

function handler(_req: Request) {
  const sse = new SSE();
  let counter = 0;
  const interval = setInterval(() => {
    counter++;
    if (counter > 10) {
      clearInterval(interval);
      sse.close();//stop sending events
      return;
    }
    const ev: Event = {
      id: counter,
      event: "message",
      data: { a: 1 },
    };
    sse.write(ev);
    ev.data = "Hello, world!";
    sse.write(ev);
  }, 250);
  return sse.response();
}



Deno.serve(handler);
