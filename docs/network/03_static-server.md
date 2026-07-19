# 03. 정적 파일 서버 - 서버는 무엇을 하는가

## 서버가 실제로 하는 일

`file://`로 열면 브라우저는 파일시스템에서 직접 읽는다. HTTP를 안 거친다.
그래서 2가지가 없다.

**1. origin이 없다**

`file://`의 origin 은 `null`이다. `null`끼리는 서로 다른 출처로 취급된다.
ES module은 CORS 규칙을 따르도록 명세에 적혀 있으므로, 전부 차단된다.

서버를 켜는 순간 `http://localhost:3000`이라는 **출처가 발급된다.**
`index.html`과 `app.js`가 같은 출처가 되고, import가 통과한다.

> 서버가 한 일의 본질은 파일을 준 게 아니라 **주소를 만든 것**이다.
> origin이 있어야 성립하는 것들이 그 위에 딸려온다 - module, 쿠키, CORS 정책, localStorage.

**2. Content-Type이 없다**

`file://`은 파일 내용은 주지만 **"이게 뭔지"를 못 알려준다.**
브라우저는 확장자로 추측할 뿐이다. module 로드는 MIME 타입을 엄격히 검사한다.

우리 서버는 확장자를 보고 헤더를 붙인다.

```
Content-Type: text/javascript; charset=utf-8
```

**서버가 붙이는 건 파일이 아니라 해석 지침이다.**

---

## 그래서 서버의 역할은 셋

|      | 하는 일                              |
| ---- | ------------------------------------ |
| 주소 | origin을 발급한다                    |
| 해석 | 바이트를 메서드·경로·헤더로 파싱한다 |
| 응답 | 내용에 메타데이터를 붙여 돌려준다    |

---

## 구현

```js
const url = new URL(req.url, `http://${req.headers.host}`);
const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
const filePath = path.join(PUBLIC_DIR, pathname);

const content = await fs.readFile(filePath);
res.writeHead(200, {
  "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream",
  "Content-Length": content.length,
});
res.end(content);
```

**`url.pathname`을 쓰는 이유** - `req.url`을 그대로 쓰면 `/style.css?v=2`에서 `?v=2`까지 파일명으로 취급한다. 확인:

```bash
curl -i "http://localhost:3000/style.css?v=2"  # → 200
```

**`content.length`** - `readFile`이 Buffer를 반환하므로 그대로 바이트 수다.
문자열이었으면 `Buffer.byteLength`가 필요했다.

---

## npx serve 대신 써도 될까?

**로컬 개발용으로는 된다.** 파일 서빙은 정상 동작한다.

없는 것:

- 디렉토리 인덱스 (`/docs/` → 목록)
- SPA 폴백 (`/about` → `index.html`)
- 캐시 헤더
- 압축

```
accept-encoding: gzip, deflate, br, zstd
```

## 로컬 서버와 배포된 서버의 차이

지금 만든 것으로 실제 서비스를 못 하는 이유.

|           | 우리 것                 | 실제                        |
| --------- | ----------------------- | --------------------------- |
| 접근      | localhost만             | 공인 IP + 도메인 (DNS)      |
| 프로토콜  | HTTP                    | HTTPS — 인증서 필요         |
| 동시성    | 프로세스 1개            | 여러 인스턴스 + 로드밸런서  |
| 장애      | 죽으면 끝               | 프로세스 매니저가 재시작    |
| 정적 파일 | 매 요청마다 디스크 읽기 | CDN이 대신                  |
| 압축·캐시 | 없음                    | 리버스 프록시(nginx)가 처리 |
| 로그      | `console.log`           | 구조화된 로그 + 수집        |

**실제 배포에서 Node 서버가 정적 파일을 직접 주는 경우는 드물다.**
nginx나 CDN이 앞에 서고, Node는 API만 담당하는 구조가 흔하다.
지금 우리가 만든 건 그 앞단이 없는 상태다.

---

## 남은 문제

```js
} catch (err) {
  res.writeHead(404, ...);
}
```

**모든 실패를 404로 뭉갰다.** 파일이 없는 것(`ENOENT`)과
권한이 없는 것(`EACCES`)은 다르다. 디렉터리를 요청한 경우(`EISDIR`)도 마찬가지다.

→ 04에서 에러 처리를 정리한다.
