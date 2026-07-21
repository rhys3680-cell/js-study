# 10. SSE - 단방향 데이터 흐름으로 구성하기

탭을 2개 열고 한 쪽에서 할 일을 추가했다. **다른 쪽에서는 안 보인다.**

HTTP는 **클라이언트가 요청해야 서버가 응답하는** 구조다.

---

## SSE는 응답을 종료하지 않는다.

지금까지의 흐름

```js
res.writeHead(200, {...});
res.end(body);            // 응답 끝, 연결 정리
```

SSE는 `end()`를 하지 않는다.

```js
res.writeHead(200, {"Content-Type": "text/event-stream", ...});
res.write("data: 첫 번째\n\n");
// ... 나중에
res.write("data: 두 번째\n\n");
// 계속 열려 있다.
```

언제 끝날지 모르니 `Content-Length`를 줄 수 없다. chunked를 사용한다.

### 형식

```
data: 안녕하세요

```

`data: ` 접두사와 **빈 줄(`\n\n`)로 끝.** 빈 줄이 "메시지 하나 끝"의 신호다.

TCP엔 메시지 경계가 없으므로 **상위 프로토콜이 경계를 정해야 한다.**
HTTP는 `\r\n\r\n`과 Content-Length로, SSE는 `\n\n`으로 한다.

```
event: todo-added
data: {"id":4, "text":"..."}

```

`event:`로 종류를 나누면 클라이언트가 따로 받을 수 있다.

---

## 연결을 모아둔다

```js
const clients = new Set();

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}
```

응답 객체(`res`)를 모아두고, 변경이 있을 때마다 모두에게 전송한다.

```js
if (req.method === "GET" && url.pathname === "/api/events") {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.write(":connected\n\n");

  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
  });

  return;
}
```

**`req.on("close")`가 필수다.** 탭을 닫거나 새로고침하면 연결이 끊기는데, `clients`에서 안 빼면 **죽은 응답 객체에 계속 쓰게 된다.**

`Content-Type: text/event-stream`이 SSE라는 headers다.

---

## 프론트는 EventSource

```js
const source = new EventSource("/api/events");

source.addEventListener("todo-added", (e) => {
  const todo = JSON.parse(e.data);
  setState({ todos: [...state.todos, todo] });
});
```

`fetch`처럼 브라우저 내장이다.

그리고 **연결이 끊기면 자동으로 재연결한다.**

---

## 중복

붙이자마자 항목이 2개씩 생겼다.

```js
// POST 성공
const todo = await createTodo(text);
setState({ todos: [...state.todos, todo] }); // 1번

// SSE 이벤트
source.addEventListener("todo-added", (e) => {
  setState({ todos: [...state.todos, todo] }); // 2번
});
```

**추가한 본인도 broadcast를 받는다.**

`some`으로 걸러보려 했지만 타이밍 이슈가 발생했다.

```js
if (state.todos.some((t) => t.id === todo.id)) return;
```

서버가 `broadcast()`를 `sendJson()`보다 먼저 부르므로,
**브로드캐스트가 POST 응답보다 먼저 도착할 수 있다.**
그러면 2번이 실행될 때 `state.todos`엔 아직 없으니 통과하고, 그다음 1번이 또 넣는다.

### 해결

방어 코드를 추가하는 대신 **상태를 바꾸는 곳을 하나로 줄였다.**

```js
// 요청만 보냄
await createTodo(text);
await toggleTodo(id, !todo.done);
await deleteTodo(id);
```

상태 갱신은 **SSE 리스너 3개에서만** 일어난다.

```
[변경 전]                      [변경 후]

클릭 → 요청 → 응답 → setState   클릭 → 요청
     └→ SSE ──────→ setState         └→ SSE → setState
   (경로 2개, 중복)                  (경로 1개)
```

**응답을 안 쓰고 서버가 알려줄 때만 반영한다.**

요청과 화면 갱신이 분리되면서 코드가 오히려 짧아졌다.

---

## 확인

- 개발자도구 Network 탭에서 `/api/events`가 **`pending` 상태로 계속** 있다.
  다른 요청은 완료되는데 이것만 안 끝난다 — 응답을 안 닫았다는 뜻.
- 탭을 열고 닫을 때마다 서버 로그에 연결 수가 변한다.

---

## 남은 것

- 서버가 죽으면 `clients`가 통째로 사라진다 (메모리)
- 클라이언트 → 서버 방향은 여전히 HTTP 요청뿐 → WebSocket
