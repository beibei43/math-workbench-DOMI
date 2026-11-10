/* ============================================================================
 * sync.js —— 跨设备同步（GitHub 文件同步，无后端）
 * 思路：把整份应用数据序列化成仓库根目录的 sync.json。
 *   · 拉取：从公开 raw 地址读（无需 token），用于启动时合并/覆盖本地。
 *   · 推送：通过 GitHub Contents API 写入 sync.json（需要 Personal Access Token）。
 * 所有设备共用同一份 sync.json，因此手机/学习机/网页数据一致。
 * 冲突策略：按 updatedAt 取较新者（last-write-wins），适合单家庭单数据集使用。
 * 已知限制：错题/随手录题的「照片」存在各设备 IndexedDB，不与 JSON 一起同步
 *           （题目文字会同步，仅图片在其它设备可能缺失，显示占位）。
 * ========================================================================== */
window.SYNC = (function () {
  var DEFAULT_REPO = 'beibei43/math-workbench';
  var PATH = 'sync.json';
  var BRANCH = 'main';

  function cfg() {
    return {
      repo: localStorage.getItem('mxwb-repo') || DEFAULT_REPO,
      path: PATH,
      branch: BRANCH
    };
  }
  function setRepo(v) { (v && v.trim()) ? localStorage.setItem('mxwb-repo', v.trim()) : localStorage.removeItem('mxwb-repo'); }
  function getRepo() { return cfg().repo; }
  function getToken() { return localStorage.getItem('mxwb-gh-token') || ''; }
  function setToken(t) { t ? localStorage.setItem('mxwb-gh-token', t) : localStorage.removeItem('mxwb-gh-token'); }

  function lastSync() { var v = localStorage.getItem('mxwb-last-sync'); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function setLastSync(o) { localStorage.setItem('mxwb-last-sync', JSON.stringify(o)); }

  function rawUrl() { var c = cfg(); return 'https://raw.githubusercontent.com/' + c.repo + '/' + c.branch + '/' + c.path; }
  function apiUrl() { var c = cfg(); return 'https://api.github.com/repos/' + c.repo + '/contents/' + c.path + '?ref=' + c.branch; }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  // 拉取：公开 raw（无需 token）。返回 {exists, data, updatedAt, error}
  function pull() {
    return fetch(rawUrl() + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return { exists: false };
      if (!r.ok) return { exists: true, error: 'HTTP ' + r.status };
      return r.json().then(function (j) {
        return { exists: true, data: j.data, updatedAt: j.updatedAt || 0 };
      }).catch(function () { return { exists: true, error: 'JSON 解析失败' }; });
    }).catch(function (e) { return { exists: false, error: String(e) }; });
  }

  // 推送：需 token。payload = {updatedAt, data}
  function push(payload) {
    var token = getToken();
    if (!token) return Promise.resolve({ ok: false, reason: 'no-token' });
    var content = b64(JSON.stringify(payload));
    function doPut(sha) {
      var body = { message: 'sync: update MXWB data ' + new Date().toISOString().slice(0, 19), content: content, branch: BRANCH };
      if (sha) body.sha = sha;
      return fetch(apiUrl(), {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (res.ok) return { ok: true, status: res.status };
        if (res.status === 409) { // 并发冲突：重新取 sha 再试一次
          return fetch(apiUrl(), { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { return j ? doPut(j.sha) : { ok: false, status: 409 }; });
        }
        return res.text().then(function (t) { return { ok: false, status: res.status, detail: t.slice(0, 200) }; });
      });
    }
    // 先取当前 sha（文件不存在时 GitHub 会自动创建，可省略 sha）
    return fetch(apiUrl(), { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return doPut(j ? j.sha : null); })
      .catch(function (e) { return { ok: false, reason: String(e) }; });
  }

  // 把远程合并进本地：远程更新则覆盖本地，否则保留本地并准备回推
  // 返回 Promise<{applied:boolean, updatedAt:number}>
  function reconcile(localUpdatedAt, applyRemote) {
    return pull().then(function (remote) {
      if (!remote.exists) return { applied: false, updatedAt: localUpdatedAt, seeded: false };
      if (remote.error && !remote.data) return { applied: false, updatedAt: localUpdatedAt, error: remote.error };
      if (remote.updatedAt > localUpdatedAt) {
        if (applyRemote && remote.data) { applyRemote(remote.data); }
        setLastSync({ at: Date.now(), from: 'pull', updatedAt: remote.updatedAt });
        return { applied: true, updatedAt: remote.updatedAt };
      }
      return { applied: false, updatedAt: localUpdatedAt };
    });
  }

  return {
    DEFAULT_REPO: DEFAULT_REPO, PATH: PATH, BRANCH: BRANCH,
    cfg: cfg, setRepo: setRepo, getRepo: getRepo,
    getToken: getToken, setToken: setToken,
    lastSync: lastSync, setLastSync: setLastSync,
    rawUrl: rawUrl, apiUrl: apiUrl,
    pull: pull, push: push, reconcile: reconcile
  };
})();
