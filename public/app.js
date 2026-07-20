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
      <span>${todo.text}</span>
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

init();
