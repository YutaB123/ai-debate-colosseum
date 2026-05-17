export function sseFormat(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseStream(start: (push: (event: object) => void, close: () => void) => Promise<void> | void): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (e: object) => controller.enqueue(encoder.encode(sseFormat(e)));
      const close = () => controller.close();
      try {
        await start(push, close);
      } catch (e: any) {
        push({ type: "error", message: e?.message ?? String(e) });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
