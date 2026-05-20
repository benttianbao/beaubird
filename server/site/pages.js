function pageShell(title, body, extraScript = "") {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; --bg:oklch(96.8% 0.006 190); --surface:oklch(99% 0.004 190); --sidebar:oklch(94.8% 0.008 190); --ink:oklch(24% 0.018 215); --muted:oklch(47% 0.018 215); --line:oklch(87% 0.01 205); --line-strong:oklch(76% 0.014 205); --brand:oklch(43% 0.075 178); --brand-strong:oklch(31% 0.062 178); --brand-soft:oklch(93.5% 0.028 178); --danger:oklch(45% 0.13 28); --radius:8px; --shadow-subtle:0 1px 2px rgba(24,36,38,.06); }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif; color:var(--ink); background:var(--bg); }
      .auth-shell { min-height:100vh; display:grid; place-items:center; padding:32px 16px; }
      .auth-card { width:min(420px, 100%); background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:28px; box-shadow:var(--shadow-subtle); }
      .admin-shell { width:min(1120px, calc(100vw - 32px)); margin:0 auto; padding:28px 0 40px; }
      h1 { margin:0 0 8px; font-size:1.45rem; line-height:1.18; letter-spacing:0; }
      h2 { margin:0 0 14px; font-size:1.05rem; line-height:1.25; }
      p { color:var(--muted); line-height:1.6; }
      label { display:block; margin:16px 0 6px; font-weight:700; font-size:.86rem; }
      input, select { width:100%; height:40px; border:1px solid var(--line); border-radius:6px; padding:0 11px; font:inherit; color:var(--ink); background:var(--surface); }
      input:focus, select:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px color-mix(in oklch, var(--brand) 18%, transparent); }
      button { min-height:38px; border:1px solid transparent; border-radius:6px; padding:0 13px; font:inherit; font-weight:700; color:var(--surface); background:var(--brand); cursor:pointer; box-shadow:var(--shadow-subtle); }
      button.secondary { color:var(--brand-strong); background:var(--brand-soft); border-color:color-mix(in oklch, var(--brand) 18%, var(--line)); box-shadow:none; }
      button.danger { background:oklch(96% 0.018 28); color:var(--danger); border-color:oklch(82% 0.052 28); box-shadow:none; }
      button:focus-visible { outline:none; box-shadow:0 0 0 3px color-mix(in oklch, var(--brand) 18%, transparent); }
      .topbar { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; padding-bottom:16px; border-bottom:1px solid var(--line); }
      .panel { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:18px; margin-bottom:14px; box-shadow:none; }
      .grid { display:grid; grid-template-columns:minmax(0, 1fr) 160px auto; gap:12px; align-items:end; }
      .admin-table-wrap { overflow:auto; border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); }
      table { width:100%; min-width:720px; border-collapse:collapse; background:var(--surface); }
      th, td { padding:11px 12px; border-bottom:1px solid var(--line); text-align:left; }
      th { font-size:13px; color:var(--muted); background:var(--sidebar); }
      tr:last-child td { border-bottom:0; }
      .actions { display:flex; gap:8px; flex-wrap:wrap; }
      .message { min-height:24px; margin-top:14px; color:var(--danger); }
      .secret { margin-top:14px; padding:12px; border:1px solid color-mix(in oklch, var(--brand) 24%, var(--line)); border-radius:6px; background:var(--brand-soft); color:var(--brand-strong); font-family:ui-monospace, SFMono-Regular, Consolas, monospace; overflow:auto; }
      @media (max-width: 720px) { .grid { grid-template-columns:1fr; } .topbar { align-items:flex-start; flex-direction:column; } }
    </style>
  </head>
  <body>${body}${extraScript}</body>
</html>`;
}

function loginPage() {
  return pageShell(
    "登录 BeauBird",
    `<main class="auth-shell">
      <form class="auth-card" id="loginForm">
        <h1>BeauBird 登录</h1>
        <p>请输入管理员分配的账号和密码。</p>
        <label for="username">用户名</label>
        <input id="username" name="username" autocomplete="username" required />
        <label for="password">密码</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">登录</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </main>`,
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
    `<main class="auth-shell">
      <form class="auth-card" id="changeForm">
        <h1>修改密码</h1>
        <p>首次登录或密码被重置后，需要先设置新密码。</p>
        <label for="newPassword">新密码</label>
        <input id="newPassword" type="password" autocomplete="new-password" required />
        <label for="confirmPassword">再次输入新密码</label>
        <input id="confirmPassword" type="password" autocomplete="new-password" required />
        <button type="submit">保存新密码</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </main>`,
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
    `<main class="admin-shell">
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
      <section class="panel admin-panel">
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
      <section class="panel admin-panel">
        <h2>用户列表</h2>
        <div class="admin-table-wrap">
          <table>
            <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>下次登录</th><th>操作</th></tr></thead>
            <tbody id="users"></tbody>
          </table>
        </div>
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
