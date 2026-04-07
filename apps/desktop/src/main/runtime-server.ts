import { createServer, type IncomingMessage } from "node:http";

import { runtimeIncomingMessageSchema } from "@clockedin/shared";

import { DesktopController } from "./controller";

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let rawBody = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      rawBody += chunk;
    });
    request.on("end", () => resolve(rawBody));
    request.on("error", reject);
  });

export class RuntimeServer {
  private readonly server = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Content-Type", "application/json");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.url === "/health" && request.method === "GET") {
      response.writeHead(200);
      response.end(JSON.stringify(this.controller.getSnapshot().statuses));
      return;
    }

    if (request.url === "/runtime/config" && request.method === "GET") {
      response.writeHead(200);
      response.end(JSON.stringify(this.controller.getRuntimeConfig()));
      return;
    }

    if (request.url === "/runtime/message" && request.method === "POST") {
      try {
        const rawBody = await readBody(request);
        const payload = runtimeIncomingMessageSchema.parse(JSON.parse(rawBody));
        const result = this.controller.handleRuntimeMessage(payload);

        response.writeHead(200);
        response.end(
          JSON.stringify({
            ok: true,
            result,
            config: this.controller.getRuntimeConfig()
          })
        );
      } catch (error) {
        response.writeHead(400);
        response.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "Invalid runtime payload."
          })
        );
      }
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ ok: false, error: "Not found." }));
  });

  constructor(
    private readonly controller: DesktopController,
    private readonly host: string,
    private readonly port: number
  ) {}

  async start() {
    await new Promise<void>((resolve) => {
      this.server.listen(this.port, this.host, () => resolve());
    });
  }

  async stop() {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
