# 06. POST - 요청 본문 읽기

GET은 경로만 보면 된다. POST는 **본문을 읽어야 한다.**

---

## req는 스트림이다.

`req.method`, `req.url`, `req.headers`는 이미 파싱된 값이다.
하지만 **본문은 나중에 온다.**

```
GET / HTTP/1.1          ┐
Host: localhost:3000    │ 여기까지 파싱해서 req.method/url/headers
                        ┘
{"text":"..."}          ← 이건 스트림으로 흘러온다
```

헤더는 다 모여야 요청이 시작되지만, 본문은 그 뒤로 chunk 단위로 도착한다.

---

## body 모으기

```js
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}
```

`for await`가 되는 건 `req`가 async iterable이라서다.

### Buffer.concat을 쓰는 이유

`chunk`는 문자열이 아니라 **Buffer(바이트 배열)**이다.
`toString()`은 그 바이트를 UTF-8로 해석하는 것이다.
조각마다 `toString()`하면 안 된다.

```js
for await (const chunk of req) {
  body += chunk.toString();
}
```

UTF-8에서 한글 한 글자는 3바이트인데, chunk 경계가 그 중간을 자를 수 있다.

```
"안녕" = [EC 95 88][EB 85 95]

chunk1 = [EC 95 88 EB]   → '안' + 깨진 바이트 → "안�"
chunk2 = [85 95]         → 해석 불가 → "��"
```

**Buffer로 모은 뒤 한 번에 변환**하면 경계가 사라진다.

---

## 검증

```js
let data;
try {
  data = JSON.parse(body);
} catch {
  return sendJson(res, 400, { error: "잘못된 JSON입니다." });
}

if (typeof data.text !== "string" || data.text.trim() === "") {
  return sendJson(res, 400, { error: "text가 필요합니다." });
}
```

`JSON.parse`는 잘못된 입력에 예외를 던진다. 감싸지 않으면 최상위 catch로 가서 **500**이 된다.

---

## async 전염

`readBody`가 async가 되면서 `handleApi`도 async가 된다.

```js
async function handleApi(req, res, url) {
  ...
  const body = await readBody(req);
}
```

이렇게 되면 **호출부에도 await를 붙여야 한다.**

```js
if (url.pathname.startsWith("/api/")) {
  await handleApi(req, res, url);
} else {
  await handleStatic(req, res, url);
}
```

`await`가 없으면 `handleApi`는 Promise를 반환하고 즉시 끝나고, 그 안의 에러는 최상위 catch에 닿지 못한다. → `unhandledRejection`.

**async는 호출 사슬을 타고 위로 전염된다.**
하나가 async가 되면 그걸 부르는 것도 async여야 한다.

---

## 남은 문제

서버를 껐다 키면 추가한 항목이 사라진다.

```js
let todos = [...]; // 메모리
```
