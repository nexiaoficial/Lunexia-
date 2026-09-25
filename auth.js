(function () {
  const ACCOUNT_KEY = 'lunexia.secureAccount';
  const SESSION_KEY = 'lunexia.authSession';
  const REDIRECT_KEY = 'lunexia.authRedirect';
  const ALLOWED_REDIRECTS = new Set(['index.html', 'app.html']);
  const PASSWORD_ITERATIONS = 120000;
  const listeners = new Set();

  let elements;
  let modalLocked = false;
  let currentMode = 'login';
  let currentRedirect = 'app.html';
  let lastFocusedElement = null;

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Falha ao ler armazenamento', error);
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getStoredAccount() {
    return readJson(ACCOUNT_KEY);
  }

  function getStoredSession() {
    return readJson(SESSION_KEY);
  }

  function getCurrentUser() {
    const account = getStoredAccount();
    const session = getStoredSession();

    if (!account || !session) return null;
    if (normalizeEmail(account.email) !== normalizeEmail(session.email)) return null;

    return {
      name: account.name,
      email: account.email
    };
  }

  function isAuthenticated() {
    return Boolean(getCurrentUser());
  }

  function ensureSecureHashing() {
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues || !window.TextEncoder) {
      throw new Error('Este navegador não oferece o nível mínimo de segurança para proteger a sua conta.');
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(value) {
    const pairs = value.match(/.{1,2}/g) || [];
    return new Uint8Array(pairs.map((pair) => parseInt(pair, 16)));
  }

  function createSalt() {
    ensureSecureHashing();
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    return bytesToHex(salt);
  }

  async function hashPassword(email, password, salt) {
    ensureSecureHashing();

    const normalized = `${normalizeEmail(email)}::${password}`;
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(normalized),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: hexToBytes(salt),
        iterations: PASSWORD_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return bytesToHex(new Uint8Array(derivedBits));
  }

  function setRedirect(url) {
    const safeUrl = sanitizeRedirect(url);
    if (safeUrl) localStorage.setItem(REDIRECT_KEY, safeUrl);
  }

  function consumeRedirect(fallbackUrl) {
    const stored = sanitizeRedirect(localStorage.getItem(REDIRECT_KEY));
    localStorage.removeItem(REDIRECT_KEY);
    return stored || sanitizeRedirect(fallbackUrl) || 'app.html';
  }

  function sanitizeRedirect(url) {
    if (!url) return null;

    try {
      const parsed = new URL(url, window.location.href);
      const pathname = parsed.pathname.endsWith('/')
        ? 'index.html'
        : parsed.pathname.split('/').filter(Boolean).pop();

      if (parsed.origin !== window.location.origin || !pathname || !ALLOWED_REDIRECTS.has(pathname)) {
        return null;
      }

      return `${pathname}${parsed.search}${parsed.hash}`;
    } catch (error) {
      return null;
    }
  }

  function getCurrentLocationTarget() {
    const pathname = window.location.pathname.endsWith('/')
      ? 'index.html'
      : window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    return `${pathname}${window.location.search}${window.location.hash}`;
  }

  function isAppPage() {
    return getCurrentLocationTarget().startsWith('app.html');
  }

  function emitAuthState() {
    const state = {
      account: getStoredAccount(),
      authenticated: isAuthenticated(),
      user: getCurrentUser()
    };

    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Falha ao notificar autenticação', error);
      }
    });

    return state;
  }

  function ensureStyles() {
    if (document.getElementById('lunexia-auth-styles')) return;

    const style = document.createElement('style');
    style.id = 'lunexia-auth-styles';
    style.textContent = `
      .auth-portal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(3, 7, 18, 0.78);
        backdrop-filter: blur(10px);
        z-index: 999;
      }
      .auth-portal.show {
        display: flex;
      }
      .auth-card {
        width: min(460px, 100%);
        padding: 28px 24px;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.08);
        background: linear-gradient(180deg, rgba(15,23,42,0.98), rgba(17,24,39,0.95));
        box-shadow: 0 30px 80px rgba(2, 6, 23, 0.45);
        color: #f8fafc;
      }
      .auth-card h2 {
        margin: 0 0 8px;
        font-size: 1.9rem;
        letter-spacing: -0.04em;
      }
      .auth-card p {
        margin: 0;
        color: rgba(226, 232, 240, 0.78);
      }
      .auth-top {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .auth-close {
        border: 0;
        border-radius: 999px;
        width: 38px;
        height: 38px;
        cursor: pointer;
        color: #f8fafc;
        background: rgba(255,255,255,0.09);
      }
      .auth-close[hidden] {
        display: none;
      }
      .auth-grid {
        display: grid;
        gap: 14px;
        margin: 22px 0 18px;
      }
      .auth-field {
        display: grid;
        gap: 8px;
      }
      .auth-field span {
        font-weight: 700;
        font-size: 0.95rem;
      }
      .auth-field input {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.7);
        color: #f8fafc;
        padding: 13px 14px;
        outline: none;
      }
      .auth-field input:focus {
        border-color: rgba(167, 123, 255, 0.85);
        box-shadow: 0 0 0 3px rgba(167, 123, 255, 0.18);
      }
      .auth-submit,
      .auth-secondary,
      .auth-danger {
        width: 100%;
        border: 0;
        border-radius: 14px;
        padding: 13px 16px;
        cursor: pointer;
        font-weight: 700;
      }
      .auth-submit {
        color: white;
        background: linear-gradient(135deg, #7657ff, #a77bff);
      }
      .auth-submit:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .auth-secondary {
        margin-top: 10px;
        color: #e2e8f0;
        background: rgba(255,255,255,0.07);
      }
      .auth-danger {
        margin-top: 12px;
        color: #fee2e2;
        background: rgba(239, 68, 68, 0.18);
      }
      .auth-message {
        min-height: 22px;
        margin: 0 0 10px;
        font-size: 0.95rem;
        color: #fca5a5;
      }
      .auth-meta {
        margin-top: 14px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.05);
      }
      .auth-meta strong,
      .auth-meta span {
        display: block;
      }
      .auth-meta span {
        margin-top: 4px;
        color: rgba(226, 232, 240, 0.78);
        word-break: break-word;
      }
      .auth-switch {
        margin-top: 14px;
        text-align: center;
        color: rgba(226, 232, 240, 0.78);
        font-size: 0.95rem;
      }
      .auth-switch button {
        border: 0;
        padding: 0;
        margin-left: 4px;
        color: #c4b5fd;
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    if (elements) return elements;

    ensureStyles();

    const container = document.createElement('div');
    container.id = 'secureAuthPortal';
    container.className = 'auth-portal';
    container.innerHTML = `
      <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authPortalTitle" tabindex="-1">
        <div class="auth-top">
          <div>
            <h2 id="authPortalTitle">Conta segura</h2>
            <p id="authPortalSubtitle">Proteja seu acesso ao Lunexia.</p>
          </div>
          <button type="button" class="auth-close" id="authPortalClose" aria-label="Fechar">✕</button>
        </div>
        <p class="auth-message" id="authPortalMessage" role="alert" aria-live="assertive"></p>
        <form id="authPortalForm">
          <div class="auth-grid">
            <label class="auth-field" id="authNameField">
              <span>Nome</span>
              <input id="authNameInput" name="name" type="text" autocomplete="name" maxlength="80">
            </label>
            <label class="auth-field" id="authEmailField">
              <span>E-mail</span>
              <input id="authEmailInput" name="email" type="email" autocomplete="email" maxlength="120" required>
            </label>
            <label class="auth-field" id="authPasswordField">
              <span>Senha</span>
              <input id="authPasswordInput" name="password" type="password" autocomplete="current-password" minlength="6" required>
            </label>
          </div>
          <div class="auth-meta" id="authPortalMeta" hidden>
            <strong id="authMetaName"></strong>
            <span id="authMetaEmail"></span>
          </div>
          <button type="submit" class="auth-submit" id="authPortalSubmit">Continuar</button>
          <button type="button" class="auth-secondary" id="authPortalSecondary">Trocar modo</button>
          <button type="button" class="auth-danger" id="authPortalDelete" hidden>Excluir conta</button>
        </form>
        <div class="auth-switch" id="authPortalSwitch"></div>
      </div>
    `;

    document.body.appendChild(container);

    elements = {
      container,
      close: container.querySelector('#authPortalClose'),
      title: container.querySelector('#authPortalTitle'),
      subtitle: container.querySelector('#authPortalSubtitle'),
      message: container.querySelector('#authPortalMessage'),
      form: container.querySelector('#authPortalForm'),
      submit: container.querySelector('#authPortalSubmit'),
      secondary: container.querySelector('#authPortalSecondary'),
      deleteButton: container.querySelector('#authPortalDelete'),
      switchLine: container.querySelector('#authPortalSwitch'),
      nameField: container.querySelector('#authNameField'),
      nameInput: container.querySelector('#authNameInput'),
      emailField: container.querySelector('#authEmailField'),
      emailInput: container.querySelector('#authEmailInput'),
      passwordField: container.querySelector('#authPasswordField'),
      passwordInput: container.querySelector('#authPasswordInput'),
      meta: container.querySelector('#authPortalMeta'),
      metaName: container.querySelector('#authMetaName'),
      metaEmail: container.querySelector('#authMetaEmail'),
      card: container.querySelector('.auth-card')
    };

    elements.close.addEventListener('click', () => {
      if (!modalLocked) closeAuth();
    });

    elements.container.addEventListener('click', (event) => {
      if (event.target === elements.container && !modalLocked) closeAuth();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && elements?.container.classList.contains('show') && !modalLocked) {
        event.preventDefault();
        closeAuth();
      }
    });

    elements.form.addEventListener('submit', handleSubmit);
    elements.secondary.addEventListener('click', handleSecondaryAction);
    elements.deleteButton.addEventListener('click', handleDeleteAccount);

    return elements;
  }

  function renderAuth(mode, message) {
    const ui = ensureModal();
    const account = getStoredAccount();
    currentMode = mode;

    ui.message.textContent = message || '';
    ui.close.hidden = modalLocked;
    ui.meta.hidden = (mode !== 'manage' && mode !== 'delete-confirm') || !account;
    ui.deleteButton.hidden = mode !== 'manage';
    ui.passwordInput.value = '';

    if (mode === 'create') {
      ui.title.textContent = 'Criar conta segura';
      ui.subtitle.textContent = account
        ? 'Já existe uma conta protegida neste navegador. Entre com ela ou exclua a conta atual para cadastrar outra.'
        : 'Cadastre seu nome, e-mail e senha para liberar o acesso.';
      ui.submit.textContent = account ? 'Conta já cadastrada' : 'Criar conta';
      ui.secondary.textContent = 'Entrar com conta existente';
      ui.switchLine.innerHTML = `Já possui uma conta?<button type="button" data-mode="login">Entrar</button>`;
      ui.nameField.hidden = false;
      ui.emailField.hidden = false;
      ui.passwordField.hidden = false;
      ui.nameInput.required = true;
      ui.emailInput.required = true;
      ui.passwordInput.required = true;
      ui.submit.disabled = Boolean(account);
      ui.passwordInput.autocomplete = 'new-password';
      if (account) {
        ui.nameInput.value = account.name || '';
        ui.emailInput.value = account.email || '';
      }
    } else if (mode === 'login') {
      ui.title.textContent = 'Entrar na conta protegida';
      ui.subtitle.textContent = 'Use a conta segura para acessar o aplicativo.';
      ui.submit.textContent = 'Entrar';
      ui.secondary.textContent = account ? 'Criar outra conta' : 'Criar conta segura';
      ui.switchLine.innerHTML = `Ainda não tem conta?<button type="button" data-mode="create">Criar agora</button>`;
      ui.nameField.hidden = true;
      ui.emailField.hidden = false;
      ui.passwordField.hidden = false;
      ui.nameInput.required = false;
      ui.nameInput.value = account?.name || '';
      ui.emailInput.required = true;
      ui.passwordInput.required = true;
      ui.submit.disabled = false;
      ui.passwordInput.autocomplete = 'current-password';
      ui.emailInput.value = account?.email || '';
    } else if (mode === 'manage') {
      const user = getCurrentUser() || account;
      ui.title.textContent = 'Conta e segurança';
      ui.subtitle.textContent = 'Gerencie o acesso protegido do aplicativo.';
      ui.submit.textContent = 'Sair da conta';
      ui.secondary.textContent = 'Continuar no aplicativo';
      ui.switchLine.innerHTML = '';
      ui.nameField.hidden = true;
      ui.emailField.hidden = true;
      ui.passwordField.hidden = true;
      ui.nameInput.required = false;
      ui.emailInput.required = false;
      ui.passwordInput.required = false;
      ui.submit.disabled = false;
      ui.emailInput.value = user?.email || '';
      ui.metaName.textContent = user?.name || 'Conta protegida';
      ui.metaEmail.textContent = user?.email || '';
    } else {
      const user = getCurrentUser() || account;
      ui.title.textContent = 'Confirmar exclusão da conta';
      ui.subtitle.textContent = 'Digite a senha da conta protegida para remover o acesso salvo neste navegador.';
      ui.submit.textContent = 'Excluir conta';
      ui.secondary.textContent = 'Voltar para conta';
      ui.switchLine.innerHTML = '';
      ui.nameField.hidden = true;
      ui.emailField.hidden = true;
      ui.passwordField.hidden = false;
      ui.nameInput.required = false;
      ui.emailInput.required = false;
      ui.passwordInput.required = true;
      ui.submit.disabled = false;
      ui.metaName.textContent = user?.name || 'Conta protegida';
      ui.metaEmail.textContent = user?.email || '';
    }

    ui.switchLine.querySelector('[data-mode]')?.addEventListener('click', (event) => {
      openAuth(event.currentTarget.dataset.mode, { redirectTo: currentRedirect, locked: modalLocked });
    });
  }

  function openAuth(mode, options) {
    const ui = ensureModal();
    const config = options || {};

    modalLocked = Boolean(config.locked);
    currentRedirect = config.redirectTo || currentRedirect || 'app.html';
    if (!ui.container.classList.contains('show')) {
      lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    if (config.redirectTo) {
      setRedirect(config.redirectTo);
    }

    renderAuth(mode || 'login', config.message || '');
    ui.container.classList.add('show');

    requestAnimationFrame(() => {
      const focusTarget = !ui.nameField.hidden
        ? ui.nameInput
        : !ui.emailField.hidden
          ? ui.emailInput
          : !ui.passwordField.hidden
            ? ui.passwordInput
            : ui.secondary;
      focusTarget?.focus();
    });
  }

  function closeAuth() {
    const ui = ensureModal();
    ui.container.classList.remove('show');
    modalLocked = false;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  async function createAccount(payload) {
    if (getStoredAccount()) {
      throw new Error('Já existe uma conta protegida neste navegador. Exclua a conta atual antes de criar outra.');
    }

    const account = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      passwordSalt: createSalt(),
      createdAt: new Date().toISOString()
    };

    account.passwordHash = await hashPassword(payload.email, payload.password, account.passwordSalt);

    writeJson(ACCOUNT_KEY, account);
    writeJson(SESSION_KEY, { email: account.email, authenticatedAt: new Date().toISOString() });
    emitAuthState();
    return account;
  }

  async function login(payload) {
    const account = getStoredAccount();

    if (!account) {
      throw new Error('Não foi possível autenticar com as credenciais informadas.');
    }

    if (normalizeEmail(payload.email) !== normalizeEmail(account.email) || !account.passwordSalt) {
      throw new Error('Não foi possível autenticar com as credenciais informadas.');
    }

    const receivedHash = await hashPassword(payload.email, payload.password, account.passwordSalt);
    if (receivedHash !== account.passwordHash) {
      throw new Error('Não foi possível autenticar com as credenciais informadas.');
    }

    writeJson(SESSION_KEY, { email: account.email, authenticatedAt: new Date().toISOString() });
    emitAuthState();
    return account;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REDIRECT_KEY);
    emitAuthState();
  }

  function deleteAccount() {
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REDIRECT_KEY);
    emitAuthState();
  }

  function getPortalMessage(error) {
    return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
  }

  function redirectAfterAuth(fallbackUrl) {
    const target = consumeRedirect(fallbackUrl);
    if (target && getCurrentLocationTarget() !== target) {
      window.location.href = target;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const ui = ensureModal();
    ui.message.textContent = '';

    try {
      if (currentMode === 'create') {
        const name = ui.nameInput.value.trim();
        const email = ui.emailInput.value.trim();
        const password = ui.passwordInput.value;

        if (!name) throw new Error('Informe seu nome para criar a conta.');
        if (!email) throw new Error('Informe seu e-mail.');
        if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');

        await createAccount({ name, email, password });
        closeAuth();
        redirectAfterAuth(currentRedirect);
        return;
      }

      if (currentMode === 'login') {
        const email = ui.emailInput.value.trim();
        const password = ui.passwordInput.value;

        if (!email || !password) {
          throw new Error('Preencha e-mail e senha para entrar.');
        }

        await login({ email, password });
        closeAuth();
        redirectAfterAuth(currentRedirect);
        return;
      }

      if (currentMode === 'delete-confirm') {
        const account = getStoredAccount();
        if (!account) {
          throw new Error('Nenhuma conta protegida foi encontrada neste navegador.');
        }

        const password = ui.passwordInput.value;
        if (!password) {
          throw new Error('Digite sua senha para confirmar a exclusão.');
        }

        const expectedHash = await hashPassword(account.email, password, account.passwordSalt);
        if (expectedHash !== account.passwordHash) {
          throw new Error('Senha incorreta. A conta não foi excluída.');
        }

        deleteAccount();
        openAuth('create', {
          redirectTo: currentRedirect,
          locked: isAppPage(),
          message: 'Conta excluída. Crie uma nova conta para continuar.'
        });
        return;
      }

      logout();
      closeAuth();
      if (isAppPage()) {
        requireAuth({ redirectTo: 'app.html', message: 'Entre novamente para acessar o aplicativo.' });
      }
    } catch (error) {
      ui.message.textContent = getPortalMessage(error);
    }
  }

  function handleSecondaryAction() {
    if (currentMode === 'manage') {
      closeAuth();
      return;
    }

    if (currentMode === 'delete-confirm') {
      openAuth('manage', {
        redirectTo: currentRedirect,
        locked: modalLocked
      });
      return;
    }

    openAuth(currentMode === 'create' ? 'login' : 'create', {
      redirectTo: currentRedirect,
      locked: modalLocked
    });
  }

  async function handleDeleteAccount() {
    const account = getStoredAccount();
    if (!account) {
      ensureModal().message.textContent = 'Nenhuma conta protegida foi encontrada neste navegador.';
      return;
    }

    openAuth('delete-confirm', {
      redirectTo: currentRedirect,
      locked: modalLocked,
      message: `Confirme a senha da conta ${account.email} para concluir a exclusão.`
    });
  }

  function launchProtectedExperience(url) {
    const target = url || 'app.html';

    if (isAuthenticated()) {
      window.location.href = target;
      return;
    }

    openAuth(getStoredAccount() ? 'login' : 'create', {
      redirectTo: target
    });
  }

  function requireAuth(options) {
    const config = options || {};

    if (isAuthenticated()) {
      emitAuthState();
      return true;
    }

    openAuth(getStoredAccount() ? 'login' : 'create', {
      redirectTo: config.redirectTo || 'app.html',
      locked: config.locked !== false,
      message: config.message || 'Crie sua conta ou entre para liberar o acesso.'
    });

    return false;
  }

  function addAuthListener(listener) {
    listeners.add(listener);
    listener({
      account: getStoredAccount(),
      authenticated: isAuthenticated(),
      user: getCurrentUser()
    });

    return function removeListener() {
      listeners.delete(listener);
    };
  }

  function init() {
    ensureModal();
    emitAuthState();
  }

  window.LunexiaAuth = {
    addAuthListener,
    closeAuth,
    createAccount,
    deleteAccount,
    getCurrentUser,
    getStoredAccount,
    init,
    isAuthenticated,
    launchProtectedExperience,
    login,
    logout,
    openAuth,
    requireAuth
  };
})();
