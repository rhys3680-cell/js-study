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
async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/todos") {
    return sendJson(res, 200, todos);
  }

  if (req.method === "POST" && url.pathname === "/api/todos") {
    const body = await readBody(req);

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: "잘못된 JSON입니다." });
    }

    if (typeof data.text !== "string" || data.text.trim() === "") {
      return sendJson(res, 400, { error: "text가 필요합니다." });
    }

    const todo = { id: nextId++, text: data.text.trim(), done: false };
    todos.push(todo);

    return sendJson(res, 201, todo); // 201 created
  }

  // --- 프론트 상태 테스트용 ---

  // 느린 응답 → 로딩 상태 확인
  if (url.pathname === "/api/slow") {
    setTimeout(() => sendJson(res, 200, todos), 3000);
    return;
  }

  // 500 → 에러 상태 확인
  if (url.pathname === "/api/fail") {
    return sendJson(res, 500, { error: "Internal Server Error" });
  }

  // 빈 배열 → 빈 상태 확인
  if (url.pathname === "/api/empty") {
    return sendJson(res, 200, []);
  }

  sendJson(res, 404, { error: "Not Found" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
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
      await handleApi(req, res, url);
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
