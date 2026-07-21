# 07. 화면에서 추가하기 - fetch

---

## 폼의 기본 동작 막기

```js
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  ...
})
```

`preventDefault()`를 제외하고 제출했을 경우 페이지가 새로고침되고 URL에 `?`가 붙는다 (브라우저 기본 동작)

HTML 폼은 입력을 모아서 서버로 보내고 페이지를 새로 받는다.

JS로 처리하기 위해서(SPA)는 이 기본 동작을 막아야 한다.

`<form>`은 HTML 기본 태그이다. `action`(보낼 주소)과 `method`(방식)를 주면 제출 시 브라우저가 그 주소로 요청을 보내고 **응답 페이지로 이동**한다.

기본값은 `action`은 현재 URL, `method`는 GET
그래서 현재 페이지로 GET 제출이 일어나 새로고침된다.

URL에 `?`만 붙은 이유는 input에 `name` 속성이 없기 때문이다.
`name`이 있으면 `?name=값`으로 붙는다.

---

## GET과 POST의 fetch

```js
fetch("/api/todos"); // GET

fetch("/api/todos", {
  //POST
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text }),
});
```

- `Content-Type`을 안 보내면 서버가 본문을 뭘로 해석할지 모른다.

- `body`에는 문자열·Blob·FormData 같은 **바이트로 바꿀 수 있는 것**만 넣을 수 있다. 객체를 그냥 넣으면 `String({...})` = `"[object Object]"`가 전송된다.
- fetch가 알아서 JSON으로 바꿔주지 않는 이유는 JSON이라고 단정할 수 없어서다. **직렬화는 개발자가 하고, `Content-Type`으로 서버에 알린다.**

---

## fetch는 두 가지로 실패함

서버를 끄고 추가를 누르면 다음과 같은 메시지가 뜬다.

```
Failed to fetch
```

```js
async function createTodo(text) {
  const res = await fetch("/api/todos", { ... }); // ← 여기서 바로 예외

  if(!res.ok) { // ← 도달 못 함
    const data = await res.json();
    throw new Error(data.error ?? `요청 실패: ${res.status}`);
  }

  return res.json();
}
```

서버가 꺼져 있으면 **연결 자체가 안 되므로 `fetch`가 reject한다.**

| 상황                        | fetch                            | 잡히는 곳        |
| --------------------------- | -------------------------------- | ---------------- |
| 서버가 400·500 응답         | **resolve** (`res.ok === false`) | `if (!res.ok)`   |
| 서버가 꺼짐 / 네트워크 끊김 | **reject** (`TypeError`)         | `await fetch` 줄 |

**"통신이 됐는가"와 "결과가 성공인가"는 다른 층이다.**
400·500은 서버가 정상적으로 답한 것이므로 통신은 성공이다.
그래서 `res.ok` 검사가 따로 필요하다.

```js
let res;
try {
  res = await fetch("/api/todos", { ... });
} catch {
  throw new Error("서버에 연결할 수 없습니다");
}
```

---

## 서버 응답을 그대로 쓰는 문제

```js
const todo = await createTodo(text);
setState({ todos: [...state.todos, todo] });
```

201로 받은 객체(서버가 정한 `id` 포함)를 배열에 붙인다. 요청 한 번으로 끝난다.

하지만 단점도 있다.

```js
await createTodo(text);
const todos = await fetchTodos();
setState({ todos });
```

|                       | 응답을 그대로 | 다시 GET |
| --------------------- | ------------- | -------- |
| 요청 수               | 1             | 2        |
| 다른 사람이 추가한 것 | 안 보임       | 보임     |

여러 명이 동시에 쓰면 서로 안 맞기 시작한다.
→ 실시간 반영이 필요해지면 SSE / WebSocket을 사용해야 한다.

---

## 상태는 setState를 거친다.

```js
state.todos.push(todo); // render가 안 됨
setState({ todos: [...state.todos, todo] });
```

`setState`가 `render()`를 부르므로, 이걸 사용해야 화면이 바뀐다.

---

## 남은 것

- 에러를 `alert`로 띄우고 있다.
- 완료 토글·삭제가 필요하다. (PATCH/ DELETE)
