# 04. API 서버 - 라우팅과 에러 처리

## 갈래 나누기

03까지 서버는 모든 요청을 파일 읽기로 보냈다.
데이터를 주었을 때 분기 처리가 필요해졌다.

```js
if (url.pathname.startsWith("/api/")) {
  handleApi(req, res, url);
} else {
  await handleStatic(req, res, url);
}
```

`/api/`로 시작하면 데이터, 아니면 파일을 보낸다.(라우팅)
Express의 `app.get('/api/todos', ...)`가 하는 일이 이 분기다.

`/api/` 접두사는 관례일 뿐 강제가 아니다. 다만 협업 시 REST API 등등 관례에 맞게 작성해야한다.

### 함수 3개를 정의했다.

|                | 역할                                  |
| -------------- | ------------------------------------- |
| `handleApi`    | 경로·메서드를 보고 데이터를 돌려준다  |
| `handleStatic` | 파일을 읽어 돌려준다 (03에서 만든 것) |
| `sendJson`     | JSON 응답의 공통 부분                 |

`sendJson`을 뽑은 이유

```js
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}
```

**Content-Length를 headers에 넣지 않았을 경우 `Transfer-Encoding: chunked`로 온다.**

응답을 받는 쪽은 "어디까지가 이 응답인가"를 알아야 한다.
TCP는 바이트 흐름이지 메시지 경계가 없다. HTTP는 이걸 2가지 방법으로 해결한다.

1. Content-Length - 길이를 미리 알려준다

```
HTTP/1.1 200 OK
Content-Length: 31

<h1>hello from http module</h1>
```

이 경우 받는 입장에서 31 바이트까지만 응답으로 인식한다. 그래서 보내기 전에 파일이라면 stat, 문자열이라면 Buffer.byteLength로 길이를 재야한다.

2. Transfer-Encoding: chunked

```
HTTP/1.1 200 OK
Transfer-Encoding: chunked

1f
<h1>hello from http module</h1>
0
```

각 조각 앞에 16진수로 그 조각의 길이를 쓴다. 1f = 31, 마지막에 0을 보내면 "끝".

|           | Content-Length    | chunked                           |
| --------- | ----------------- | --------------------------------- |
| 전체 크기 | 미리 알아야 함    | 몰라도 됨                         |
| 방식      | "31바이트 읽어라" | 조각마다 길이를 붙이고 마지막에 0 |
| 진행률    | 가능              | 불가능                            |

chunked는 스트리밍처럼 만들면서 동시에 보낼 때 필요하다.
SSE 만들 때 다시 나온다.

## 에러로 인한 서버 종료

핸들러 안에서 예외가 나면 Node는 프로세스를 종료한다.
요청 하나가 잘못되면 **서비스 전체가 내려간다.**

그래서 최상위에 try/catch를 작성했다.

```js
const server = http.createServer(async (req, res) => {
  try {
    // 라우팅
  } catch (err) {
    console.error("처리 중 에러:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal Server Error" });
    }
  }
});
```

`headersSent` 확인이 필요한 이유 - 응답을 절반 보내다 에러가 나면 헤더는 이미 전송된 뒤여서 500을 보낼 수 없다.

### 확인: 의도적으로 에러 발생시키기

```js
if (url.pathname === "/api/boom") {
  throw new Error("의도적인 에러");
}
```

```
GET /api/boom
처리 중 에러: Error: 의도적인 에러
GET /api/todos          ← 서버가 살아서 다음 요청 처리
```

api endpoint에 따라 아래의 status를 반환하도록 작성되었다. (실제로도 반환)
/api/todo은 404
/api/boom(처리 중 에러)는 500

### 잡지 못하는 부분

```js
if (url.pathname === "/api/boom-async") {
  setTimeout(() => {
    throw new Error("비동기 에러");
  }, 100);
  return;
}
```

```
curl: (56) Recv failure: Connection was reset
```

이유:

```js
try {
  setTimeout(() => {
    throw new Error("..."); // ← 100ms 뒤 실행
  }, 100);
  // try 블록 끝
} catch (err) {
  // 콜백이 실행 될 때 이 catch는 존재하지 않음
}
```

`setTimeout`은 콜백을 **등록만 하고 즉시 반환한다.**
100ms 뒤 콜백이 실행될 땐 다른 실행 컨텍스트다.

try/catch는 **호출 스택을 따라 올라가며** 핸들러를 찾는데,
콜백은 스택이 비워진 뒤 새로 시작하므로 catch에 도달하지 못한다.
