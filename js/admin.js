// Adminläget i galleriet: byt namn på eller radera gubbar och gruppbilder.
// Inloggningen kontrolleras på servern (admin-server.js). Spelet sparar bara den tillfälliga
// inloggningsnyckeln i fliken (sessionStorage), aldrig lösenordet.

const ADMIN = { token: (() => { try { return sessionStorage.getItem("party-admin") || ""; } catch (e) { return ""; } })() };
const isAdminMode = () => !!ADMIN.token;
function setAdmin(token) {
  ADMIN.token = token || "";
  try { token ? sessionStorage.setItem("party-admin", token) : sessionStorage.removeItem("party-admin"); } catch (e) {}
  renderAdminState();
}
async function adminApi(method, url, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN.token }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  if (r.status === 401 && url !== "/api/admin/login") { setAdmin(""); if (currentScreen === "s-gallery") renderGallery(); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "fel"), { status: r.status });
  return data;
}
function renderAdminState() {
  $("adminState").textContent = isAdminMode() ? t("adminOn") : "";
  $("adminLink").textContent = t(isAdminMode() ? "adminLogout" : "adminLogin");
}
$("adminLink").onclick = async () => {
  if (isAdminMode()) {
    adminApi("POST", "/api/admin/logout").catch(() => {});
    setAdmin(""); renderGallery(); return;
  }
  $("adminErr").textContent = ""; $("adminPass").value = "";
  show("s-admin"); $("adminUser").focus();
};
$("adminForm").onsubmit = async e => {
  e.preventDefault();
  $("adminGo").disabled = true; $("adminErr").textContent = "";
  try {
    const { token } = await adminApi("POST", "/api/admin/login", { user: $("adminUser").value, pass: $("adminPass").value });
    $("adminPass").value = "";
    setAdmin(token);
    history.back();   // tillbaka till galleriet
  } catch (err) {
    $("adminErr").textContent = err.status === 429 ? t("adminTooMany") : err.status === 401 ? t("adminWrong") : t("onlineFail");
  }
  $("adminGo").disabled = false;
};
// Knapparna under varje kort i galleriet när man är admin
function adminTools(r) {
  const box = document.createElement("div"); box.className = "admin-tools";
  const ren = document.createElement("button"); ren.className = "chip small"; ren.textContent = t("adminRename");
  const del = document.createElement("button"); del.className = "chip small danger"; del.textContent = t("adminDelete");
  ren.onclick = async () => {
    const name = prompt(t("adminNewName"), r.name || ""); if (!name || !name.trim()) return;
    try { await adminApi("PATCH", "/api/admin/gallery/" + apiId(r.id), { name: name.trim() }); r.name = name.trim(); renderGallery(); }
    catch (e) { alert(t("onlineFail")); }
  };
  del.onclick = async () => {
    if (!confirm(t("adminDeleteConfirm", { name: r.name || t("nameless") }))) return;
    try {
      await adminApi("DELETE", "/api/admin/gallery/" + apiId(r.id));
      gallery = gallery.filter(x => x.id !== r.id); renderGallery();
    } catch (e) { alert(t("onlineFail")); }
  };
  box.append(ren, del);
  return box;
}
// Kolla att inloggningen fortfarande gäller (servern kan ha startat om)
if (ADMIN.token) adminApi("GET", "/api/admin/check").catch(() => {});
renderAdminState();
