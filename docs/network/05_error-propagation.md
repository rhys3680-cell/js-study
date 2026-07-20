# 05. 에러 전파 과정 - 콜백, Promise, try/catch

04에서 같은 `try/catch`가 어떤 에러는 잡고 어떤 에러는 놓쳤다.
그 기준에 대해 알아본다.

---

## try/catch가 잡는 것

**호출 스택을 따라 올라가며** 핸들러를 찾는다.

```js
function a() {
  throw new Error("!");
}
function b() {
  a();
}

try {
  b(); // 스택: try → b → a
} catch (e) {
  // a에서 던진 게 b를 거쳐 여기까지 올라온다.
}
```

`throw`는 현재 스택을 되감으며(unwind) `catch`를 찾는다.
**같은 스택 안에 있어야 잡힌다.**

---

## 콜백이 스택을 끊는다.

```js
try {
  setTimeout(() => {
    throw new Error("!");
  }, 100);
} catch (e) {
  // 여기 안 온다
}
```

`setTimeout`은 **콜백을 등록만 하고 즉시 반환한다.**
try 블록은 그 자리에서 끝난다.

100ms 뒤 이벤트 루프가 콜백을 실행할 때는 **스택이 비워진 뒤 새로 시작**한다.
그 스택에는 `try`가 없다.

```
[등록 시점]              [실행 시점 — 100ms 후]
  main                     (빈 스택)
   └ try                     └ 콜백
      └ setTimeout ✓             └ throw  ← 올라갈 catch가 없다
   try 끝
```

**동기 코드에서는 "시간"이 문제가 되지 않는다. 스택이 이어져있다.**
비동기에서는 스택이 끊긴다.

---

## Promise는 에러를 값으로 바꾼다.

Promise는 **에러를 던지는 대신 상태로 들고 있는다.**

```js
const p = Promise.reject(new Error("!"));
// 여기서 p는 rejected 상태를 가진 객체이다.
```

이 에러를 꺼내는 방법은 다음과 같다.

```js
p.catch(e => ...)         // 1. 메서드 체인으로
await p                   // 2. await하면 throw로 바뀐다
```

rejected Promise를 await하면 그 자리에서 `throw`가 일어난다.

```js
try {
  await p;
} catch (e) {
  // 잡힌다.
}
```

---

## await를 빠뜨리면?

```js
try {
  boom(); // async 함수. await 없음
} catch (e) {
  // 안 잡힌다
}
```

`boom()`은 **Promise를 반환하고 즉시 끝난다.** 에러는 그 Promise 안에 들어있고, 꺼내지 않았다. try 블록은 정상 통과한다.

이 Promise를 처리하지 않으면 → **`unhandledRejection`**

04에서 썼던 코드:

```js
if (url.pathname.startsWith("/api/")) {
  handleApi(req, res, url); // 동기 처리
} else {
  await handleStatic(req, res, url); // 비동기 처리
}
```

`handleApi`를 나중에 async(DB)로 변경하면 `await` 붙여야 한다.

## 정리 — 무엇이 스택을 잇는가

|                           | 스택 연결               | try/catch                   |
| ------------------------- | ----------------------- | --------------------------- |
| 동기 호출                 | 이어짐                  | 잡힘                        |
| `await`                   | 이어짐 (언어가 복원)    | 잡힘                        |
| `.then/.catch`            | 끊김 (체인이 대신 처리) | 안 잡힘(.catch가 대신 처리) |
| 콜백 (`setTimeout`, `on`) | 끊김                    | **안 잡힘**                 |

---

## 콜백 안의 에러는 콜백 안에서

전파될 곳이 없으므로 그 자리에서 처리해야 한다.

```js
setTimeout(() => {
  try {
    risky();
  } catch (e) {
    sendJson(res, 500, { error: "..." }); // 응답 객체는 클로저로 접근 가능
  }
}, 100);
```

또는 콜백을 Promise로 감싸서 `await` 가능하게 만든다.

```js
await new Promise((r) => setTimeout(r, 100));
risky();
```

**Node의 이벤트 기반 API가 Promise 버전을 따로 제공하는 이유이다.**
(`fs` vs `fs/promises`)

---

## process.on은 무엇인가

```js
process.on("uncaughtException", ...) // 콜백에서 던졌는데 아무도 안 잡음
process.on("unhandledRejection", ...) // rejected Promise를 아무도 안 꺼냄
```

여기 온 시점에서 프로그램 상태를 신뢰할 수 없다. → 로그를 남기고 종료한다.

### "프로그램 상태를 신뢰할 수 없다"의 뜻

에러는 코드 중간에서 터진다.

```js
todos = todos.filter(...);   // ① 실행됨
await save(todos);            // ② 여기서 터짐
todos.push(item);             // ③ 안 됨
```

다음과 같은 자원이 정리되지 못하고 남는다:

- 안 닫힌 파일 핸들·커넥션
- res.end()를 못 해서 매달린 요청 (클라이언트는 타임아웃까지 대기)
- 절반만 바뀐 전역 변수 - 다음 요청이 이걸 읽는다

로그를 읽고 원인을 파악해 버그를 수정한다.

### 케이스 1 — 04에서 봤던 것

```
GET /api/boom
처리 중 에러: Error: 의도적인 에러
    at handleApi (file:///c:/dev/.../api-server.js:39:11)
    at Server.<anonymous> (file:///c:/dev/.../api-server.js:70:7)
    at Server.emit (node:events:508:28)
    at parserOnIncoming (node:_http_server:1210:12)
```

읽는 법:

- `처리 중 에러:` — 우리가 쓴 최상위 catch가 잡았다는 뜻. 잡혔으니 서버는 살아 있다
- 스택 첫 줄 `at handleApi (...:39:11)` — 39번 줄 11번째 칸에서 발생
- 아래로 갈수록 호출한 쪽. `Server.emit` → `parserOnIncoming`은 Node 내부라 우리 코드가 아니다

**진단**: 우리 코드 39번 줄을 보면 된다. 요청 하나만 실패했고 조치는 그 줄 수정.

### 케이스 2 — /api/boom-async

```
잡히지 않은 예외: Error: 비동기 에러
    at Timeout._onTimeout (file:///c:/dev/.../api-server.js:44:13)
    at listOnTimeout (node:internal/timers:605:17)
    at process.processTimers (node:internal/timers:541:7)
```

읽는 법:

- `잡히지 않은 예외:` — process.on까지 갔다. try/catch가 다 실패했다는 뜻
- `at Timeout._onTimeout` — 콜백 안에서 났다는 결정적 단서
- `listOnTimeout`, `processTimers` — 타이머가 호출한 것. HTTP 요청 스택이 없다

**진단**: 스택에 `Server.emit`이 없다. 요청 처리 흐름과 끊긴 곳에서 났다는 뜻.
44번 줄 콜백 안에 try/catch를 넣거나, Promise로 감싸 await해야 한다.
