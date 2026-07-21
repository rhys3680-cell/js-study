const root = document.querySelector("#app");

// --- 상태 ---
const state = {
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  todos: [],
  error: null,
};

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// --- 데이터 ---
async function fetchTodos(path = "/api/todos") {
  const res = await fetch(path);

  // fetch는 404·500에도 reject하지 않는다. 직접 확인해야 한다.
  if (!res.ok) {
    throw new Error(`요청 실패: ${res.status}`);
  }

  return res.json();
}

async function createTodo(text) {
  const res = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `요청 실패: ${res.status}`);
  }

  return res.json();
}

async function toggleTodo(id, done) {
  const res = await fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `요청 실패: ${res.status}`);
  }

  return res.json();
}

async function deleteTodo(id) {
  const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `요청 실패: ${res.status}`);
  }
}

// --- 렌더 ---
function render() {
  if (state.status === "loading") {
    root.innerHTML = `<p class="status">불러오는 중...</p>`;
    return;
  }

  if (state.status === "error") {
    root.innerHTML = `<p class="status status--error">${state.error}</p>`;
    return;
  }

  if (state.status === "success") {
    if (state.todos.length === 0) {
      root.innerHTML = `<p class="status">TODO가 없습니다.</p>`;
      return;
    }

    root.innerHTML = `
    <ul class="list">
      ${state.todos.map(todoHTML).join("")}
    </ul>
  `;
  }
}

function todoHTML(todo) {
  return `
    <li class="item ${todo.done ? "item--done" : ""}" data-id="${todo.id}">
      <span>${todo.done ? "✓" : "○"}</span>
      <span class="item-text">${todo.text}</span>
      <button class="item-delete" type="button">삭제</button>
    </li>
  `;
}

// --- 시작 ---
async function init() {
  setState({ status: "loading" });

  try {
    const todos = await fetchTodos();
    setState({ status: "success", todos });
  } catch (err) {
    setState({ status: "error", error: err.message });
  }
}

const form = document.querySelector("#add-form");
const input = document.querySelector("#add-input");

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // 페이지 새로고침 방지

  const text = input.value.trim();
  if (!text) return;

  try {
    await createTodo(text);
    input.value = "";
  } catch (err) {
    alert(err.message); // TODO: 동작 확인 후 개선
  }
});

root.addEventListener("click", async (e) => {
  const item = e.target.closest(".item");
  if (!item) return;

  const id = Number(item.dataset.id);

  try {
    // 삭제 버튼 클릭 확인
    if (e.target.closest(".item-delete")) {
      await deleteTodo(id);
      return;
    }

    // 아니면 토글
    const todo = state.todos.find((t) => t.id === id);
    await toggleTodo(id, !todo.done);
  } catch (err) {
    alert(err.message);
  }
});

function connectEvents() {
  const source = new EventSource("/api/events");

  source.addEventListener("todo-added", (e) => {
    const todo = JSON.parse(e.data);

    setState({ todos: [...state.todos, todo] });
  });

  source.addEventListener("todo-updated", (e) => {
    const todo = JSON.parse(e.data);
    setState({ todos: state.todos.map((t) => (t.id === todo.id ? todo : t)) });
  });

  source.addEventListener("todo-deleted", (e) => {
    const { id } = JSON.parse(e.data);
    setState({ todos: state.todos.filter((t) => t.id !== id) });
  });

  source.onerror = () => {
    console.log("SSE 연결 끊김. 브라우저가 자동으로 재연결한다.");
  };
}

init();
connectEvents();
