function pageShell(title, body, extraScript = "") {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; --ink:#17211b; --muted:#5f6f67; --line:#d9e4de; --brand:#1f7a5a; --bg:#f6faf8; --danger:#b3261e; }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
      main { width:min(1080px, calc(100vw - 32px)); margin:0 auto; padding:48px 0; }
      .auth { width:min(420px, calc(100vw - 32px)); margin:8vh auto; background:#fff; border:1px solid var(--line); border-radius:8px; padding:28px; box-shadow:0 18px 48px rgba(20,50,36,.08); }
      h1 { margin:0 0 8px; font-size:28px; letter-spacing:0; }
      h2 { margin:0 0 16px; font-size:22px; }
      p { color:var(--muted); line-height:1.6; }
      label { display:block; margin:16px 0 6px; font-weight:650; }
      input, select { width:100%; height:42px; border:1px solid var(--line); border-radius:6px; padding:0 12px; font:inherit; background:#fff; }
      button { min-height:40px; border:0; border-radius:6px; padding:0 14px; font:inherit; font-weight:700; color:#fff; background:var(--brand); cursor:pointer; }
      button.secondary { color:var(--brand); background:#e6f3ed; }
      button.danger { background:var(--danger); }
      .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; }
      .panel { background:#fff; border:1px solid var(--line); border-radius:8px; padding:20px; margin-bottom:18px; }
      .grid { display:grid; grid-template-columns:1fr 160px auto; gap:12px; align-items:end; }
      table { width:100%; border-collapse:collapse; background:#fff; }
      th, td { padding:12px; border-bottom:1px solid var(--line); text-align:left; }
      th { font-size:13px; color:var(--muted); }
      .actions { display:flex; gap:8px; flex-wrap:wrap; }
      .message { min-height:24px; margin-top:14px; color:var(--danger); }
      .secret { margin-top:14px; padding:12px; border:1px solid #b8dccd; border-radius:6px; background:#edf8f3; color:#184b38; font-family:ui-monospace, SFMono-Regular, Consolas, monospace; overflow:auto; }
      @media (max-width: 720px) { .grid { grid-template-columns:1fr; } .topbar { align-items:flex-start; flex-direction:column; } }
    </style>
  </head>
  <body>${body}${extraScript}</body>
</html>`;
}

function loginPage() {
  return pageShell(
    "登录 BeauBird",
    `<form class="auth" id="loginForm">
      <h1>BeauBird 登录</h1>
      <p>请输入管理员分配的账号和密码。</p>
      <label for="username">用户名</label>
      <input id="username" name="username" autocomplete="username" required />
      <label for="password">密码</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">登录</button>
      <p class="message" id="message" role="status"></p>
    </form>`,
    `<script>
      document.querySelector("#loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.querySelector("#message");
        message.textContent = "";
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: document.querySelector("#username").value,
            password: document.querySelector("#password").value
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          message.textContent = data.error || "登录失败。";
          return;
        }
        sessionStorage.setItem("bb_csrf", data.csrfToken || "");
        window.location.href = data.mustChangePassword ? "/change-password" : "/";
      });
    </script>`
  );
}

function changePasswordPage() {
  return pageShell(
    "修改密码",
    `<form class="auth" id="changeForm">
      <h1>修改密码</h1>
      <p>首次登录或密码被重置后，需要先设置新密码。</p>
      <label for="newPassword">新密码</label>
      <input id="newPassword" type="password" autocomplete="new-password" required />
      <label for="confirmPassword">再次输入新密码</label>
      <input id="confirmPassword" type="password" autocomplete="new-password" required />
      <button type="submit">保存新密码</button>
      <p class="message" id="message" role="status"></p>
    </form>`,
    `<script>
      document.querySelector("#changeForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": sessionStorage.getItem("bb_csrf") || "" },
          body: JSON.stringify({
            newPassword: document.querySelector("#newPassword").value,
            confirmPassword: document.querySelector("#confirmPassword").value
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          document.querySelector("#message").textContent = data.error || "修改失败。";
          return;
        }
        window.location.href = "/";
      });
    </script>`
  );
}

function adminPage(csrfToken = "") {
  return pageShell(
    "BeauBird 后台",
    `<main>
      <div class="topbar">
        <div>
          <h1>BeauBird 后台</h1>
          <p>手动添加账号、重置临时密码、启用或禁用用户。</p>
        </div>
        <div class="actions">
          <button class="secondary" id="frontBtn" type="button">返回前台</button>
          <button class="secondary" id="logoutBtn" type="button">退出</button>
        </div>
      </div>
      <section class="panel">
        <h2>新增用户</h2>
        <form class="grid" id="createForm">
          <div>
            <label for="username">用户名</label>
            <input id="username" required placeholder="3-32 位字母或数字" />
          </div>
          <div>
            <label for="role">角色</label>
            <select id="role">
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <button type="submit">添加</button>
        </form>
        <div id="secret" class="secret" hidden></div>
        <p id="message" class="message"></p>
      </section>
      <section class="panel">
        <h2>用户列表</h2>
        <table>
          <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>下次登录</th><th>操作</th></tr></thead>
          <tbody id="users"></tbody>
        </table>
      </section>
    </main>`,
    `<script>
      sessionStorage.setItem("bb_csrf", ${JSON.stringify(csrfToken)});
      function csrf() { return sessionStorage.getItem("bb_csrf") || ""; }
      async function api(path, options = {}) {
        const response = await fetch(path, {
          ...options,
          headers: { "content-type": "application/json", "x-csrf-token": csrf(), ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "请求失败。");
        return data;
      }
      async function loadUsers() {
        const data = await api("/api/admin/users");
        document.querySelector("#users").innerHTML = data.users.map((user) => \`
          <tr>
            <td>\${user.id}</td>
            <td>\${user.username}</td>
            <td>\${user.role === "admin" ? "管理员" : "普通用户"}</td>
            <td>\${user.disabled ? "已禁用" : "启用中"}</td>
            <td>\${user.mustChangePassword ? "强制改密码" : "正常"}</td>
            <td class="actions">
              <button class="secondary" data-action="reset" data-id="\${user.id}">重置密码</button>
              <button class="\${user.disabled ? "secondary" : "danger"}" data-action="\${user.disabled ? "enable" : "disable"}" data-id="\${user.id}">
                \${user.disabled ? "启用" : "禁用"}
              </button>
            </td>
          </tr>\`).join("");
      }
      document.querySelector("#createForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const data = await api("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({ username: document.querySelector("#username").value, role: document.querySelector("#role").value })
          });
          document.querySelector("#secret").hidden = false;
          document.querySelector("#secret").textContent = \`临时密码只显示一次：\${data.temporaryPassword}\`;
          event.target.reset();
          await loadUsers();
        } catch (error) {
          document.querySelector("#message").textContent = error.message;
        }
      });
      document.querySelector("#users").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        try {
          const data = await api(\`/api/admin/users/\${button.dataset.id}/\${button.dataset.action === "reset" ? "reset-password" : button.dataset.action}\`, { method: "POST" });
          if (data.temporaryPassword) {
            document.querySelector("#secret").hidden = false;
            document.querySelector("#secret").textContent = \`临时密码只显示一次：\${data.temporaryPassword}\`;
          }
          await loadUsers();
        } catch (error) {
          document.querySelector("#message").textContent = error.message;
        }
      });
      document.querySelector("#frontBtn").addEventListener("click", () => { window.location.href = "/"; });
      document.querySelector("#logoutBtn").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; });
      loadUsers().catch((error) => { document.querySelector("#message").textContent = error.message; });
    </script>`
  );
}

module.exports = {
  adminPage,
  changePasswordPage,
  loginPage
};
