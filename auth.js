// ============================================================
// Auth — localStorage-based (demo/offline). 
// In production replace with a real backend / JWT.
// ============================================================

const Auth = {
    USERS_KEY: 'crm_users',
    SESSION_KEY: 'crm_session',

    getUsers() {
        return JSON.parse(localStorage.getItem(this.USERS_KEY) || '[]');
    },

    saveUsers(users) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    getCurrentUser() {
        const session = localStorage.getItem(this.SESSION_KEY);
        if (!session) return null;
        try {
            return JSON.parse(session);
        } catch {
            return null;
        }
    },

    setSession(user) {
        // Never store the password in the session
        const { password, ...safeUser } = user;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(safeUser));
    },

    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    signUp(firstName, lastName, email, password) {
        const users = this.getUsers();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { ok: false, error: 'An account with this email already exists.' };
        }
        const newUser = {
            id: Date.now().toString(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            password, // hashing omitted — demo only
            business: '',
            phone: '',
            address: '',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        this.saveUsers(users);
        this.setSession(newUser);
        return { ok: true, user: newUser };
    },

    signIn(email, password) {
        const users = this.getUsers();
        const user = users.find(
            u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
        );
        if (!user) {
            return { ok: false, error: 'Incorrect email or password.' };
        }
        this.setSession(user);
        return { ok: true, user };
    },

    updateProfile(data) {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.id === data.id);
        if (idx === -1) return { ok: false, error: 'User not found.' };
        users[idx] = { ...users[idx], ...data };
        this.saveUsers(users);
        this.setSession(users[idx]);
        return { ok: true, user: users[idx] };
    }
};

// ── UI helpers ──────────────────────────────────────────────

function showSignup() {
    document.getElementById('signin-panel').classList.remove('active');
    document.getElementById('signup-panel').classList.add('active');
}

function showSignin() {
    document.getElementById('signup-panel').classList.remove('active');
    document.getElementById('signin-panel').classList.add('active');
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>`;
    } else {
        input.type = 'password';
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>`;
    }
}

function setFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearFieldErrors(prefix) {
    ['email', 'password', 'firstname', 'lastname'].forEach(f => {
        const el = document.getElementById(`${prefix}-${f}-err`);
        if (el) el.textContent = '';
    });
    const errEl = document.getElementById(`${prefix}-error`);
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}

function showAuthError(prefix, msg) {
    const el = document.getElementById(`${prefix}-error`);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── Form handlers ────────────────────────────────────────────

document.getElementById('signin-form').addEventListener('submit', e => {
    e.preventDefault();
    clearFieldErrors('signin');
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;

    let valid = true;
    if (!email) { setFieldError('signin-email-err', 'Email is required.'); valid = false; }
    if (!password) { setFieldError('signin-password-err', 'Password is required.'); valid = false; }
    if (!valid) return;

    const result = Auth.signIn(email, password);
    if (!result.ok) {
        showAuthError('signin', result.error);
        return;
    }
    enterApp(result.user);
});

document.getElementById('signup-form').addEventListener('submit', e => {
    e.preventDefault();
    clearFieldErrors('signup');
    const firstName = document.getElementById('signup-firstname').value.trim();
    const lastName = document.getElementById('signup-lastname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    let valid = true;
    if (!firstName) { setFieldError('signup-firstname-err', 'Required.'); valid = false; }
    if (!lastName) { setFieldError('signup-lastname-err', 'Required.'); valid = false; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setFieldError('signup-email-err', 'Enter a valid email.'); valid = false; }
    if (!password || password.length < 6) { setFieldError('signup-password-err', 'Minimum 6 characters.'); valid = false; }
    if (!valid) return;

    const result = Auth.signUp(firstName, lastName, email, password);
    if (!result.ok) {
        showAuthError('signup', result.error);
        return;
    }
    enterApp(result.user);
});

// ── App entry / exit ─────────────────────────────────────────

function enterApp(user) {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    populateUserUI(user);
    loadLogoForUser();

    // Re-init db for this user's namespace
    db.setUserNamespace(user.id);
    loadDashboard();
}

function populateUserUI(user) {
    const initials = ((user.firstName || '')[0] || '') + ((user.lastName || '')[0] || '');
    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;

    document.getElementById('sidebar-avatar').textContent = initials.toUpperCase() || 'U';
    document.getElementById('sidebar-name').textContent = fullName;
    document.getElementById('sidebar-email').textContent = user.email;

    // Account page
    document.getElementById('account-avatar-display').textContent = initials.toUpperCase() || 'U';
    document.getElementById('account-fullname-display').textContent = fullName;
    document.getElementById('account-email-display').textContent = user.email;

    document.getElementById('profile-firstname').value = user.firstName || '';
    document.getElementById('profile-lastname').value = user.lastName || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-business').value = user.business || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-address').value = user.address || '';

    const since = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long' }) : '—';
    document.getElementById('account-since').textContent = since;
}

function logout() {
    Auth.clearSession();
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'flex';
    showSignin();
    document.getElementById('signin-form').reset();
}

// ── Logo upload ──────────────────────────────────────────────

const LOGO_KEY_PREFIX = 'crm_logo_';

function getLogoKey() {
    const user = Auth.getCurrentUser();
    return user ? `${LOGO_KEY_PREFIX}${user.id}` : null;
}

function getLogoDataUrl() {
    const key = getLogoKey();
    return key ? localStorage.getItem(key) : null;
}

function saveLogo(dataUrl) {
    const key = getLogoKey();
    if (!key) return;
    localStorage.setItem(key, dataUrl);
    applyLogoToUI(dataUrl);
}

function removeLogo() {
    const key = getLogoKey();
    if (key) localStorage.removeItem(key);
    applyLogoToUI(null);
    showToast('Logo removed.');
}

function applyLogoToUI(dataUrl) {
    const preview      = document.getElementById('logo-preview');
    const placeholder  = document.getElementById('logo-placeholder');
    const actions      = document.getElementById('logo-upload-actions');
    const sidebarSvg   = document.getElementById('sidebar-logo-svg');
    const sidebarImg   = document.getElementById('sidebar-logo-img');

    if (dataUrl) {
        preview.src              = dataUrl;
        preview.style.display    = 'block';
        placeholder.style.display = 'none';
        actions.style.display    = 'flex';

        sidebarImg.src           = dataUrl;
        sidebarImg.style.display = 'block';
        sidebarSvg.style.display = 'none';
    } else {
        preview.src              = '';
        preview.style.display    = 'none';
        placeholder.style.display = 'flex';
        actions.style.display    = 'none';

        sidebarImg.style.display = 'none';
        sidebarSvg.style.display = 'block';
    }
}

function loadLogoForUser() {
    applyLogoToUI(getLogoDataUrl());
}

// File input handler
document.getElementById('logo-file-input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast('Logo must be under 2 MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        saveLogo(e.target.result);
        showToast('Logo saved.');
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected if removed
    this.value = '';
});

// Drag-and-drop support
(function initLogoDragDrop() {
    const area = document.getElementById('logo-upload-area');
    if (!area) return;

    area.addEventListener('dragover', e => {
        e.preventDefault();
        area.classList.add('drag-over');
    });

    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));

    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please drop an image file.', 'warn');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('Logo must be under 2 MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
            saveLogo(ev.target.result);
            showToast('Logo saved.');
        };
        reader.readAsDataURL(file);
    });
})();

// ── Profile form ─────────────────────────────────────────────

document.getElementById('profile-form').addEventListener('submit', e => {
    e.preventDefault();
    const user = Auth.getCurrentUser();
    if (!user) return;

    const updated = {
        id: user.id,
        firstName: document.getElementById('profile-firstname').value.trim(),
        lastName: document.getElementById('profile-lastname').value.trim(),
        email: document.getElementById('profile-email').value.trim(),
        business: document.getElementById('profile-business').value.trim(),
        phone: document.getElementById('profile-phone').value.trim(),
        address: document.getElementById('profile-address').value.trim()
    };

    const result = Auth.updateProfile(updated);
    if (result.ok) {
        populateUserUI(result.user);
        showToast('Profile updated successfully.');
    }
});

// ── Auto-login on load ────────────────────────────────────────

(function init() {
    const user = Auth.getCurrentUser();
    if (user) {
        enterApp(user);
    }
})();
