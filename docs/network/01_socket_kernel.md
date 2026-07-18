# 01. 소켓의 아래층 - 커널이 하는 일

01에서 `net.createServer()`로 소켓을 열었다. 그런데 그 함수는 어떤 일을 하는 걸까?

---

## 시스템 콜

`net.createServer().listen(4000)` 한 줄이 커널에 4 번 요청한다.

```
socket() 소켓 생성 → 파일 디스크립터 반환
bind() 주소·포트 할당
listen() 대기 큐 생성
accept() 대기 큐에서 연결 하나 꺼냄 → 새 fd 반환
```

**소켓은 파일 디스크립터다.** 유닉스 계열에서 소켓은 파일과 같은 방식으로 다뤄진다.
`read`/`write`로 읽고 쓰고 `close`로 닫는다.
Node의 `socket.on('data')`와 `socket.write()`가 이걸 감싼 것.

`accept()`가 **새 fd를 반환**한다. 서로 다른 파일 디스크립터다.

---

## TCP 상태 머신

각 연결은 커널 안에서 상태를 가진다.

```
LISTEN → SYN_RCVD → ESTABLISHED → FIN_WAIT → TIME_WAIT → CLOSED
```

서버를 켜둔 채로 명령어를 통해 확인할 수 있다:

```powershell
netstat -ano | findstr :4000
```

`LISTEN` 하나(듣기 소켓)와 `ESTABLISHED` 여러 개(연결 소켓)가 보인다.

### TIME_WAIT - 서버를 껐다 바로 키면 안 되는 이유

연결을 닫아도 상태가 바로 `CLOSED`가 되지 않는다. `TIME_WAIT`로 2분쯤 남는다.

**늦게 도착한 패킷이 다음 연결에 섞이지 않게**하려는 것이다.
같은 포트로 새 연결이 생겼을 때, 이전 연결의 지연된 패킷이 도착하면 데이터가 오염된다.
