import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PUBLIC_DIR = path.resolve("public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

// --- 데이터 (메모리) ---
let nextId = 3;
let todos = [
  { id: 1, text: "소켓 이해하기", done: true },
  { id: 2, text: "API 만들기", done: false },
];

// --- 응답 헬퍼 ---
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// --- API ---
function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/todos") {
    return sendJson(res, 200, todos);
  }

  // 일부러 에러 던지기
  if (url.pathname === "/api/boom") {
    throw new Error("의도적인 에러");
  }

  if (url.pathname === "/api/boom-async") {
    setTimeout(() => {
      throw new Error("비동기 에러");
    }, 100);
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
}

// --- 정적 파일 ---
async function handleStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, pathname);

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type":
        MIME[path.extname(filePath)] ?? "application/octet-stream",
      "Content-Length": content.length,
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
}

// --- 라우팅 ---
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    console.log(`${req.method} ${url.pathname}`);

    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
    } else {
      await handleStatic(req, res, url);
    }
  } catch (err) {
    console.error("처리 중 에러:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal Server Error" });
    }
  }
});

server.on("error", (err) => console.error("서버 에러:", err.code));

server.listen(3000, () => console.log("http://localhost:3000"));

process.on("uncaughtException", (err) => {
  console.error("잡히지 않은 예외:", err);
  // 로그만 남기고 종료하는 게 정석
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("처리 안 된 Promise 거부:", err);
  process.exit(1);
});
