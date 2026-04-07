#!/usr/bin/env bun

export {};

const runtimeUrl = "http://127.0.0.1:48123/runtime/message";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const writeMessage = async (payload: unknown) => {
  const json = encoder.encode(JSON.stringify(payload));
  const header = new ArrayBuffer(4);
  new DataView(header).setUint32(0, json.length, true);
  await Bun.write(Bun.stdout, new Uint8Array(header));
  await Bun.write(Bun.stdout, json);
};

let buffer = Buffer.alloc(0);

const flushMessages = async () => {
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < 4 + length) {
      return;
    }

    const rawMessage = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);

    try {
      const payload = JSON.parse(decoder.decode(rawMessage));
      const response = await fetch(runtimeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      await writeMessage(body);
    } catch (error) {
      await writeMessage({
        ok: false,
        error: error instanceof Error ? error.message : "Bridge request failed."
      });
    }
  }
};

const reader = Bun.stdin.stream().getReader();

while (true) {
  const { value, done } = await reader.read();
  if (done) {
    break;
  }

  buffer = Buffer.concat([buffer, Buffer.from(value)]);
  await flushMessages();
}
