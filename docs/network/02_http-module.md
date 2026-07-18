# 02. http 모듈 - net이 안 해주던 것

HTTP 응답을 주고 받으려면 `net`으로 소켓을 열고 `socket.write`를 사용하면 된다.

```js
socket.write("HTTP/1.1 200 OK\r\n");
socket.write("Content-Type: text/html; charset=utf-8\r\n");
socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n`);
socket.write("\r\n");
socket.write(body);
```

요청은 `chunk.toString()`으로 확인할 수 있지만 가독성이 낮고 경로를 설정할 수 없다.

`http` 모듈을 활용하면 된다.

---

## 위치

```
net           바이트 주고받기          ← 01
  ↓
http          바이트 ↔ HTTP 메시지     ← 여기
  ↓
Express 등    라우팅·미들웨어
```

`http`는 **`net`을 감싸고 있다.** 내부에서 `net.Server`를 만들어 쓴다.
`server.on('connection', socket => ...)`로 원래 소켓을 꺼내볼 수도 있다.

---

## 객체 3개

| 객체                      | 정체                   | 스트림   |
| ------------------------- | ---------------------- | -------- |
| `http.Server`             | `net.Server`를 감싼 것 | —        |
| `req` (`IncomingMessage`) | 파싱된 요청            | **읽기** |
| `res` (`ServerResponse`)  | 만들어갈 응답          | **쓰기** |

**`req`/`res`은 스트림이다.**

- `req`가 읽기 스트림 → POST 본문이 chunk로 쪼개져 온다.
- `res`가 쓰기 스트림 → `end()`를 안 하면 응답이 안 끝난다.

---

## req - 요청

`curl`로 3가지 요청을 보내봤다.

```bash
curl http://localhost:3000/
curl http://localhost:3000/pokemon?limit=20
curl -X POST http://localhost:3000/submit
```

```
method : GET
url    : /
headers: { host: 'localhost:3000', 'user-agent': 'curl/8.21.0', accept: '*/*' }
---
method : GET
url    : /pokemon?limit=20
---
method : POST
url    : /submit
```

```
GET /pokemon?limit=20 HTTP/1.1
 ↓        ↓            ↓
method   url      httpVersion
```

**headers의 키는 전부 소문자다.** curl이 `Host:`, `User-Agent:`로 보냈는데
`host`, `user-agent`로 들어왔다. HTTP 헤더 이름은 대소문자를 구분하지 않아서
`http` 모듈이 정규화한다.

### 쿼리스트링 파싱

`url`이 문자열이라 직접 갈라야 한다.

```js
const url = new URL(req.url, `http://${req.headers.host}`);
url.pathname; // '/pokemon'
url.searchParams.get("limit"); // '20'
```

`new URL`은 절대 URL을 요구하므로 base를 두 번째 인자로 준다.
