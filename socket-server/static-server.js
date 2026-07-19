import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PUBLIC_DIR = path.resolve("public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // '/'로 오면 index.html
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, pathname);

  console.log(`${req.method} ${url.pathname} → ${filePath}`);

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": content.length,
    });
    res.end(content);
  } catch (err) {
    console.log(`실패: ${err.code}`);
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.on("error", (err) => {
  console.error("서버 에러:", err.code);
});

server.listen(3000, () => {
  console.log("http://localhost:3000");
});
