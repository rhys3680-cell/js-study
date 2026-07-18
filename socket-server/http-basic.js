import http from "node:http";

const server = http.createServer((req, res) => {
  console.log("method :", req.method);
  console.log("url    :", req.url);
  console.log("headers:", req.headers);
  console.log("---");
  const body = "<h1>hello from http module</h1>";

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
});

server.on("error", (err) => {
  console.error("서버 에러:", err.code);
});

server.listen(3000, () => {
  console.log("http://localhost:3000");
});
