import net from "node:net";

const socket = net.createConnection({ port: 4000 }, () => {
  console.log("연결됨. 내 포트:", socket.localPort);
  socket.write("안녕하세요");
});

socket.on("error", (err) => {
  console.log("에러:", err.code);
});

socket.on("close", () => {
  console.log("닫힘");
});
