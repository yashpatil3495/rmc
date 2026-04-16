/* =============================================
   AUTHENTICATION
   Super admin: hardcoded credentials
   Representative admins: from Firebase
   5-attempt lockout (resets on page reload).
   ============================================= */

const ADMIN_USER = 'rmc_admin';
const ADMIN_PASS = 'RMC@2026';
let failedAttempts = 0;
const MAX_ATTEMPTS = 5;
let currentAdminRole = null; // 'super' or 'representative'
let currentAdminName = '';

function checkSession() {
    const session = sessionStorage.getItem('rmc_admin_session');
    const role = sessionStorage.getItem('rmc_admin_role');
    const name = sessionStorage.getItem('rmc_admin_name');
    if (session === 'active') {
        currentAdminRole = role || 'super';
        currentAdminName = name || 'rmc_admin';
        showDashboard();
    }
}

async function attemptLogin() {
    if (failedAttempts >= MAX_ATTEMPTS) return;

    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');

    // Check super admin
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        currentAdminRole = 'super';
        currentAdminName = 'rmc_admin';
        sessionStorage.setItem('rmc_admin_session', 'active');
        sessionStorage.setItem('rmc_admin_role', 'super');
        sessionStorage.setItem('rmc_admin_name', 'rmc_admin');
        showDashboard();
        return;
    }

    // Check approved representative admins
    const approved = await fbGet('rmc_approved_admins');
    if (approved) {
        const admins = Array.isArray(approved) ? approved : Object.values(approved);
        const match = admins.find(a => a.email === user && a.password === pass);
        if (match) {
            currentAdminRole = 'representative';
            currentAdminName = match.name;
            sessionStorage.setItem('rmc_admin_session', 'active');
            sessionStorage.setItem('rmc_admin_role', 'representative');
            sessionStorage.setItem('rmc_admin_name', match.name);
            showDashboard();
            return;
        }
    }

    // Failed
    failedAttempts++;
    const remaining = MAX_ATTEMPTS - failedAttempts;

    if (failedAttempts >= MAX_ATTEMPTS) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('lockoutMsg').style.display = 'block';
    } else {
        errorEl.textContent = `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
        errorEl.classList.remove('shake');
        void errorEl.offsetWidth;
        errorEl.classList.add('shake');
    }
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('dashUserName').textContent = currentAdminName;

    // Show Admin Users tab only for super admin
    if (currentAdminRole === 'super') {
        document.getElementById('adminUsersTab').style.display = '';
    } else {
        document.getElementById('adminUsersTab').style.display = 'none';
    }

    refreshAll();
}

function logout() {
    sessionStorage.removeItem('rmc_admin_session');
    sessionStorage.removeItem('rmc_admin_role');
    sessionStorage.removeItem('rmc_admin_name');
    location.reload();
}

document.getElementById('loginPass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') attemptLogin();
});
document.getElementById('loginUser').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('loginPass').focus();
});

/* =============================================
   ADMIN SIGN-UP
   ============================================= */

function toggleSignupForm() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (signupForm.style.display === 'none') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    } else {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
    }
}

async function submitAdminSignup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const pass = document.getElementById('signupPass').value;
    const reason = document.getElementById('signupReason').value.trim();
    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');

    errorEl.textContent = '';
    successEl.style.display = 'none';

    if (!name || !email || !pass) {
        errorEl.textContent = 'Name, email, and password are required.';
        return;
    }

    if (pass.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        return;
    }

    const request = {
        id: generateId(),
        name: name,
        email: email,
        password: pass,
        reason: reason || 'No reason provided',
        status: 'pending',
        submittedAt: new Date().toISOString(),
        reviewedAt: null
    };

    await fbSet('rmc_admin_requests/' + request.id, request);
    successEl.style.display = 'block';

    // Clear form
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPass').value = '';
    document.getElementById('signupReason').value = '';
}

/* =============================================
   TAB NAVIGATION
   ============================================= */

function switchTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'panel-' + tabId);
    });

    if (tabId === 'csv') {
        populateEventDropdown();
        loadParticipantData();
    } else if (tabId === 'stats') {
        renderStats();
    } else if (tabId === 'announce') {
        loadAnnouncementForm();
    } else if (tabId === 'members') {
        renderMembersTable();
    } else if (tabId === 'cert') {
        loadCertConfig();
        renderCertPreview();
    } else if (tabId === 'registrations') {
        populateRegEventDropdown();
        loadRegistrations();
    } else if (tabId === 'adminusers') {
        loadAdminRequests();
        loadApprovedAdmins();
    }
}

/* =============================================
   EVENTS MANAGER (Tab A)
   ============================================= */

async function getEvents() {
    const data = await fbGet('rmc_events');
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
}

async function setEvents(events) {
    await fbSet('rmc_events', events);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function saveEvent(e) {
    e.preventDefault();

    const eventObj = {
        id: document.getElementById('editingEventId').value || generateId(),
        name: document.getElementById('evName').value.trim(),
        date: document.getElementById('evDate').value,
        description: document.getElementById('evDesc').value.trim(),
        registrationLink: document.getElementById('evLink').value.trim(),
        deadline: document.getElementById('evDeadline').value,
        maxParticipants: document.getElementById('evMaxPart').value ? parseInt(document.getElementById('evMaxPart').value) : null,
        status: document.getElementById('evStatus').value,
        posterUrl: document.getElementById('evPoster').value.trim(),
        createdAt: new Date().toISOString()
    };

    const events = await getEvents();
    const editId = document.getElementById('editingEventId').value;

    if (editId) {
        const idx = events.findIndex(ev => ev.id === editId);
        if (idx !== -1) {
            eventObj.createdAt = events[idx].createdAt;
            events[idx] = eventObj;
        }
        showToast('Event updated successfully!', 'success');
    } else {
        events.push(eventObj);
        showToast('Event created successfully!', 'success');
    }

    await setEvents(events);
    resetEventForm();
    await renderEventsTable();
}

async function editEvent(id) {
    const events = await getEvents();
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('evName').value = ev.name;
    document.getElementById('evDate').value = ev.date;
    document.getElementById('evDesc').value = ev.description;
    document.getElementById('evLink').value = ev.registrationLink || '';
    document.getElementById('evDeadline').value = ev.deadline || '';
    document.getElementById('evMaxPart').value = ev.maxParticipants || '';
    document.getElementById('evStatus').value = ev.status;
    document.getElementById('evPoster').value = ev.posterUrl || '';
    document.getElementById('editingEventId').value = ev.id;

    document.getElementById('formTitle').textContent = 'EDIT EVENT';
    document.getElementById('saveEventBtn').innerHTML = '<i class="bx bx-save"></i> Update Event';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.getElementById('panel-events').scrollIntoView({ behavior: 'smooth' });
}

function deleteEvent(id) {
    showModal('Delete Event', 'Are you sure you want to delete this event? This cannot be undone.', async () => {
        let events = await getEvents();
        events = events.filter(ev => ev.id !== id);
        await setEvents(events);
        await renderEventsTable();
        showToast('Event deleted.', 'error');
    });
}

function cancelEdit() {
    resetEventForm();
}

function resetEventForm() {
    document.getElementById('eventForm').reset();
    document.getElementById('editingEventId').value = '';
    document.getElementById('formTitle').textContent = 'CREATE NEW EVENT';
    document.getElementById('saveEventBtn').innerHTML = '<i class="bx bx-plus"></i> Save Event';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

async function renderEventsTable() {
    const events = await getEvents();
    const tbody = document.getElementById('eventsTableBody');
    const emptyMsg = document.getElementById('noEventsMsg');

    if (events.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = events.map(ev => {
        const statusClass = ev.status === 'Registration Open' ? 'open'
                          : ev.status === 'Registration Closed' ? 'closed'
                          : 'completed';
        const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const deadlineStr = ev.deadline ? new Date(ev.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

        return `
            <tr>
                <td title="${escapeHtml(ev.name)}">${escapeHtml(ev.name)}</td>
                <td>${dateStr}</td>
                <td><span class="status-badge ${statusClass}">${ev.status}</span></td>
                <td>${deadlineStr}</td>
                <td>${ev.maxParticipants || '—'}</td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn" onclick="editEvent('${ev.id}')" title="Edit">
                            <i class='bx bx-edit-alt'></i> Edit
                        </button>
                        <button class="delete-btn" onclick="deleteEvent('${ev.id}')" title="Delete">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/* =============================================
   REGISTRATION MANAGEMENT
   ============================================= */

let currentRegFilter = 'all';
let allRegistrations = [];

async function populateRegEventDropdown() {
    const events = await getEvents();
    const select = document.getElementById('regEventSelect');
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- Select an Event --</option>';
    events.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.name;
        opt.textContent = `${ev.name} (${ev.date || ''})`;
        select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
}

async function loadRegistrations() {
    const eventName = document.getElementById('regEventSelect').value;
    const dataPanel = document.getElementById('regDataPanel');

    if (!eventName) {
        dataPanel.style.display = 'none';
        return;
    }

    const safeName = eventName.replace(/[.#$[\]]/g, '_');
    const data = await fbGet('rmc_registrations/' + safeName);

    if (!data) {
        allRegistrations = [];
        dataPanel.style.display = 'block';
        renderRegistrationsTable();
        return;
    }

    allRegistrations = Object.values(data);
    dataPanel.style.display = 'block';
    renderRegistrationsTable();
    updateRegBadge();
}

function filterRegistrations(filter, btn) {
    currentRegFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderRegistrationsTable();
}

function renderRegistrationsTable() {
    const tbody = document.getElementById('regTableBody');
    const emptyMsg = document.getElementById('noRegsMsg');
    const countEl = document.getElementById('regCount');

    let filtered = allRegistrations;
    if (currentRegFilter !== 'all') {
        filtered = allRegistrations.filter(r => r.status === currentRegFilter);
    }

    countEl.textContent = `(${filtered.length} of ${allRegistrations.length})`;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    tbody.innerHTML = filtered.map(reg => {
        const statusClass = reg.status || 'pending';
        const statusText = reg.status ? reg.status.charAt(0).toUpperCase() + reg.status.slice(1) : 'Pending';

        let actionBtns = '';
        if (reg.status === 'pending') {
            actionBtns = `
                <button class="accept-btn" onclick="acceptRegistration('${reg.id}')" title="Accept & Send Ticket">
                    <i class='bx bx-check'></i> Accept
                </button>
                <button class="reject-btn" onclick="rejectRegistration('${reg.id}')" title="Reject">
                    <i class='bx bx-x'></i> Reject
                </button>
            `;
        } else if (reg.status === 'accepted') {
            actionBtns = `<span style="color:#66bb6a;font-size:11px;">Ticket: ${reg.ticketId || 'N/A'}</span>`;
        } else {
            actionBtns = `<span style="color:#ef5350;font-size:11px;">Rejected</span>`;
        }

        actionBtns += `
            <button class="delete-btn" onclick="deleteRegistration('${reg.id}')" title="Delete" style="margin-left:4px;">
                <i class='bx bx-trash'></i>
            </button>
        `;

        return `
            <tr>
                <td>${escapeHtml(reg.name)}</td>
                <td>${escapeHtml(reg.email)}</td>
                <td>${escapeHtml(reg.mobile)}</td>
                <td>${escapeHtml(reg.rbt)}</td>
                <td>${escapeHtml(reg.department || '—')}</td>
                <td>${escapeHtml(reg.year || '—')}</td>
                <td>${reg.groupSize || 1}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><div class="table-actions">${actionBtns}</div></td>
            </tr>
        `;
    }).join('');
}

async function acceptRegistration(regId) {
    const eventName = document.getElementById('regEventSelect').value;
    if (!eventName) return;

    const safeName = eventName.replace(/[.#$[\]]/g, '_');
    const reg = allRegistrations.find(r => r.id === regId);
    if (!reg) return;

    showModal('Accept Registration', `Accept ${reg.name}'s registration and send a ticket email to ${reg.email}?`, async () => {
        const ticketId = generateTicketId();

        // Update status in Firebase
        await fbSet('rmc_registrations/' + safeName + '/' + regId + '/status', 'accepted');
        await fbSet('rmc_registrations/' + safeName + '/' + regId + '/ticketId', ticketId);
        await fbSet('rmc_registrations/' + safeName + '/' + regId + '/reviewedAt', new Date().toISOString());

        // Get event data for email
        const events = await getEvents();
        const eventData = events.find(e => e.name === eventName) || { name: eventName };

        // Send ticket email
        const emailResult = await sendTicketEmail(
            { ...reg, ticketId },
            eventData
        );

        if (emailResult.simulated) {
            showToast(`Accepted! Ticket: ${ticketId} (EmailJS not configured — email skipped)`, 'success');
        } else if (emailResult.success) {
            showToast(`Accepted! Ticket email sent to ${reg.email}`, 'success');
        } else {
            showToast(`Accepted with ticket ${ticketId}, but email failed: ${emailResult.error}`, 'error');
        }

        await loadRegistrations();
    });
}

async function rejectRegistration(regId) {
    const eventName = document.getElementById('regEventSelect').value;
    if (!eventName) return;

    const safeName = eventName.replace(/[.#$[\]]/g, '_');
    const reg = allRegistrations.find(r => r.id === regId);
    if (!reg) return;

    showModal('Reject Registration', `Reject ${reg.name}'s registration?`, async () => {
        await fbSet('rmc_registrations/' + safeName + '/' + regId + '/status', 'rejected');
        await fbSet('rmc_registrations/' + safeName + '/' + regId + '/reviewedAt', new Date().toISOString());
        showToast('Registration rejected.', 'error');
        await loadRegistrations();
    });
}

async function deleteRegistration(regId) {
    const eventName = document.getElementById('regEventSelect').value;
    if (!eventName) return;

    const safeName = eventName.replace(/[.#$[\]]/g, '_');

    showModal('Delete Registration', 'Remove this registration permanently?', async () => {
        await fbRemove('rmc_registrations/' + safeName + '/' + regId);
        showToast('Registration deleted.', 'error');
        await loadRegistrations();
    });
}

async function updateRegBadge() {
    // Count all pending registrations across all events
    const allRegs = await fbGet('rmc_registrations');
    let pendingCount = 0;

    if (allRegs) {
        Object.values(allRegs).forEach(eventRegs => {
            if (eventRegs && typeof eventRegs === 'object') {
                Object.values(eventRegs).forEach(reg => {
                    if (reg && reg.status === 'pending') pendingCount++;
                });
            }
        });
    }

    const badge = document.getElementById('regBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

/* =============================================
   ADMIN USERS MANAGEMENT (Super Admin Only)
   ============================================= */

async function loadAdminRequests() {
    const data = await fbGet('rmc_admin_requests');
    const tbody = document.getElementById('adminRequestsBody');
    const emptyMsg = document.getElementById('noAdminReqsMsg');

    if (!data) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    const requests = Object.values(data);
    if (requests.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    tbody.innerHTML = requests.map(req => {
        const statusClass = req.status || 'pending';
        const statusText = req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending';
        const dateStr = req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

        let actionBtns = '';
        if (req.status === 'pending') {
            actionBtns = `
                <button class="accept-btn" onclick="approveAdmin('${req.id}')">
                    <i class='bx bx-check'></i> Approve
                </button>
                <button class="reject-btn" onclick="rejectAdmin('${req.id}')">
                    <i class='bx bx-x'></i> Reject
                </button>
            `;
        } else {
            actionBtns = `<span style="font-size:11px;color:rgba(255,255,255,0.3);">${statusText}</span>`;
        }

        actionBtns += `
            <button class="delete-btn" onclick="deleteAdminRequest('${req.id}')" style="margin-left:4px;">
                <i class='bx bx-trash'></i>
            </button>
        `;

        return `
            <tr>
                <td>${escapeHtml(req.name)}</td>
                <td>${escapeHtml(req.email)}</td>
                <td>${escapeHtml(req.reason || '—')}</td>
                <td>${dateStr}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><div class="table-actions">${actionBtns}</div></td>
            </tr>
        `;
    }).join('');

    // Update admin badge
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('adminBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

async function approveAdmin(reqId) {
    const data = await fbGet('rmc_admin_requests/' + reqId);
    if (!data) return;

    showModal('Approve Admin', `Grant admin access to ${data.name} (${data.email})?`, async () => {
        // Add to approved admins
        const admin = {
            id: data.id,
            name: data.name,
            email: data.email,
            password: data.password,
            role: 'representative',
            approvedAt: new Date().toISOString()
        };
        await fbSet('rmc_approved_admins/' + admin.id, admin);

        // Update request status
        await fbSet('rmc_admin_requests/' + reqId + '/status', 'approved');
        await fbSet('rmc_admin_requests/' + reqId + '/reviewedAt', new Date().toISOString());

        // Send approval email
        const emailResult = await sendAdminApprovalEmail(data);
        if (emailResult.simulated) {
            showToast(`${data.name} approved! (EmailJS not configured — email skipped)`, 'success');
        } else if (emailResult.success) {
            showToast(`${data.name} approved! Notification email sent.`, 'success');
        } else {
            showToast(`${data.name} approved, but email failed.`, 'success');
        }

        await loadAdminRequests();
        await loadApprovedAdmins();
    });
}

async function rejectAdmin(reqId) {
    showModal('Reject Admin', 'Reject this admin access request?', async () => {
        await fbSet('rmc_admin_requests/' + reqId + '/status', 'rejected');
        await fbSet('rmc_admin_requests/' + reqId + '/reviewedAt', new Date().toISOString());
        showToast('Admin request rejected.', 'error');
        await loadAdminRequests();
    });
}

async function deleteAdminRequest(reqId) {
    showModal('Delete Request', 'Remove this admin request permanently?', async () => {
        await fbRemove('rmc_admin_requests/' + reqId);
        showToast('Request deleted.', 'error');
        await loadAdminRequests();
    });
}

async function loadApprovedAdmins() {
    const data = await fbGet('rmc_approved_admins');
    const tbody = document.getElementById('approvedAdminsBody');
    const emptyMsg = document.getElementById('noApprovedMsg');

    if (!data) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    const admins = Object.values(data);
    if (admins.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    tbody.innerHTML = admins.map(admin => {
        const dateStr = admin.approvedAt ? new Date(admin.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        return `
            <tr>
                <td>${escapeHtml(admin.name)}</td>
                <td>${escapeHtml(admin.email)}</td>
                <td>${dateStr}</td>
                <td>
                    <div class="table-actions">
                        <button class="delete-btn" onclick="revokeAdmin('${admin.id}')" title="Revoke Access">
                            <i class='bx bx-user-minus'></i> Revoke
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function revokeAdmin(adminId) {
    showModal('Revoke Access', 'Remove this admin\'s access to the panel?', async () => {
        await fbRemove('rmc_approved_admins/' + adminId);
        showToast('Admin access revoked.', 'error');
        await loadApprovedAdmins();
    });
}

/* =============================================
   CSV UPLOAD & PARTICIPANT VIEWER (Tab B)
   ============================================= */

async function populateEventDropdown() {
    const events = await getEvents();
    const select = document.getElementById('csvEventSelect');
    const currentVal = select.value;

    select.innerHTML = '<option value="">— Select an Event —</option>';

    events.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.name;
        opt.textContent = `${ev.name} (${ev.date})`;
        select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
}

function parseCSV(csvText) {
    const result = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (i < csvText.length) {
        const char = csvText[i];

        if (insideQuotes) {
            if (char === '"') {
                if (i + 1 < csvText.length && csvText[i + 1] === '"') {
                    currentField += '"';
                    i += 2;
                } else {
                    insideQuotes = false;
                    i++;
                }
            } else {
                currentField += char;
                i++;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
                i++;
            } else if (char === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
                i++;
            } else if (char === '\n') {
                currentRow.push(currentField.trim());
                if (currentRow.some(f => f !== '')) {
                    result.push(currentRow);
                }
                currentRow = [];
                currentField = '';
                i++;
            } else {
                currentField += char;
                i++;
            }
        }
    }

    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
        result.push(currentRow);
    }

    if (result.length === 0) return { headers: [], rows: [] };

    return {
        headers: result[0],
        rows: result.slice(1)
    };
}

function handleCSVUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const eventName = document.getElementById('csvEventSelect').value;
    if (!eventName) {
        showToast('Please select an event first!', 'error');
        input.value = '';
        return;
    }

    if (!file.name.endsWith('.csv')) {
        showToast('Please upload a .csv file.', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const csvText = e.target.result;
        const parsed = parseCSV(csvText);

        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
            showToast('CSV file is empty or invalid.', 'error');
            return;
        }

        const safeName = eventName.replace(/[.#$[\]]/g, '_');
        const fbPath = 'rmc_participants/' + safeName;
        const dataObj = {
            headers: parsed.headers,
            rows: parsed.rows,
            uploadedAt: new Date().toISOString(),
            fileName: file.name
        };

        await fbSet(fbPath, dataObj);
        showToast(`Uploaded ${parsed.rows.length} participants for "${eventName}"!`, 'success');
        await loadParticipantData();
    };

    reader.readAsText(file);
    input.value = '';
}

async function loadParticipantData() {
    const eventName = document.getElementById('csvEventSelect').value;
    const dataPanel = document.getElementById('csvDataPanel');

    if (!eventName) {
        dataPanel.style.display = 'none';
        return;
    }

    const safeName = eventName.replace(/[.#$[\]]/g, '_');
    const fbPath = 'rmc_participants/' + safeName;
    const data = await fbGet(fbPath);

    if (!data) {
        dataPanel.style.display = 'none';
        return;
    }

    try {
        // Firebase may convert arrays to objects — normalize rows
        let rows = data.rows;
        if (rows && !Array.isArray(rows)) {
            rows = Object.values(rows);
        }
        if (rows) {
            rows = rows.map(row => Array.isArray(row) ? row : Object.values(row));
        }
        let headers = data.headers;
        if (headers && !Array.isArray(headers)) {
            headers = Object.values(headers);
        }
        renderCSVTable(headers, rows);
        renderCSVSummary(headers, rows);
        dataPanel.style.display = 'block';
    } catch {
        dataPanel.style.display = 'none';
    }
}

function renderCSVTable(headers, rows) {
    const thead = document.getElementById('csvTableHead');
    const tbody = document.getElementById('csvTableBody');

    thead.innerHTML = '<tr>' + headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows.map(row =>
        '<tr>' + row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') + '</tr>'
    ).join('');
}

function renderCSVSummary(headers, rows) {
    const summary = document.getElementById('csvSummary');
    const total = rows.length;

    const mobileIdx = headers.findIndex(h =>
        /mobile|phone|contact|cell/i.test(h)
    );

    let uniqueCount = total;
    if (mobileIdx !== -1) {
        const uniqueNumbers = new Set(rows.map(r => (r[mobileIdx] || '').trim()).filter(Boolean));
        uniqueCount = uniqueNumbers.size;
    }

    summary.innerHTML = `
        <div class="csv-summary-item">
            <span class="value">${total}</span>
            <span class="label">Total Participants</span>
        </div>
        <div class="csv-summary-item">
            <span class="value">${uniqueCount}</span>
            <span class="label">Unique Entries${mobileIdx !== -1 ? ' (by Mobile)' : ''}</span>
        </div>
    `;
}

async function exportJSON() {
    const eventName = document.getElementById('csvEventSelect').value;
    if (!eventName) {
        showToast('No event selected.', 'error');
        return;
    }

    const safeName = eventName.replace(/[.#$[\]]/g, '_');
    const fbPath = 'rmc_participants/' + safeName;
    const data = await fbGet(fbPath);

    if (!data) {
        showToast('No participant data to export.', 'error');
        return;
    }

    try {
        let rows = data.rows;
        if (rows && !Array.isArray(rows)) rows = Object.values(rows);
        if (rows) rows = rows.map(row => Array.isArray(row) ? row : Object.values(row));
        let headers = data.headers;
        if (headers && !Array.isArray(headers)) headers = Object.values(headers);

        const participants = rows.map(row => {
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = row[i] || '';
            });
            return obj;
        });

        const exportObj = {
            event: eventName,
            exported_at: new Date().toISOString(),
            participants: participants
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rmc_${eventName.replace(/\s+/g, '_').toLowerCase()}_participants.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('JSON exported successfully!', 'success');
    } catch {
        showToast('Error exporting data.', 'error');
    }
}

function confirmClearParticipants() {
    const eventName = document.getElementById('csvEventSelect').value;
    if (!eventName) return;

    showModal('Clear Data', `Delete all participant data for "${eventName}"? This cannot be undone.`, async () => {
        const safeName = eventName.replace(/[.#$[\]]/g, '_');
        await fbRemove('rmc_participants/' + safeName);
        await loadParticipantData();
        showToast('Participant data cleared.', 'error');
    });
}

const dropZone = document.getElementById('csvDropZone');
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const input = document.getElementById('csvFileInput');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleCSVUpload(input);
        }
    });
}

/* =============================================
   STATS OVERVIEW (Tab C)
   ============================================= */

async function renderStats() {
    const allParticipants = await fbGet('rmc_participants');

    const statsCards = document.getElementById('statsCards');
    const breakdownBody = document.getElementById('breakdownBody');
    const noStatsMsg = document.getElementById('noStatsMsg');
    const breakdownTable = document.getElementById('breakdownTable');

    if (!allParticipants || Object.keys(allParticipants).length === 0) {
        statsCards.innerHTML = '';
        breakdownBody.innerHTML = '';
        noStatsMsg.style.display = 'block';
        breakdownTable.style.display = 'none';
        return;
    }

    noStatsMsg.style.display = 'none';
    breakdownTable.style.display = '';

    let totalEvents = 0;
    let totalParticipants = 0;
    const breakdownRows = [];

    const keys = Object.keys(allParticipants);
    keys.forEach(key => {
        try {
            const data = allParticipants[key];
            const eventName = key;
            let rows = data.rows;
            if (rows && !Array.isArray(rows)) rows = Object.values(rows);
            const count = rows ? rows.length : 0;
            const uploadDate = data.uploadedAt
                ? new Date(data.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';

            totalEvents++;
            totalParticipants += count;
            breakdownRows.push({ name: eventName, count, uploadDate });
        } catch {
            // Skip corrupt data
        }
    });

    statsCards.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon"><i class='bx bx-calendar-check'></i></div>
            <div class="stat-value">${totalEvents}</div>
            <div class="stat-title">Events with Data</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class='bx bx-group'></i></div>
            <div class="stat-value">${totalParticipants}</div>
            <div class="stat-title">Total Participants</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class='bx bx-calculator'></i></div>
            <div class="stat-value">${totalEvents > 0 ? Math.round(totalParticipants / totalEvents) : 0}</div>
            <div class="stat-title">Avg per Event</div>
        </div>
    `;

    breakdownBody.innerHTML = breakdownRows.map(r => `
        <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.count}</td>
            <td>${r.uploadDate}</td>
        </tr>
    `).join('');
}

/* =============================================
   UTILITY FUNCTIONS
   ============================================= */

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showModal(title, message, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');

    const confirmBtn = document.getElementById('modalConfirmBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.id = 'modalConfirmBtn';
    newBtn.onclick = () => {
        onConfirm();
        closeModal();
    };
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function refreshAll() {
    await renderEventsTable();
    await populateEventDropdown();
    await renderStats();
    await renderMembersTable();
    await updateRegBadge();

    // Load admin badge count
    if (currentAdminRole === 'super') {
        const reqData = await fbGet('rmc_admin_requests');
        if (reqData) {
            const pending = Object.values(reqData).filter(r => r.status === 'pending').length;
            const badge = document.getElementById('adminBadge');
            if (pending > 0) {
                badge.textContent = pending;
                badge.style.display = 'inline-flex';
            }
        }
    }
}

/* =============================================
   ANNOUNCEMENTS (Tab D)
   ============================================= */

let currentAnnColor = '#c9a84c';

function updateAnnCharCount() {
    const msg = document.getElementById('annMsg').value;
    document.getElementById('annCharCount').textContent = msg.length;
}

function selectAnnColor(color, btn) {
    currentAnnColor = color;
    document.querySelectorAll('#annColorPresets .color-swatch').forEach(s => s.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateAnnPreview();
}

function updateAnnPreview() {
    const msg = document.getElementById('annMsg').value || 'Your announcement will appear here...';
    const textColor = document.getElementById('annTextColor').value;
    const scrolling = document.getElementById('annScrolling').checked;
    const active = document.getElementById('annActive').checked;
    const box = document.getElementById('annPreviewBox');
    const textEl = document.getElementById('annPreviewText');

    document.getElementById('annScrollLabel').textContent = scrolling ? 'ON' : 'OFF';
    document.getElementById('annActiveLabel').textContent = active ? 'ON' : 'OFF';

    box.style.background = currentAnnColor;
    box.style.opacity = active ? '1' : '0.4';
    textEl.textContent = msg;
    textEl.style.color = textColor;
    textEl.className = scrolling ? 'ann-scroll-text' : '';
}

async function saveAnnouncement() {
    const msg = document.getElementById('annMsg').value.trim();
    if (!msg) { showToast('Please enter a banner message.', 'error'); return; }

    const data = {
        message: msg,
        color: currentAnnColor,
        textColor: document.getElementById('annTextColor').value,
        scrolling: document.getElementById('annScrolling').checked,
        active: document.getElementById('annActive').checked,
        updatedAt: new Date().toISOString()
    };
    await fbSet('rmc_announcement', data);
    showToast('Banner saved successfully!', 'success');
}

function clearAnnouncement() {
    showModal('Clear Banner', 'Remove the announcement banner? It will disappear from the public site.', async () => {
        await fbRemove('rmc_announcement');
        document.getElementById('annMsg').value = '';
        currentAnnColor = '#c9a84c';
        updateAnnCharCount();
        updateAnnPreview();
        showToast('Banner cleared.', 'error');
    });
}

async function loadAnnouncementForm() {
    try {
        const data = await fbGet('rmc_announcement');
        if (!data) return;
        document.getElementById('annMsg').value = data.message || '';
        document.getElementById('annTextColor').value = data.textColor || '#000000';
        document.getElementById('annScrolling').checked = data.scrolling !== false;
        document.getElementById('annActive').checked = data.active !== false;
        currentAnnColor = data.color || '#c9a84c';

        document.querySelectorAll('#annColorPresets .color-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.color === currentAnnColor);
        });

        updateAnnCharCount();
        updateAnnPreview();
    } catch { /* no data yet */ }
}

/* =============================================
   MEMBER MANAGEMENT (Tab E)
   ============================================= */

let currentMemberPhotoBase64 = '';

async function getMembers() {
    const data = await fbGet('rmc_members');
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
}

async function setMembers(members) {
    await fbSet('rmc_members', members);
}

function toggleYearField() {
    const memberType = document.getElementById('memType').value;
    const yearFieldGroup = document.getElementById('yearFieldGroup');
    const yearRequired = document.getElementById('yearRequired');
    const memYear = document.getElementById('memYear');
    const qualRequired = document.getElementById('qualRequired');
    const memQualification = document.getElementById('memQualification');

    if (memberType === 'Faculty Advisor') {
        yearRequired.style.display = 'none';
        qualRequired.innerHTML = '<span style="color: #c9a84c;">*</span>';
        memYear.required = false;
        memQualification.required = true;
    } else if (memberType === 'Core Committee' || memberType === 'General Member') {
        yearRequired.style.display = 'inline';
        qualRequired.innerHTML = '';
        memYear.required = true;
        memQualification.required = false;
    }
}

function handleMemberPhotoUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please upload a valid image file.', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        currentMemberPhotoBase64 = e.target.result;
        document.getElementById('memPhotoData').value = currentMemberPhotoBase64;
        showPhotoPreview(currentMemberPhotoBase64);
        showToast('Photo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function showPhotoPreview(photoBase64) {
    const previewDiv = document.getElementById('photoPreview');
    const previewImg = document.getElementById('photoPreviewImg');
    previewImg.src = photoBase64;
    previewDiv.style.display = 'block';
}

function removeMemberPhoto() {
    currentMemberPhotoBase64 = '';
    document.getElementById('memPhotoData').value = '';
    document.getElementById('memPhotoFileInput').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    showToast('Photo removed.', 'success');
}

function getMemberPhoto(m) {
    if (m.photoData && m.photoData.trim()) return m.photoData;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=c9a84c&color=0a0a0a&size=128&bold=true`;
}

async function saveMember(e) {
    e.preventDefault();
    
    const memberType = document.getElementById('memType').value;
    const memYear = document.getElementById('memYear').value;

    if ((memberType === 'Core Committee' || memberType === 'General Member') && !memYear) {
        showToast('Year is required for student members.', 'error');
        return;
    }
    if (memberType === 'Faculty Advisor' && !document.getElementById('memQualification').value.trim()) {
        showToast('Qualification is required for faculty members.', 'error');
        return;
    }

    const member = {
        id: document.getElementById('editingMemberId').value || generateId(),
        name: document.getElementById('memName').value.trim(),
        role: document.getElementById('memRole').value.trim(),
        year: memYear,
        department: document.getElementById('memDept').value.trim(),
        qualification: document.getElementById('memQualification').value.trim(),
        photoData: document.getElementById('memPhotoData').value,
        linkedin: document.getElementById('memLinkedin').value.trim(),
        email: document.getElementById('memEmail').value.trim(),
        memberType: memberType,
        joiningYear: document.getElementById('memJoinYear').value ? parseInt(document.getElementById('memJoinYear').value) : null,
        status: document.getElementById('memStatus').value,
        createdAt: new Date().toISOString()
    };

    const members = await getMembers();
    const editId = document.getElementById('editingMemberId').value;

    if (editId) {
        const idx = members.findIndex(m => m.id === editId);
        if (idx !== -1) { member.createdAt = members[idx].createdAt; members[idx] = member; }
        showToast('Member updated!', 'success');
    } else {
        members.push(member);
        showToast('Member added!', 'success');
    }

    await setMembers(members);
    resetMemberForm();
    await renderMembersTable();
}

async function editMember(id) {
    const m = (await getMembers()).find(m => m.id === id);
    if (!m) return;
    document.getElementById('memName').value = m.name;
    document.getElementById('memRole').value = m.role;
    document.getElementById('memYear').value = m.year || '';
    document.getElementById('memDept').value = m.department || '';
    document.getElementById('memQualification').value = m.qualification || '';
    document.getElementById('memType').value = m.memberType;
    toggleYearField();
    document.getElementById('memLinkedin').value = m.linkedin || '';
    document.getElementById('memEmail').value = m.email || '';
    document.getElementById('memJoinYear').value = m.joiningYear || '';
    document.getElementById('memStatus').value = m.status || 'Active';
    document.getElementById('editingMemberId').value = m.id;

    if (m.photoData) {
        currentMemberPhotoBase64 = m.photoData;
        document.getElementById('memPhotoData').value = currentMemberPhotoBase64;
        showPhotoPreview(currentMemberPhotoBase64);
    } else {
        currentMemberPhotoBase64 = '';
        document.getElementById('memPhotoData').value = '';
        document.getElementById('photoPreview').style.display = 'none';
    }

    document.getElementById('memberFormTitle').textContent = 'EDIT MEMBER';
    document.getElementById('saveMemberBtn').innerHTML = '<i class="bx bx-save"></i> Update Member';
    document.getElementById('cancelMemberEditBtn').style.display = 'inline-block';
    document.getElementById('panel-members').scrollIntoView({ behavior: 'smooth' });
}

function deleteMember(id) {
    showModal('Delete Member', 'Remove this member? This cannot be undone.', async () => {
        let members = (await getMembers()).filter(m => m.id !== id);
        await setMembers(members);
        await renderMembersTable();
        showToast('Member deleted.', 'error');
    });
}

function cancelMemberEdit() { resetMemberForm(); }

function resetMemberForm() {
    document.getElementById('memberForm').reset();
    document.getElementById('editingMemberId').value = '';
    currentMemberPhotoBase64 = '';
    document.getElementById('memPhotoData').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('memPhotoFileInput').value = '';
    document.getElementById('memberFormTitle').textContent = 'ADD NEW MEMBER';
    document.getElementById('saveMemberBtn').innerHTML = '<i class="bx bx-plus"></i> Add Member';
    document.getElementById('cancelMemberEditBtn').style.display = 'none';
    document.getElementById('memType').value = '';
    document.getElementById('yearFieldGroup').style.display = 'block';
    document.getElementById('yearRequired').style.display = 'inline';
    document.getElementById('qualRequired').innerHTML = '';
}

async function renderMembersTable() {
    const members = await getMembers();
    const tbody = document.getElementById('membersTableBody');
    const emptyMsg = document.getElementById('noMembersMsg');

    if (members.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    tbody.innerHTML = members.map(m => {
        const photo = getMemberPhoto(m);
        const statusBadge = m.status === 'Alumni'
            ? '<span class="status-badge closed">Alumni</span>'
            : '<span class="status-badge open">Active</span>';
        return `<tr>
            <td><img src="${escapeHtml(photo)}" class="member-thumb" alt="${escapeHtml(m.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=c9a84c&color=0a0a0a&size=128'"></td>
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.role)}</td>
            <td>${escapeHtml(m.qualification || '—')}</td>
            <td>${escapeHtml(m.memberType)}</td>
            <td>${statusBadge}</td>
            <td><div class="table-actions">
                <button class="edit-btn" onclick="editMember('${m.id}')"><i class='bx bx-edit-alt'></i> Edit</button>
                <button class="delete-btn" onclick="deleteMember('${m.id}')"><i class='bx bx-trash'></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

async function exportMembersJSON() {
    const members = await getMembers();
    if (members.length === 0) { showToast('No members to export.', 'error'); return; }
    const blob = new Blob([JSON.stringify(members, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rmc_members.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Members exported!', 'success');
}

function importMembersJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Not an array');
            await fbSet('rmc_members', data);
            await renderMembersTable();
            showToast(`Imported ${data.length} members!`, 'success');
        } catch {
            showToast('Invalid JSON file.', 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

const memPhotoDropZone = document.getElementById('memPhotoDropZone');
if (memPhotoDropZone) {
    memPhotoDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        memPhotoDropZone.classList.add('dragover');
    });
    memPhotoDropZone.addEventListener('dragleave', () => {
        memPhotoDropZone.classList.remove('dragover');
    });
    memPhotoDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        memPhotoDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const input = document.getElementById('memPhotoFileInput');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleMemberPhotoUpload(input);
        }
    });
}

/* =============================================
   CERTIFICATE PREVIEW (Tab F)
   ============================================= */

let certTemplateImg = null;

function handleCertUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Please upload a PNG or JPG image.', 'error');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = async function(e) {
        await fbSet('rmc_cert_template', e.target.result);
        certTemplateImg = new Image();
        certTemplateImg.onload = () => renderCertPreview();
        certTemplateImg.src = e.target.result;
        showToast('Certificate template uploaded!', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function clearCertTemplate() {
    showModal('Clear Template', 'Remove the certificate template image?', async () => {
        await fbRemove('rmc_cert_template');
        certTemplateImg = null;
        renderCertPreview();
        showToast('Template cleared.', 'error');
    });
}

async function loadCertConfig() {
    const tplData = await fbGet('rmc_cert_template');
    if (tplData && !certTemplateImg) {
        certTemplateImg = new Image();
        certTemplateImg.onload = () => renderCertPreview();
        certTemplateImg.src = tplData;
    }

    try {
        const cfg = await fbGet('rmc_cert_config');
        if (!cfg) return;
        document.getElementById('certFont').value = cfg.font || 'Cinzel';
        document.getElementById('certFontSize').value = cfg.fontSize || 36;
        document.getElementById('certFontSizeVal').textContent = cfg.fontSize || 36;
        document.getElementById('certFontColor').value = cfg.fontColor || '#000000';
        document.getElementById('certXPos').value = cfg.xPercent || 50;
        document.getElementById('certXVal').textContent = cfg.xPercent || 50;
        document.getElementById('certYPos').value = cfg.yPercent || 70;
        document.getElementById('certYVal').textContent = cfg.yPercent || 70;
        document.getElementById('certBold').checked = cfg.bold || false;
        document.getElementById('certItalic').checked = cfg.italic || false;
    } catch { /* no config */ }
}

function renderCertPreview() {
    const canvas = document.getElementById('certCanvas');
    const ctx = canvas.getContext('2d');

    if (certTemplateImg && certTemplateImg.complete && certTemplateImg.naturalWidth > 0) {
        canvas.width = certTemplateImg.naturalWidth;
        canvas.height = certTemplateImg.naturalHeight;
        ctx.drawImage(certTemplateImg, 0, 0);
    } else {
        canvas.width = 800;
        canvas.height = 566;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 800, 566);
        ctx.strokeStyle = 'rgba(201,168,76,0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(20, 20, 760, 526);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(201,168,76,0.3)';
        ctx.font = '18px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('Upload a certificate template to preview', 400, 283);
    }

    const name = document.getElementById('certSampleName').value || 'Sample Participant';
    const font = document.getElementById('certFont').value;
    const fontSize = parseInt(document.getElementById('certFontSize').value);
    const fontColor = document.getElementById('certFontColor').value;
    const xPct = parseInt(document.getElementById('certXPos').value);
    const yPct = parseInt(document.getElementById('certYPos').value);
    const bold = document.getElementById('certBold').checked;
    const italic = document.getElementById('certItalic').checked;

    const weight = bold ? 'bold ' : '';
    const style = italic ? 'italic ' : '';
    ctx.font = `${style}${weight}${fontSize}px ${font}`;
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width * xPct / 100, canvas.height * yPct / 100);

    const cx = canvas.width * xPct / 100;
    const cy = canvas.height * yPct / 100;
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(cb => {
        const label = cb.parentElement.querySelector('.toggle-label');
        if (label) label.textContent = cb.checked ? 'ON' : 'OFF';
    });
}

async function saveCertConfig() {
    const cfg = {
        font: document.getElementById('certFont').value,
        fontSize: parseInt(document.getElementById('certFontSize').value),
        fontColor: document.getElementById('certFontColor').value,
        xPercent: parseInt(document.getElementById('certXPos').value),
        yPercent: parseInt(document.getElementById('certYPos').value),
        bold: document.getElementById('certBold').checked,
        italic: document.getElementById('certItalic').checked,
        savedAt: new Date().toISOString()
    };
    await fbSet('rmc_cert_config', cfg);
    showToast('Configuration saved!', 'success');
}

function downloadCertPreview() {
    const canvas = document.getElementById('certCanvas');
    const link = document.createElement('a');
    link.download = 'certificate_preview.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Preview downloaded!', 'success');
}

async function exportCertConfig() {
    const cfg = await fbGet('rmc_cert_config');
    if (!cfg) { showToast('Save the configuration first.', 'error'); return; }
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cert_config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Config exported!', 'success');
}

/* =============================================
   INITIALIZATION
   ============================================= */
checkSession();
