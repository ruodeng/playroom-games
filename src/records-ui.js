import { DEFAULT_RECORD_BOARD_ID, getRecordBoardById } from './record-catalog.js';
import { getRecordSession, recordsRequest } from './record-client.js';
import { formatRecordValue, recordBoardLabel, recordBoardRule, recordsPath, renderRecordRows, renderRecordsView } from './records-view.js';
import { navigate } from './site-navigation.js';

const el = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };

export function createRecordsController() {
  let active = false, identity = null, requestId = 0, pendingResult = null;
  let selected = null;
  let root = document.querySelector('#records-view');
  if (!root) {
    const template = document.createElement('template');
    template.innerHTML = renderRecordsView();
    root = template.content.firstElementChild;
    root.hidden = true;
    document.querySelector('#library-view').before(root);
  }
  const select = root.querySelector('#records-game');
  const rows = root.querySelector('.records-rows');
  const status = root.querySelector('.records-status');
  const own = root.querySelector('.records-own');
  const boardLinks = root.querySelectorAll('.records-index a');

  let nav = document.querySelector('#nav-records');
  if (!nav) {
    nav = el('a', 'nav-link'); nav.id = 'nav-records'; nav.href = recordsPath(); nav.title = '片刻纪录榜';
    nav.innerHTML = '<span class="arcade-nav-icon" aria-hidden="true">♜</span><span>片刻纪录榜</span><span class="active-dot"></span>';
    document.querySelector('#nav-library').after(nav);
  }
  let account = document.querySelector('.record-account-button');
  if (!account) {
    account = el('button', 'button button-quiet record-account-button', '登录 / 注册');
    document.querySelector('.topbar-message').replaceWith(account);
  }
  if (!document.querySelector('.records-library-entry')) {
    const libraryEntry = el('a', 'records-library-entry'); libraryEntry.href = recordsPath();
    libraryEntry.innerHTML = '<span aria-hidden="true">✦</span><div><strong>挑战片刻纪录榜</strong><small>进入本站前 10，为你的纪录留下名字。</small></div><span aria-hidden="true">↗</span>';
    document.querySelector('.library-toolbar').before(libraryEntry);
  }

  function updateIdentity(value) {
    identity = value;
    const name = value.user?.nickname || value.nickname || '游客挑战者';
    root.querySelector('.records-identity strong').textContent = name;
    account.textContent = value.user ? name : '登录 / 注册';
    root.querySelector('.records-account').textContent = value.user ? '我的账号' : '登录 / 注册';
  }
  root.querySelector('.records-identity strong').textContent = '正在连接…';
  getRecordSession().then(updateIdentity).catch(() => { root.querySelector('.records-identity strong').textContent = '暂时离线'; });
  document.addEventListener('playroom:identity', event => { updateIdentity(event.detail); if (active) load(); });

  function modal(title, copy) {
    document.dispatchEvent(new Event('playroom:pause-for-record'));
    const dialog = el('dialog', 'dialog record-dialog');
    const close = el('button', 'icon-button record-dialog-close', '×'); close.setAttribute('aria-label', '关闭'); close.onclick = () => dialog.close();
    const heading = el('h2', '', title); heading.id = 'record-dialog-title'; dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(close, el('p', 'eyebrow', 'YOUR LITTLE MOMENT'), heading, el('p', 'dialog-description', copy));
    const error = el('p', 'record-form-message'); error.setAttribute('role', 'status');
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    return { dialog, error };
  }
  function input(form, label, name, options = {}) {
    const wrapper = el('label', 'record-field', label); const field = el('input');
    field.name = name; field.required = true; Object.assign(field, options); wrapper.append(field); form.append(wrapper); return field;
  }
  function nicknameDialog(result) {
    if (document.querySelector('dialog[open]')) return;
    const { dialog, error } = modal(result ? `第 ${result.rank} 名，留下你的名字。` : '给自己一个玩家名。', result ? '恭喜进入本站前 10！保存昵称后，大家就能在榜上认出你。' : '昵称会显示在你的纪录旁。注册账号后，也能在其他设备找回身份。');
    const form = el('form', 'record-form');
    const field = input(form, '榜上昵称', 'nickname', { maxLength: 32, autocomplete: 'nickname', placeholder: '例如：慢慢来', value: identity?.user?.nickname || identity?.nickname || '' });
    const save = el('button', 'button button-primary', '保存我的名字'); save.type = 'submit';
    const signup = el('button', 'button button-secondary', identity?.user ? '我的账号' : '顺便注册账号'); signup.type = 'button'; signup.onclick = () => { dialog.close(); accountDialog('register', field.value.trim()); };
    form.append(error, save, signup);
    form.addEventListener('submit', async event => {
      event.preventDefault(); save.disabled = true; error.textContent = '正在保存…';
      try { await recordsRequest('/nickname', { nickname: field.value.trim() }); dialog.close(); }
      catch (failure) { error.textContent = failure.message; } finally { save.disabled = false; }
    });
    dialog.append(form); dialog.showModal();
  }
  function accountDialog(mode = 'login', proposedName = '') {
    if (document.querySelector('dialog[open]')) return;
    const signedIn = Boolean(identity?.user);
    const registering = mode === 'register';
    const { dialog, error } = modal(signedIn ? '你的玩家名片' : registering ? '把这个名字，留下来。' : '欢迎回来，继续挑战。', signedIn ? `账号：${identity.user.username}` : '无需邮箱。使用账号和密码，保存你的玩家身份与最佳纪录。');
    const form = el('form', 'record-form');
    if (signedIn) {
      form.append(el('strong', 'record-profile-name', identity.user.nickname));
      const rename = el('button', 'button button-primary', '修改榜上昵称'); rename.type = 'button'; rename.onclick = () => { dialog.close(); nicknameDialog(); };
      const logout = el('button', 'button button-secondary', '退出登录'); logout.type = 'button'; logout.onclick = async () => { logout.disabled = true; try { await recordsRequest('/logout', {}); dialog.close(); } catch (failure) { error.textContent = failure.message; logout.disabled = false; } };
      form.append(rename, logout, el('p', 'field-hint', '退出后，进行中的这一局仍可玩，但不能上传纪录。下一局可用游客身份参赛。'), error);
    } else {
      const username = input(form, '账号', 'username', { autocomplete: 'username', minLength: 3, maxLength: 24, pattern: '[A-Za-z0-9][A-Za-z0-9_-]{2,23}', placeholder: '3–24 位，以字母或数字开头' });
      let nickname;
      if (registering) nickname = input(form, '榜上昵称', 'nickname', { autocomplete: 'nickname', maxLength: 32, placeholder: '1–16 个字符', value: proposedName || identity?.nickname || '' });
      const password = input(form, '密码', 'password', { type: 'password', autocomplete: registering ? 'new-password' : 'current-password', minLength: 10, maxLength: 128, placeholder: '10–128 个字符' });
      const submit = el('button', 'button button-primary', registering ? '注册并保存身份' : '登录'); submit.type = 'submit';
      const toggle = el('button', 'text-button', registering ? '已有账号？去登录' : '第一次来？注册一个账号'); toggle.type = 'button'; toggle.onclick = () => { dialog.close(); accountDialog(registering ? 'login' : 'register'); };
      form.append(error, submit, toggle);
      form.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true; error.textContent = '正在处理…';
        try { await recordsRequest(registering ? '/register' : '/login', { username: username.value.trim(), password: password.value, ...(registering ? { nickname: nickname.value.trim() } : {}) }); password.value = ''; dialog.close(); }
        catch (failure) { error.textContent = failure.message; } finally { submit.disabled = false; }
      });
    }
    dialog.append(form); dialog.showModal();
  }
  account.onclick = () => accountDialog(); root.querySelector('.records-account').onclick = () => accountDialog();
  root.querySelector('.records-profile').onclick = () => identity?.user ? accountDialog() : nicknameDialog();
  for (const control of [select, account, ...root.querySelectorAll('button[disabled]')]) control.disabled = false;
  function showPendingResult() {
    if (pendingResult && !pendingResult.isCurrent()) pendingResult = null;
    if (pendingResult && !pendingResult.root.hidden && !document.querySelector('dialog[open]')) {
      const result = pendingResult; pendingResult = null; nicknameDialog(result);
    }
  }
  document.addEventListener('close', () => queueMicrotask(showPendingResult), true);
  document.addEventListener('playroom:record-result', event => {
    const result = event.detail;
    if (result.improved && result.rank >= 1 && result.rank <= 10 && result.isCurrent()) { pendingResult = result; showPendingResult(); }
    if (active) load();
  });

  async function load() {
    const version = ++requestId; const board = selected;
    const preservePublicRows = root.hasAttribute('data-records-ready') && root.dataset.boardId === board.id;
    if (!preservePublicRows) {
      root.removeAttribute('data-records-ready');
      rows.replaceChildren(el('p', 'records-empty', '正在读取本站纪录…'));
    }
    root.dataset.boardId = board.id;
    own.hidden = true;
    status.hidden = true;
    try {
      const data = await recordsRequest(`/board?game=${encodeURIComponent(board.id)}`);
      if (version !== requestId) return;
      rows.innerHTML = renderRecordRows(board, data.entries);
      root.removeAttribute('data-records-ready');
      if (data.myBest) {
        own.textContent = `你的最佳纪录：${formatRecordValue(board, data.myBest.value)} · 本站第 ${data.myBest.rank} 名`;
        own.hidden = false;
      }
    } catch (failure) {
      if (version !== requestId) return;
      const message = `${failure.message} 点击“刷新榜单”重试。`;
      if (preservePublicRows) {
        status.textContent = message;
        status.hidden = false;
      } else rows.replaceChildren(el('p', 'records-empty record-load-error', message));
    }
  }
  select.addEventListener('change', () => navigate(recordsPath(select.value)));
  root.querySelector('.records-refresh').onclick = () => load();

  window.addEventListener('playroom:navigate', () => {
    const match = /^\/records(?:\/([^/]+))?$/.exec(location.pathname);
    const board = match ? getRecordBoardById(match[1] ?? DEFAULT_RECORD_BOARD_ID) : null;
    const changed = board !== selected;
    selected = board;
    active = Boolean(board);
    root.hidden = !active;
    nav.classList.toggle('active', active);
    if (board) {
      nav.setAttribute('aria-current', 'page');
      for (const link of boardLinks) {
        if (link.pathname === location.pathname) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      if (changed) {
        select.value = board.id;
        root.querySelector('.records-board-heading h2').textContent = recordBoardLabel(board);
        root.querySelector('.records-rule').textContent = recordBoardRule(board);
        root.querySelector('.records-play').href = `/games/${board.game}`;
        load();
      }
    } else {
      nav.removeAttribute('aria-current');
      requestId++;
    }
    queueMicrotask(showPendingResult);
  });
}
