import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BackendCore } from "../main/backend-core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const rendererRoot = path.join(projectRoot, "src", "renderer");

const host = process.env.ACTIO_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.ACTIO_PORT || "3010", 10);
const appDataPath = process.env.ACTIO_DATA_DIR || path.join(projectRoot, ".actio-data");

const backend = new BackendCore({
  appDataPath,
  userDataPath: appDataPath,
  appPath: projectRoot,
  cwd: projectRoot
});
backend.init();

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function safePath(base, subPath) {
  const resolved = path.resolve(base, subPath);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 4 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (method === "POST" && pathname === "/api/invoke") {
    try {
      const body = await readJsonBody(req);
      const data = await backend.invoke(body.channel, body.payload || {});
      sendJson(res, 200, { ok: true, data });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error?.message || "Unknown error" });
    }
    return;
  }

  if (method === "POST" && pathname === "/api/timer-state") {
    try {
      const body = await readJsonBody(req);
      await backend.invoke("timer:state", body || {});
      sendJson(res, 200, { ok: true, data: true });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error?.message || "Unknown error" });
    }
    return;
  }

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, data: { status: "ok" } });
    return;
  }

  if (method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  if (pathname === "/") {
    serveFile(res, path.join(rendererRoot, "index.html"));
    return;
  }

  if (pathname === "/app.js" || pathname === "/styles.css" || pathname === "/web-api.js") {
    serveFile(res, path.join(rendererRoot, pathname.slice(1)));
    return;
  }

  const localPath = safePath(projectRoot, pathname.slice(1));
  if (!localPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  serveFile(res, localPath);
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`actio backend listening on http://${host}:${port}`);
});

function shutdown() {
  try {
    backend.stop();
  } finally {
    server.close(() => process.exit(0));
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
