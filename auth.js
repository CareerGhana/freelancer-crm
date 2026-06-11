// ============================================================
// Auth — Supabase Auth
// ============================================================

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

function setAuthLoading(prefix, loading) {
    const btn = document.querySelector(`#${prefix}-form .btn-auth`);
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = loading
        ? 'Please wait...'
        : prefix === 'signin' ? 'Sign In' : 'Create Account';
}

// ── Sign In ──────────────────────────────────────────────────

document.getElementById('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('signin');

    const email    = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    let valid = true;
    if (!email)    { setFieldError('signin-email-err',    'Email is required.');    valid = false; }
    if (!password) { setFieldError('signin-password-err', 'Password is required.'); valid = false; }
    if (!valid) return;

    setAuthLoading('signin', true);

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    setAuthLoading('signin', false);

    if (error) {
        showAuthError('signin', error.message);
        return;
    }

    await enterApp(data.user);
});

// ── Sign Up ──────────────────────────────────────────────────

document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('signup');

    const firstName = document.getElementById('signup-firstname').value.trim();
    const lastName  = document.getElementById('signup-lastname').value.trim();
    const email     = document.getElementById('signup-email').value.trim();
    const password  = document.getElementById('signup-password').value;

    let valid = true;
    if (!firstName)                          { setFieldError('signup-firstname-err', 'Required.');                 valid = false; }
    if (!lastName)                           { setFieldError('signup-lastname-err',  'Required.');                 valid = false; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setFieldError('signup-email-err',  'Enter a valid email.');      valid = false; }
    if (!password || password.length < 6)    { setFieldError('signup-password-err', 'Minimum 6 characters.');     valid = false; }
    if (!valid) return;

    setAuthLoading('signup', true);

    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
            data: { first_name: firstName, last_name: lastName }
        }
    });

    setAuthLoading('signup', false);

    if (error) {
        showAuthError('signup', error.message);
        return;
    }

    // Supabase may require email confirmation depending on your settings.
    // If email confirmation is OFF, data.user is set immediately.
    if (data.user && data.session) {
        await enterApp(data.user);
    } else {
        // Email confirmation required
        document.getElementById('signup-error').style.display = 'block';
        document.getElementById('signup-error').style.background = '#d1fae5';
        document.getElementById('signup-error').style.color = '#065f46';
        document.getElementById('signup-error').style.borderColor = '#6ee7b7';
        document.getElementById('signup-error').textContent =
            'Account created! Check your email to confirm your address, then sign in.';
        showSignin();
    }
});

// ── App entry / exit ─────────────────────────────────────────

async function enterApp(supabaseUser) {
    // Fetch profile from DB
    const { data: profile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

    // Merge auth user + profile into one object the UI uses
    const user = {
        id:        supabaseUser.id,
        email:     supabaseUser.email,
        firstName: profile?.first_name || supabaseUser.user_metadata?.first_name || '',
        lastName:  profile?.last_name  || supabaseUser.user_metadata?.last_name  || '',
        business:  profile?.business   || '',
        phone:     profile?.phone      || '',
        address:   profile?.address    || '',
        createdAt: supabaseUser.created_at
    };

    // Cache lightweight session info (no password, no tokens)
    sessionStorage.setItem('crm_user', JSON.stringify(user));

    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    populateUserUI(user);
    loadLogoForUser(user.id);

    // Init DB layer for this user
    db.setUser(user);
    await loadDashboard();
}

function getCurrentUser() {
    try {
        return JSON.parse(sessionStorage.getItem('crm_user'));
    } catch {
        return null;
    }
}

function populateUserUI(user) {
    const initials = ((user.firstName || '')[0] || '') + ((user.lastName || '')[0] || '');
    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;

    document.getElementById('sidebar-avatar').textContent         = initials.toUpperCase() || 'U';
    document.getElementById('sidebar-name').textContent           = fullName;
    document.getElementById('sidebar-email').textContent          = user.email;
    document.getElementById('account-avatar-display').textContent = initials.toUpperCase() || 'U';
    document.getElementById('account-fullname-display').textContent = fullName;
    document.getElementById('account-email-display').textContent  = user.email;

    document.getElementById('profile-firstname').value = user.firstName;
    document.getElementById('profile-lastname').value  = user.lastName;
    document.getElementById('profile-email').value     = user.email;
    document.getElementById('profile-business').value  = user.business;
    document.getElementById('profile-phone').value     = user.phone;
    document.getElementById('profile-address').value   = user.address;

    const since = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : '—';
    document.getElementById('account-since').textContent = since;
}

async function logout() {
    await sb.auth.signOut();
    sessionStorage.removeItem('crm_user');
    document.getElementById('app').style.display          = 'none';
    document.getElementById('auth-overlay').style.display = 'flex';
    showSignin();
    document.getElementById('signin-form').reset();
    applyLogoToUI(null);
}

// ── Profile form ─────────────────────────────────────────────

document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const updates = {
        first_name: document.getElementById('profile-firstname').value.trim(),
        last_name:  document.getElementById('profile-lastname').value.trim(),
        business:   document.getElementById('profile-business').value.trim(),
        phone:      document.getElementById('profile-phone').value.trim(),
        address:    document.getElementById('profile-address').value.trim(),
    };

    const { error } = await sb.from('profiles').update(updates).eq('id', user.id);

    if (error) {
        showToast('Failed to save profile.', 'error');
        return;
    }

    // Update session cache
    const updated = {
        ...user,
        firstName: updates.first_name,
        lastName:  updates.last_name,
        business:  updates.business,
        phone:     updates.phone,
        address:   updates.address
    };
    sessionStorage.setItem('crm_user', JSON.stringify(updated));
    populateUserUI(updated);
    showToast('Profile updated.');
});

// ── Logo — stored in localStorage keyed by user id ───────────
// (For production use Supabase Storage instead)

function getLogoDataUrl(userId) {
    return localStorage.getItem(`crm_logo_${userId || getCurrentUser()?.id}`);
}

function saveLogo(dataUrl) {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.setItem(`crm_logo_${user.id}`, dataUrl);
    applyLogoToUI(dataUrl);
}

function removeLogo() {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.removeItem(`crm_logo_${user.id}`);
    applyLogoToUI(null);
    showToast('Logo removed.');
}

function loadLogoForUser(userId) {
    applyLogoToUI(getLogoDataUrl(userId));
}

function applyLogoToUI(dataUrl) {
    const preview     = document.getElementById('logo-preview');
    const placeholder = document.getElementById('logo-placeholder');
    const actions     = document.getElementById('logo-upload-actions');
    const sidebarSvg  = document.getElementById('sidebar-logo-svg');
    const sidebarImg  = document.getElementById('sidebar-logo-img');
    if (!preview) return;

    if (dataUrl) {
        preview.src               = dataUrl;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
        actions.style.display     = 'flex';
        sidebarImg.src            = dataUrl;
        sidebarImg.style.display  = 'block';
        sidebarSvg.style.display  = 'none';
    } else {
        preview.src               = '';
        preview.style.display     = 'none';
        placeholder.style.display = 'flex';
        actions.style.display     = 'none';
        sidebarImg.style.display  = 'none';
        sidebarSvg.style.display  = 'block';
    }
}

document.getElementById('logo-file-input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2 MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => { saveLogo(e.target.result); showToast('Logo saved.'); };
    reader.readAsDataURL(file);
    this.value = '';
});

(function initLogoDragDrop() {
    const area = document.getElementById('logo-upload-area');
    if (!area) return;
    area.addEventListener('dragover',  e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) { showToast('Please drop an image file.', 'warn'); return; }
        if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2 MB.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = ev => { saveLogo(ev.target.result); showToast('Logo saved.'); };
        reader.readAsDataURL(file);
    });
})();

// ── Auto-restore session on load ─────────────────────────────

(async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
        await enterApp(session.user);
    }
})();
