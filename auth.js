(function () {
  const ACCOUNT_KEY = "lunexia_secure_account_v1";
  const SESSION_KEY = "lunexia_secure_session_v1";
  const body = document.body;
  if (!body) return;

  const page = {
    isApp: Boolean(document.getElementById("appTitle")),
    greeting: document.getElementById("appTitle"),
    subtitle: document.querySelector(".title-wrap .sub"),
    avatar: document.getElementById("avatarInitial"),
    authButton: document.getElementById("accountSecurityButton") || document.querySelector("[data-auth-open]"),
    appLinks: Array.from(document.querySelectorAll('a[href="app.html"]'))
  };

  let currentMode = "signup";
  let authNodes = null;

  injectStyles();
  renderModal();
  bindEntryPoints();
  syncAccess();

  window.lunexiaAuth = {
    open(mode) {
      showModal(mode || preferredMode());
    },
    close() {
      hideModal();
    }
  };

  function injectStyles() {
    if (document.getElementById("secure-auth-styles")) return;
    const style = document.createElement("style");
    style.id = "secure-auth-styles";
    style.textContent = `
      body.secure-auth-locked { overflow: hidden; }
      .secure-auth-overlay {
        position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
        padding: 24px; z-index: 9999; background: linear-gradient(135deg, rgba(2,6,23,.96), rgba(76,29,149,.88));
      }
      .secure-auth-overlay.show { display: flex; }
      .secure-auth-card {
        width: min(460px, 100%); background: rgba(15,23,42,.97); color: #e5eefb; border-radius: 28px;
        border: 1px solid rgba(148,163,184,.18); box-shadow: 0 30px 90px rgba(0,0,0,.35); padding: 28px;
      }
      .secure-auth-card h2 { margin: 0 0 8px; font-size: clamp(1.8rem, 4vw, 2.4rem); letter-spacing: -.04em; }
      .secure-auth-card p { margin: 0; color: rgba(226,232,240,.72); }
      .secure-auth-tabs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 22px 0 18px; }
      .secure-auth-tab, .secure-auth-action, .secure-auth-secondary {
        border: 1px solid rgba(148,163,184,.18); border-radius: 14px; font: inherit; cursor: pointer;
      }
      .secure-auth-tab { background: rgba(30,41,59,.55); color: #e5eefb; padding: 11px 14px; font-weight: 700; }
      .secure-auth-tab.active { background: linear-gradient(135deg, #7c3aed, #2563eb); border-color: transparent; }
      .secure-auth-grid { display: grid; gap: 12px; }
      .secure-auth-grid.two-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .secure-auth-field { display: grid; gap: 7px; }
      .secure-auth-field label { color: rgba(226,232,240,.82); font-size: .92rem; }
      .secure-auth-field input {
        width: 100%; background: rgba(15,23,42,.82); color: #f8fafc; border: 1px solid rgba(148,163,184,.18);
        border-radius: 14px; padding: 12px 14px; font: inherit;
      }
      .secure-auth-field input:focus { outline: 2px solid rgba(124,58,237,.45); outline-offset: 1px; }
      .secure-auth-message { min-height: 24px; margin: 14px 0 0; color: #fca5a5; font-size: .92rem; }
      .secure-auth-message.success { color: #86efac; }
      .secure-auth-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
      .secure-auth-action { flex: 1; min-width: 170px; padding: 12px 16px; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; font-weight: 800; }
      .secure-auth-secondary { padding: 12px 16px; background: rgba(30,41,59,.55); color: #e5eefb; }
      .secure-auth-summary { margin-top: 18px; padding: 14px 16px; border-radius: 16px; background: rgba(30,41,59,.45); border: 1px solid rgba(148,163,184,.15); }
      .secure-auth-summary strong { display: block; margin-bottom: 6px; }
      .secure-auth-summary span { display: block; color: rgba(226,232,240,.75); font-size: .94rem; }
      .secure-auth-lock-note { margin-top: 14px; font-size: .9rem; color: rgba(226,232,240,.7); }
      .secure-auth-badge {
        display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 9px 13px; border-radius: 999px;
        background: rgba(34,197,94,.14); color: #bbf7d0; font-weight: 700; font-size: .9rem;
      }
      @media (max-width: 560px) { .secure-auth-grid.two-cols { grid-template-columns: 1fr; } .secure-auth-card { padding: 22px 18px; } }
    `;
    document.head.appendChild(style);
  }

  function renderModal() {
    const overlay = document.createElement("div");
    overlay.className = "secure-auth-overlay";
    overlay.id = "secureAuthOverlay";
    overlay.innerHTML = `
      <div class="secure-auth-card" role="dialog" aria-modal="true" aria-labelledby="secureAuthTitle">
        <h2 id="secureAuthTitle">Conta segura Lunexia</h2>
        <p id="secureAuthDescription">Crie sua conta segura com nome, e-mail, senha e código de segurança para continuar com segurança.</p>
        <div class="secure-auth-tabs">
          <button type="button" class="secure-auth-tab" data-mode="signup">Criar conta</button>
          <button type="button" class="secure-auth-tab" data-mode="login">Entrar</button>
        </div>
        <form id="secureAuthForm" class="secure-auth-grid" novalidate>
          <div class="secure-auth-field" data-signup-only="true">
            <label for="secureAuthName">Nome completo</label>
            <input id="secureAuthName" name="name" type="text" autocomplete="name" placeholder="Seu nome">
          </div>
          <div class="secure-auth-field">
            <label for="secureAuthEmail">E-mail</label>
            <input id="secureAuthEmail" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com">
          </div>
          <div class="secure-auth-grid two-cols">
            <div class="secure-auth-field">
              <label for="secureAuthPassword">Senha</label>
              <input id="secureAuthPassword" name="password" type="password" autocomplete="current-password" placeholder="Mínimo de 6 caracteres">
            </div>
            <div class="secure-auth-field">
              <label for="secureAuthSecurityCode">Código de segurança</label>
              <input id="secureAuthSecurityCode" name="securityCode" type="password" inputmode="numeric" autocomplete="one-time-code" placeholder="4 números ou mais">
            </div>
          </div>
          <div class="secure-auth-message" id="secureAuthMessage" aria-live="polite"></div>
          <div class="secure-auth-actions">
            <button type="submit" class="secure-auth-action" id="secureAuthSubmit">Criar conta segura</button>
            <button type="button" class="secure-auth-secondary" id="secureAuthClose">Fechar</button>
          </div>
        </form>
        <div class="secure-auth-summary" id="secureAuthSummary" hidden></div>
        <div class="secure-auth-lock-note" id="secureAuthLockNote">O acesso permanece bloqueado até a autenticação ser concluída.</div>
      </div>
    `;
    document.body.appendChild(overlay);

    authNodes = {
      overlay,
      form: overlay.querySelector("#secureAuthForm"),
      title: overlay.querySelector("#secureAuthTitle"),
      description: overlay.querySelector("#secureAuthDescription"),
      message: overlay.querySelector("#secureAuthMessage"),
      summary: overlay.querySelector("#secureAuthSummary"),
      submit: overlay.querySelector("#secureAuthSubmit"),
      close: overlay.querySelector("#secureAuthClose"),
      lockNote: overlay.querySelector("#secureAuthLockNote"),
      tabs: Array.from(overlay.querySelectorAll(".secure-auth-tab")),
      signupFields: Array.from(overlay.querySelectorAll("[data-signup-only='true']")),
      inputs: {
        name: overlay.querySelector("#secureAuthName"),
        email: overlay.querySelector("#secureAuthEmail"),
        password: overlay.querySelector("#secureAuthPassword"),
        securityCode: overlay.querySelector("#secureAuthSecurityCode")
      }
    };

    authNodes.tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        setMode(tab.dataset.mode);
      });
    });

    authNodes.form.addEventListener("submit", handleSubmit);
    authNodes.close.addEventListener("click", function () {
      if (hasSession()) {
        hideModal();
      }
    });

    authNodes.overlay.addEventListener("click", function (event) {
      if (event.target === authNodes.overlay && hasSession()) {
        hideModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && authNodes.overlay.classList.contains("show") && hasSession()) {
        hideModal();
      }
    });

    setMode(preferredMode());
  }

  function bindEntryPoints() {
    const triggers = Array.from(document.querySelectorAll("[data-auth-open='true']"));
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", function (event) {
        if (!hasSession() || trigger.getAttribute("href") === "#comece") {
          event.preventDefault();
          showModal(preferredMode());
        }
      });
    });

    page.appLinks.forEach((link) => {
      link.addEventListener("click", function (event) {
        if (!hasSession()) {
          event.preventDefault();
          showModal(preferredMode());
        }
      });
    });

    if (page.authButton && !page.authButton.hasAttribute("data-auth-open")) {
      page.authButton.addEventListener("click", function (event) {
        event.preventDefault();
        showModal(preferredMode());
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();

    if (currentMode === "signup") {
      const payload = readForm();
      const error = validateSignup(payload);
      if (error) return setMessage(error);
      const account = {
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: await createProtectedSecret(payload.password),
        securityCode: await createProtectedSecret(payload.securityCode),
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      createSession(account.email);
      setMessage("Conta segura criada com sucesso.", true);
      authNodes.form.reset();
      syncAccess();
      setMode("login");
      hideModal();
      return;
    }

    const payload = readForm();
    const account = getAccount();
    if (!account) {
      setMode("signup");
      return setMessage("Crie sua conta segura antes de entrar.");
    }

    const email = payload.email.trim().toLowerCase();
    const passwordMatches = await verifySecret(payload.password, account.password);
    const securityCodeMatches = await verifySecret(payload.securityCode, account.securityCode);
    if (email !== account.email || !passwordMatches || !securityCodeMatches) {
      return setMessage("Dados de acesso inválidos. Confira e tente novamente.");
    }

    createSession(account.email);
    setMessage("Acesso liberado com sucesso.", true);
    authNodes.form.reset();
    syncAccess();
    hideModal();
  }

  function readForm() {
    return {
      name: authNodes.inputs.name.value || "",
      email: authNodes.inputs.email.value || "",
      password: authNodes.inputs.password.value || "",
      securityCode: authNodes.inputs.securityCode.value || ""
    };
  }

  function validateSignup(payload) {
    if (!payload.name.trim()) return "Informe o nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return "Informe um e-mail válido.";
    if (payload.password.length < 6) return "Crie uma senha com pelo menos 6 caracteres.";
    if (!/^\d{4,}$/.test(payload.securityCode.trim())) return "Use um código de segurança com pelo menos 4 números.";
    return "";
  }

  function setMode(mode) {
    currentMode = mode === "login" ? "login" : "signup";
    const hasAccount = Boolean(getAccount());
    authNodes.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === currentMode));
    authNodes.signupFields.forEach((field) => {
      field.hidden = currentMode !== "signup";
    });
    authNodes.inputs.name.required = currentMode === "signup";
    authNodes.submit.textContent = currentMode === "signup" ? "Criar conta segura" : "Entrar com segurança";
    authNodes.title.textContent = currentMode === "signup" ? "Conta segura Lunexia" : "Entrar com conta segura";
    authNodes.description.textContent = currentMode === "signup"
      ? "Crie sua conta segura com nome, e-mail, senha e código de segurança para continuar com segurança."
      : "Digite seu e-mail, senha e código de segurança para liberar o acesso.";
    authNodes.close.hidden = !hasSession();
    authNodes.lockNote.hidden = hasSession();
    clearMessage();
    updateSummary();
  }

  function updateSummary() {
    const account = getAccount();
    if (!account) {
      authNodes.summary.hidden = true;
      authNodes.summary.innerHTML = "";
      return;
    }

    const name = account.name || "Cliente";
    authNodes.summary.hidden = false;
    authNodes.summary.innerHTML = `
      <strong>Conta cadastrada</strong>
      <span>${escapeHtml(name)}</span>
      <span>${escapeHtml(account.email)}</span>
      <div class="secure-auth-actions" style="margin-top:14px;">
        <button type="button" class="secure-auth-secondary" id="secureAuthLogout">Sair</button>
        <button type="button" class="secure-auth-secondary" id="secureAuthDelete">Excluir conta</button>
      </div>
      ${hasSession() ? '<div class="secure-auth-badge">✅ Conta autenticada</div>' : ''}
    `;

    const logoutButton = authNodes.summary.querySelector("#secureAuthLogout");
    const deleteButton = authNodes.summary.querySelector("#secureAuthDelete");
    logoutButton?.addEventListener("click", logout);
    deleteButton?.addEventListener("click", deleteAccount);
  }

  function syncAccess() {
    const legacyModal = document.getElementById("loginModal");
    if (legacyModal) {
      legacyModal.hidden = true;
      legacyModal.classList.remove("show");
    }

    const account = getAccount();
    const session = getSession();
    const authenticated = Boolean(account && session && session.email === account.email);

    if (authenticated) {
      body.classList.remove("secure-auth-locked");
      hideModal();
      updateIdentity(account);
    } else if (page.isApp) {
      body.classList.add("secure-auth-locked");
      showModal(preferredMode());
      resetIdentity();
    } else {
      body.classList.remove("secure-auth-locked");
      hideModal();
      resetIdentity();
    }

    if (page.authButton) {
      page.authButton.textContent = authenticated ? "Conta protegida" : "Conta e segurança";
    }

    page.appLinks.forEach((link) => {
      link.textContent = authenticated ? "Abrir o aplicativo" : "Acessar com conta segura";
    });

    updateSummary();
  }

  function updateIdentity(account) {
    const firstName = (account.name || "Cliente").trim().split(/\s+/)[0];
    const initial = firstName.charAt(0).toUpperCase() || "C";
    if (page.greeting) page.greeting.textContent = `Olá, ${firstName}! 👋`;
    if (page.subtitle) page.subtitle.textContent = "Sua conta segura está conectada e pronta para uso.";
    if (page.avatar) {
      page.avatar.textContent = initial;
      page.avatar.setAttribute("title", account.name);
      page.avatar.setAttribute("aria-label", `Avatar de ${account.name}`);
    }
  }

  function resetIdentity() {
    if (page.greeting) page.greeting.textContent = "Olá! 👋";
    if (page.subtitle) page.subtitle.textContent = "Crie, edite e organize tudo em um só lugar.";
    if (page.avatar) {
      page.avatar.textContent = "?";
      page.avatar.setAttribute("aria-label", "Avatar do cliente");
      page.avatar.removeAttribute("title");
    }
  }

  function showModal(mode) {
    setMode(mode || preferredMode());
    authNodes.overlay.classList.add("show");
    authNodes.overlay.setAttribute("aria-hidden", "false");
    authNodes.close.hidden = !hasSession();
    const targetInput = currentMode === "signup" ? authNodes.inputs.name : authNodes.inputs.email;
    window.setTimeout(() => targetInput?.focus(), 20);
  }

  function hideModal() {
    if (!hasSession() && page.isApp) return;
    authNodes.overlay.classList.remove("show");
    authNodes.overlay.setAttribute("aria-hidden", "true");
    clearMessage();
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    syncAccess();
  }

  function deleteAccount() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    authNodes.form.reset();
    syncAccess();
    setMode("signup");
    setMessage("Conta excluída. Crie uma nova conta para continuar.");
  }

  function preferredMode() {
    return getAccount() ? "login" : "signup";
  }

  function createSession(email) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email, authenticatedAt: new Date().toISOString() }));
  }

  function getAccount() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function hasSession() {
    const account = getAccount();
    const session = getSession();
    return Boolean(account && session && session.email === account.email);
  }

  function clearMessage() {
    authNodes.message.textContent = "";
    authNodes.message.classList.remove("success");
  }

  function setMessage(message, success) {
    authNodes.message.textContent = message;
    authNodes.message.classList.toggle("success", Boolean(success));
  }

  async function createProtectedSecret(value) {
    const salt = randomSalt();
    return {
      salt,
      hash: await deriveSecretHash(value, salt)
    };
  }

  async function verifySecret(value, storedSecret) {
    if (!storedSecret?.salt || !storedSecret?.hash) return false;
    const candidateHash = await deriveSecretHash(value, storedSecret.salt);
    return candidateHash === storedSecret.hash;
  }

  async function deriveSecretHash(value, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(value.trim()),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: base64ToBytes(salt),
        iterations: 120000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    return Array.from(new Uint8Array(derivedBits)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function randomSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return bytesToBase64(bytes);
  }

  function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
  }

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
