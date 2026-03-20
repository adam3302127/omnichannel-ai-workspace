/**
 * Shared admin layout and styles
 */

export const ADMIN_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; line-height: 1.5; }
  a { color: #38bdf8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  header { padding: 12px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  header h1 { font-size: 18px; margin: 0; font-weight: 600; }
  nav { display: flex; gap: 8px; align-items: center; }
  nav a { padding: 6px 12px; border-radius: 6px; font-size: 14px; }
  nav a:hover { background: #1e293b; text-decoration: none; }
  nav a.active { background: #334155; color: #fff; }
  main { padding: 20px; max-width: 1200px; margin: 0 auto; }
  .card { background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 12px; color: #94a3b8; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #334155; text-align: left; }
  th { color: #94a3b8; font-weight: 500; }
  tr:hover { background: rgba(255,255,255,0.02); }
  .btn { display: inline-block; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; font-family: inherit; }
  .btn-primary { background: #3b82f6; color: #fff; }
  .btn-primary:hover { background: #2563eb; }
  .btn-ghost { background: transparent; color: #94a3b8; }
  .btn-ghost:hover { background: #334155; color: #fff; }
  .btn-danger { background: #dc2626; color: #fff; }
  .btn-danger:hover { background: #b91c1c; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  input, textarea, select { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; color: #e2e8f0; font-size: 14px; font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: #3b82f6; }
  textarea { min-height: 80px; resize: vertical; }
  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 4px; }
  .form-group { margin-bottom: 12px; }
  .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .form-row .form-group { flex: 1; min-width: 180px; }
  .tenant-select { font-size: 13px; padding: 6px 10px; }
  .muted { color: #64748b; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #334155; color: #94a3b8; }
  .empty-state { padding: 32px; text-align: center; color: #64748b; }
`;

export function adminNav(active: "dashboard" | "chats" | "knowledge" | "content") {
  return `
    <nav>
      <a href="/admin" class="${active === "dashboard" ? "active" : ""}">Dashboard</a>
      <a href="/admin/chats" class="${active === "chats" ? "active" : ""}">Chats</a>
      <a href="/admin/knowledge" class="${active === "knowledge" ? "active" : ""}">Knowledge</a>
      <a href="/admin/content" class="${active === "content" ? "active" : ""}">Content</a>
    </nav>
  `;
}

export function tenantSelector(tenants: { id: string; name: string; slug: string }[], currentSlug: string, basePath: string) {
  const options = tenants.map((t) =>
    `<option value="${t.slug}" ${t.slug === currentSlug ? "selected" : ""}>${t.name} (${t.slug})</option>`
  ).join("");
  return `
    <select class="tenant-select" onchange="location.href='${basePath}?tenantSlug='+this.value">
      ${options}
    </select>
  `;
}

/** Script to persist admin token from URL and use in fetch (for production) */
export const ADMIN_FETCH_SCRIPT = `
  (function(){
    var m = /[?&]token=([^&]+)/.exec(location.search);
    if (m) { try { sessionStorage.setItem('adminToken', m[1]); history.replaceState(null,'',location.pathname+location.search.replace(/[?&]token=[^&]+/,'').replace(/^&/,'?')); } catch(e){} }
    window.adminFetch = function(url, opts) {
      opts = opts || {};
      opts.headers = opts.headers || {};
      var t = sessionStorage.getItem('adminToken');
      if (t) opts.headers['x-admin-token'] = t;
      return fetch(url, opts);
    };
  })();
`;
