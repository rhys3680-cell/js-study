const res = await fetch("/api/todos");
const todos = await res.json();

document.querySelector("#msg").textContent = todos
  .map((t) => `${t.done ? "done" : "todo"} ${t.text}`)
  .join(" / ");
