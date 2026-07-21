# 09. DELETE

## 본문을 읽지 않는다

```js
if (match && req.method === "DELETE") {
  const id = Number(match[1]);
  const index = todos.findIndex((t) => t.id === id);

  if (index === -1) {
    return sendJson(res, 404, { error: "없는 항목입니다." });
  }

  todos.splice(index, 1);

  res.writeHead(204);
  res.end();
}
```

삭제에는 **URL의 id**만 있으면 된다.

---

## 204 No Content

반환할 것이 없을 때 쓰는 상태 코드

```js
res.writeHead(204);
res.end();
```

실제 응답

```
HTTP/1.1 204 No Content          ← 헤더만
Connection: keep-alive

HTTP/1.1 404 Not Found           ← 본문이 있는 경우
Content-Type: application/json
Content-Length: 35

{"error":"없는 항목입니다."}
```

### 프론트에서 res.json()을 부르면 안 된다

```js
async function deleteTodo(id) {
  const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `요청 실패: ${res.status}`);
  }

  // 204는 본문이 없다. res.json()을 부르면 파싱에 실패한다.
}
```

---

## 위임에 분기가 생겼다

08에서 `root`에 리스너 하나만 걸었다. 그런데 삭제 버튼이 `.item` 안에 있다.

```html
<li class="item" data-id="3">
  <span>○</span>
  <span class="item-text">할 일</span>
  <button class="item-delete">삭제</button> ← 이것도 .item 안이다
</li>
```

그대로 두면 **삭제를 눌러도 토글까지 실행된다.**
`closest(".item")`이 버튼의 부모인 `<li>`를 찾아내기 때문이다.

버튼을 먼저 확인해야 한다.

```js
root.addEventListener("click", async (e) => {
  const item = e.target.closest(".item");
  if (!item) return;

  const id = Number(item.dataset.id);

  try {
    if (e.target.closest(".item-delete")) {
      // ← 버튼이 먼저
      await deleteTodo(id);
      setState({ todos: state.todos.filter((t) => t.id !== id) });
      return;
    }

    // 아니면 토글
    const todo = state.todos.find((t) => t.id === id);
    const updated = await toggleTodo(id, !todo.done);
    setState({ todos: state.todos.map((t) => (t.id === id ? updated : t)) });
  } catch (err) {
    alert(err.message);
  }
});
```

위임을 하게 되면 리스너는 하나로 유지되지만 "무엇이 클릭됐는지"는 코드로 판별해야 한다.

개별 element에 리스너를 추가했다면 각자 처리했을 것이지만 `render()`가 다시 그릴 때마다 리스너가 사라진다.

## 남은 것

- 서버를 껐다 켜면 다 사라진다 (메모리 저장)
- 탭을 두 개 열면 서로의 변경이 안 보인다 → SSE / WebSocket
