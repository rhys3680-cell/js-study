# 08. 개별 항목 다루기 - 경로 매칭과 이벤트 위임

**항목 하나**를 다루면 어떻게 해야할까?

```
GET   /api/todos 목록 전체
POST  /api/todos 새로 추가
PATCH /api/todos/3 3번만 수정
```

---

## 경로에서 id 뽑기

지금까지 라우팅은 정확히 일치하는지만 봤다.

```js
if (url.pathname === "/api/todos") { ... }
```

`/api/todos/3`은 이 조건에 안 걸린다. **패턴**이 필요하다.

```js
const match = url.pathname.match(/^\/api\/todos\/(\d+)$/);

if (match && req.method === "PATCH") {
  const id = Number(match[1]);
  ...
}
```

| 조각             | 뜻                            |
| ---------------- | ----------------------------- |
| `^` `$`          | 처음과 끝. 부분 일치를 막는다 |
| `\/api\/todos\/` | 문자 그대로                   |
| `(\d+)`          | 숫자 하나 이상.               |

`match`는 실패하면 `null`, 성공하면 배열이다.

```
'/api/todos/3'.match(...)
→ [ '/api/todos/3', '3', index: 0, ... ]
      전체 매치      괄호 부분
```

`match[1]`이 괄호에 잡힌 `'3'`. 문자열이므로 `Number()`로 바꾼다.

> **Express의 `/api/todos/:id`가 하는 일이 위와 같다.**
> `:id`를 이런 정규식으로 바꾸고, 잡힌 값을 `req.params.id`에 넣어준다.

### PATCH vs PUT

PATCH는 **일부만 수정**, PUT은 **통째로 교체**다.
`done`만 바꾸므로 PATCH를 사용.

---

## 이벤트 위임

클릭 리스너를 각 `<li>`에 달면 안 된다.

```js
// render()가 다시 그리면 사라진다
document.querySelectorAll(".item").forEach((li) => {
  li.addEventListener("click", ...);
});
```

`render()`는 `root.innerHTML`을 통째로 갈아끼운다.
`<li>`는 매번 **새로 만들어지는 다른 element**이므로 리스너가 남지 않는다.

대신 **바뀌지 않는 부모에 하나만 건다.**

```js
root.addEventListener("click", async (e) => {
  const item = e.target.closest(".item");
  if (!item) return;

  const id = Number(item.dataset.id);
  ...
});
```

- `root`는 `render()`가 안 건드린다. (안쪽만 바꾼다)
- `e.target`은 **실제로 클릭된 element** - `<span>`일 수도 `<li>`일 수도 있다.
- `closest(".item")`이 거기서 위로 올라가며 `.item`을 찾는다
- 목록 바깥을 누르면 `null`이므로 걸러진다.

`data-id` 속성은 `dataset.id`로 읽는다.

> **React의 `onClick`도 이러한 방식으로 동작한다.**

---

## todos와 todo - 글자 하나

토글을 눌렀더니 항목이 `undefined`가 되고, 다시 누르니 아래의 에러를 확인할 수 있었다.

```
Cannot read properties of undefined (reading 'done')
```

프론트엔드에서 API call을 할 때 받아오는 값이 잘못되었거나 처리 방식이 잘못되었을 때 발생하는 거라 예상할 수 있다.

`curl`로 서버를 직접 확인해보면

```bash
curl -i -X PATCH http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" -d "{\"done\":false}"
```

```json
[{"id":1, ...},{"id":2, ...},{"id":3, ...},]
```

**배열이 오는 걸 확인할 수 있다.**

```js
return sendJson(res, 200, todos); // 배열 전체를 서버에서 반환
return sendJson(res, 200, todo); // element 하나를 서버에서 반환
```

서버에서 다음과 같은 방식의 2가지로 넘어올 때 프론트엔드에서는 배열을 확인하여 리스트를 갱신하거나 원소 하나를 기준으로 새로운 배열을 만들어 render()를 시킬 수 있다.

PATCH일 경우에는 후자가 바람직하다.

```js
todos: state.todos.map((t) => (t.id === id ? updated : t));
```

여기서 updated가 배열로 넘어왔다.
1번 자리에 배열이 박혀서 `todo.text`도 `todo.done`도 없으니 `undefined` 에러가 났다.

---

## 남은 것

- DELETE (구조는 PATCH와 거의 같다)
- 에러를 `alert`로 띄우고 있다.
