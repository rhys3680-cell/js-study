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

---

### 브라우저는 훨씬 많은 헤더를 보낸다.

curl은 헤더 3개를 보냈다. 같은 서버에 크롬으로 접속하니 15개가 왔다.
그리고 **한 번 접속에 요청이 3개** 왔다.

| url                                                 | 정체                                        |
| --------------------------------------------------- | ------------------------------------------- |
| `/`                                                 | 주소창으로 요청한 문서                      |
| `/.well-known/appspecific/com.chrome.devtools.json` | 개발자도구가 보내는 것                      |
| `/favicon.ico`                                      | HTML에 안 넣었는데 브라우저가 알아서 찾는다 |

**서버는 브라우저가 보내는 모든 요청을 받는다.** 우리가 의도한 것만 오지 않는다.

#### 공통 헤더

| 헤더                     | 의미                                         |
| ------------------------ | -------------------------------------------- |
| `host`                   | 어느 사이트인지. HTTP/1.1의 유일한 필수 헤더 |
| `connection: keep-alive` | 응답 후에도 연결을 끊지 말 것                |
| `user-agent`             | 클라이언트 정체                              |
| `accept-encoding`        | 압축 방식 (gzip, br, zstd)                   |
| `accept-language`        | 선호 언어                                    |

`accept-language: 'ko-KR,ko;q=0.9,ja-JP;q=0.8,...'`
→ `q`는 **품질값(우선순위)**. 없으면 1.0. 한국어 > 일본어 > 영어 순.

`user-agent`에 Mozilla·AppleWebKit·Chrome·Safari가 다 들어 있다.
옛날 서버들이 UA로 기능을 분기하던 시절, 차단당하지 않으려고 서로의 이름을
갖다 붙인 흔적이다. 지금은 아무도 정리하지 못하는 화석.

#### sec-fetch-\* — 요청의 맥락

브라우저가 "어디서, 왜, 뭐에 쓰려고" 요청하는지 알려준다.
**브라우저가 붙이는 것이라 JS로 위조할 수 없다.**

세 요청을 비교하면 명확하다.

|                  | `/`        | devtools      | favicon       |
| ---------------- | ---------- | ------------- | ------------- |
| `sec-fetch-site` | `none`     | `same-origin` | `same-origin` |
| `sec-fetch-mode` | `navigate` | `no-cors`     | `no-cors`     |
| `sec-fetch-dest` | `document` | `empty`       | `image`       |
| `sec-fetch-user` | `?1`       | —             | —             |

- **`site`** — `none`(주소창 직접 입력) / `same-origin` / `cross-site`(CSRF 의심 지점)
- **`mode`** — `navigate`(페이지 이동) / `no-cors`(이미지·스크립트) / `cors`(fetch)
- **`dest`** — `document` / `image` / `empty`(fetch·XHR) / `script`, `style`, `font` 등
- **`user: ?1`** — 사용자가 직접 한 행동. JS가 일으킨 이동엔 안 붙는다

서버가 이걸로 판단할 수 있다:

```js
// 다른 사이트에서 온 POST → CSRF 의심
if (req.headers['sec-fetch-site'] === 'cross-site' && req.method === 'POST') { ... }
```

#### accept는 용도마다 다르다

같은 브라우저인데 요청 목적에 따라 다르게 보낸다.

```
/ 요청       accept: text/html,application/xhtml+xml,...,*/*;q=0.8
favicon 요청  accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8
```

문서를 원할 땐 `text/html`이 앞에, 이미지를 원할 땐 `image/*`가 앞에 온다.

#### referer는 favicon 요청에만 있다

```
referer: 'http://localhost:3000/'
```

"이 페이지 때문에 요청한다"는 뜻. 주소창 입력(`/` 요청)은 출발 페이지가 없어서 안 붙는다.

> `referer`는 철자가 틀린 채로 표준이 됐다. `referrer`가 맞는데 초기 명세의 오타가 굳었다.
> JS의 `document.referrer`는 제대로 쓴다.

#### 그 외

| 헤더                           | 의미                                                  |
| ------------------------------ | ----------------------------------------------------- |
| `cache-control: max-age=0`     | 일반 새로고침(F5). 강력 새로고침이면 `no-cache`       |
| `upgrade-insecure-requests: 1` | HTTPS로 올려도 좋다                                   |
| `sec-ch-ua-*`                  | Client Hints. `user-agent`를 대체하려는 구조화된 형태 |

`sec-ch-ua`의 `"Not;A=Brand";v="8"`은 **의도적인 가짜 항목**이다.
파서가 브랜드 목록을 제대로 다루게 강제하려고 넣었다.

---

> 지금 서버는 경로를 무시하므로 파비콘 요청에도 `<h1>hello</h1>`를 돌려준다.
> 브라우저는 이걸 이미지로 해석하려다 실패한다. → 경로별 처리가 필요하다.
