import net from "node:net";

let count = 0;

const server = net.createServer((socket) => {
  const id = ++count;

  console.log(`[${id}] 접속됨`);
  console.log(`[${id}] 상대: ${socket.remoteAddress}:${socket.remotePort}`);
  console.log(`[${id}] 나 : ${socket.localAddress}:${socket.localPort}`);

  socket.on("data", (chunk) => {
    console.log(
      `[${id}] 받음 (${chunk.length}바이트): ${chunk.toString().trim()}`,
    );
  });

  socket.on("end", () => {
    console.log(`[${id}] 상대가 끊음`);
  });

  socket.on("error", (err) => {
    console.log(`[${id}] 에러: ${err.code}`);
  });

  socket.on("close", (hadError) => {
    console.log(`[${id}] 닫힘 (에러로 인한 종료: ${hadError})`);
  });
});

server.on("error", (err) => {
  console.error("서버 에러:", err.code);
});

server.listen(4000, () => {
  console.log("4000 포트에서 대기 중");
});
