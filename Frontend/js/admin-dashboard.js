// =========================
// API CONFIGURATION
// =========================

const API_BASE = '/FantasyRealm/Backend/api/';

const getElement = (id) => document.getElementById(id);

let employees = [];
let availablePlayers = [];
let selectedEmployee = null;
let employeeActionInProgress = false;
let promotionInProgress = false;

// =========================
// FEEDBACK MESSAGES
// =========================

function showFeedback(id, message, type = '') {
    const element = getElement(id);

    element.textContent = message;
    element.hidden = message === '';

    element.classList.remove('is-error', 'is-success');

    if (type === 'error') {
        element.classList.add('is-error');
    } else if (type === 'success') {
        element.classList.add('is-success');
    }
}

// =========================
// API REQUEST HELPER
// =========================

async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Accept': 'application/json'
    };

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (options.csrfToken) {
        headers['X-CSRF-Token'] = options.csrfToken;
    }

    let response;

    try {
        response = await fetch(API_BASE + endpoint, {
            method: options.method || 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers,
            ...(options.body !== undefined
                ? { body: JSON.stringify(options.body) }
                : {})
        });
    } catch (error) {
        throw new Error('Unable to connect to the server.');
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error('The server returned an invalid JSON response.');
    }

    if (response.status === 401) {
        window.location.href = 'login.html';
        throw new Error('Your session has expired.');
    }

    if (!response.ok || data.success !== true) {
        const error = new Error(
            data.message || `Request failed (${response.status}).`
        );

        error.status = response.status;
        throw error;
    }

    return data;
}

// =========================
// CSRF TOKEN HELPER
// =========================

async function getCsrfToken(endpoint) {
    const data = await apiRequest(endpoint);

    if (
        typeof data.csrf_token !== 'string' ||
        data.csrf_token.length === 0
    ) {
        throw new Error('Unable to obtain a security token.');
    }

    return data.csrf_token;
}

// =========================
// TABLE HELPERS
// =========================

function createTableCell(row, value) {
    const cell = document.createElement('td');

    cell.textContent = String(value);
    row.appendChild(cell);

    return cell;
}

function showEmptyTable(tbody, columns, message) {
    tbody.replaceChildren();

    const row = document.createElement('tr');
    const cell = createTableCell(row, message);

    cell.colSpan = columns;
    tbody.appendChild(row);
}

function formatNumber(value) {
    if (value === null || value === undefined) {
        return '—';
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString()
        : '—';
}

function isSuspended(account) {
    return account.suspended === true ||
        account.suspended === 1 ||
        account.suspended === '1';
}

// =========================
// ADMIN OVERVIEW
// =========================

function updateOverview(data) {
    getElement('nav-username').textContent = data.admin.username;
    getElement('admin-username').textContent = data.admin.username;

    const statistics = data.statistics;

    const fields = {
        'total-employees': 'total_employees',
        'active-employees': 'active_employees',
        'suspended-employees': 'suspended_employees',
        'total-players': 'total_players',
        'total-admins': 'total_admins'
    };

    for (const [elementId, field] of Object.entries(fields)) {
        getElement(elementId).textContent =
            formatNumber(statistics[field]);
    }
}

async function loadOverview() {
    const button = getElement('refresh-overview');

    button.disabled = true;

    try {
        const data = await apiRequest('admin-dashboard.php');

        updateOverview(data);
        showFeedback('admin-access-message', '');

        return true;

    } catch (error) {
        showFeedback(
            'admin-access-message',
            error.message,
            'error'
        );

        if (error.status === 403) {
            getElement('admin-content').hidden = true;
        }

        return false;

    } finally {
        button.disabled = false;
    }
}

getElement('refresh-overview').addEventListener(
    'click',
    loadOverview
);

// =========================
// LOAD EXISTING PLAYERS
// =========================

// Loads regular USER accounts for possible promotion.

async function loadPlayers() {
    const select = getElement('promote-user-select');
    const button = getElement('promote-employee-button');

    select.disabled = true;
    button.disabled = true;

    select.replaceChildren(new Option('Loading players...', ''));

    try {
        const data = await apiRequest('employee-users.php');

        if (!Array.isArray(data.users)) {
            throw new Error('Invalid player list received.');
        }

        // Suspended players cannot be promoted.
        availablePlayers = data.users.filter(
            (user) => !isSuspended(user)
        );

        renderPlayerOptions();

        showFeedback('promote-employee-message', '');

    } catch (error) {
        availablePlayers = [];

        select.replaceChildren(
            new Option('Unable to load players', '')
        );

        select.disabled = true;
        button.disabled = true;

        showFeedback(
            'promote-employee-message',
            error.message,
            'error'
        );
    }
}

// =========================
// SEARCH AND SELECT PLAYERS
// =========================

function renderPlayerOptions() {
    const search = getElement('promote-user-search')
        .value.trim().toLowerCase();

    const select = getElement('promote-user-select');
    const button = getElement('promote-employee-button');

    const previousSelection = select.value;

    const matchingPlayers = availablePlayers.filter((player) => {
        const username = String(player.username).toLowerCase();
        const email = String(player.email).toLowerCase();

        return username.includes(search) || email.includes(search);
    });

    select.replaceChildren();

    let placeholder = 'Select a player';

    if (availablePlayers.length === 0) {
        placeholder = 'No active players available';
    } else if (matchingPlayers.length === 0) {
        placeholder = 'No matching players found';
    }

    select.appendChild(new Option(placeholder, ''));

    for (const player of matchingPlayers) {
        const option = document.createElement('option');

        option.value = String(player.id);
        option.textContent =
            `${player.username} (${player.email})`;

        select.appendChild(option);
    }

    const stillAvailable = matchingPlayers.some(
        (player) => String(player.id) === previousSelection
    );

    select.value = stillAvailable ? previousSelection : '';
    select.disabled = matchingPlayers.length === 0;

    button.disabled = promotionInProgress || select.value === '';
}

getElement('promote-user-search').addEventListener(
    'input',
    renderPlayerOptions
);

getElement('promote-user-select').addEventListener(
    'change',
    () => {
        const selectedValue = getElement('promote-user-select').value;

        getElement('promote-employee-button').disabled =
            selectedValue === '' || promotionInProgress;
    }
);

// =========================
// PROMOTE EXISTING PLAYER
// =========================

getElement('promote-employee-form').addEventListener(
    'submit',
    async (event) => {
        event.preventDefault();

        if (promotionInProgress) {
            return;
        }

        const select = getElement('promote-user-select');
        const userId = Number(select.value);

        const player = availablePlayers.find(
            (user) => Number(user.id) === userId
        );

        if (!player || !Number.isSafeInteger(userId) || userId <= 0) {
            showFeedback(
                'promote-employee-message',
                'Please select a valid player.',
                'error'
            );
            return;
        }

        // Ask for confirmation before granting staff permissions.
        const confirmed = window.confirm(
            `Make ${player.username} an employee? ` +
            'This account will gain staff access.'
        );

        if (!confirmed) {
            return;
        }

        const button = getElement('promote-employee-button');
        const searchInput = getElement('promote-user-search');

        promotionInProgress = true;

        button.disabled = true;
        select.disabled = true;
        searchInput.disabled = true;

        button.textContent = 'Promoting...';

        showFeedback('promote-employee-message', '');

        try {
            // Get a valid security token.
            const csrfToken = await getCsrfToken(
                'admin-promote-employee.php'
            );

            // Change the existing player's role.
            const data = await apiRequest(
                'admin-promote-employee.php',
                {
                    method: 'POST',
                    csrfToken,
                    body: {
                        user_id: userId
                    }
                }
            );

            // Refresh the interface after successful promotion.
            searchInput.value = '';

            await Promise.all([
                loadPlayers(),
                loadEmployees(),
                loadOverview(),
                loadActivity()
            ]);

            const loggingFailed = data.activity_logged === false;

            showFeedback(
                'promote-employee-message',
                loggingFailed
                    ? 'Player promoted, but activity logging failed.'
                    : `${player.username} is now an employee.`,
                loggingFailed ? 'error' : 'success'
            );

        } catch (error) {
            showFeedback(
                'promote-employee-message',
                error.message,
                'error'
            );

        } finally {
            promotionInProgress = false;

            button.textContent = 'Make Employee';
            searchInput.disabled = false;

            renderPlayerOptions();
        }
    }
);

// =========================
// EMPLOYEE LIST
// =========================

function formatEmployeeDate(value) {
    if (typeof value !== 'string' || value === '') {
        return '—';
    }

    return value.replace('T', ' ').slice(0, 16);
}

function renderEmployees() {
    const tbody = getElement('employees-table-body');

    const search = getElement('employee-search')
        .value.trim().toLowerCase();

    const filter = getElement('employee-status-filter').value;

    const filteredEmployees = employees.filter((employee) => {
        const username = String(employee.username).toLowerCase();
        const email = String(employee.email).toLowerCase();
        const suspended = isSuspended(employee);

        const matchesSearch =
            username.includes(search) ||
            email.includes(search);

        const matchesStatus =
            filter === 'all' ||
            (filter === 'active' && !suspended) ||
            (filter === 'suspended' && suspended);

        return matchesSearch && matchesStatus;
    });

    tbody.replaceChildren();

    if (filteredEmployees.length === 0) {
        showEmptyTable(
            tbody,
            5,
            'No matching employees found.'
        );
    }

    for (const employee of filteredEmployees) {
        const row = document.createElement('tr');

        const suspended = isSuspended(employee);

        // Employee username and email.
        createTableCell(row, employee.username);
        createTableCell(row, employee.email);

        // Account status.
        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');

        statusBadge.className = suspended
            ? 'admin-status admin-status-suspended'
            : 'admin-status admin-status-active';

        statusBadge.textContent = suspended
            ? 'Suspended'
            : 'Active';

        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        // Registration date.
        createTableCell(
            row,
            formatEmployeeDate(employee.created_at)
        );

        // Suspension/reactivation button.
        const actionCell = document.createElement('td');
        const actionButton = document.createElement('button');

        actionButton.type = 'button';

        actionButton.className = suspended
            ? 'admin-table-action'
            : 'admin-table-action admin-table-action-danger';

        actionButton.textContent = suspended
            ? 'Reactivate'
            : 'Suspend';

        actionButton.addEventListener('click', () => {
            openEmployeeDialog(employee);
        });

        actionCell.appendChild(actionButton);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    }

    getElement('employees-count').textContent =
        `Showing ${filteredEmployees.length} of ${employees.length} employees`;
}

async function loadEmployees() {
    const button = getElement('refresh-employees');

    button.disabled = true;

    try {
        const data = await apiRequest('admin-employees.php');

        if (!Array.isArray(data.employees)) {
            throw new Error('Invalid employee list received.');
        }

        employees = data.employees;

        renderEmployees();
        showFeedback('employees-message', '');

    } catch (error) {
        showFeedback(
            'employees-message',
            error.message,
            'error'
        );

    } finally {
        button.disabled = false;
    }
}

// =========================
// EMPLOYEE SEARCH AND FILTERS
// =========================

getElement('employee-search').addEventListener(
    'input',
    renderEmployees
);

getElement('employee-status-filter').addEventListener(
    'change',
    renderEmployees
);

getElement('refresh-employees').addEventListener(
    'click',
    loadEmployees
);

// =========================
// EMPLOYEE ACTION DIALOG
// =========================

const employeeDialog = getElement('employee-action-dialog');

function openEmployeeDialog(employee) {
    if (employeeActionInProgress) {
        return;
    }

    selectedEmployee = employee;

    const suspended = isSuspended(employee);
    const action = suspended ? 'reactivate' : 'suspend';

    getElement('employee-action-title').textContent = suspended
        ? 'Reactivate Employee'
        : 'Suspend Employee';

    getElement('employee-action-description').textContent =
        `Are you sure you want to ${action} ${employee.username}?`;

    getElement('employee-action-confirm').textContent = suspended
        ? 'Reactivate'
        : 'Suspend';

    showFeedback('employee-action-error', '');

    employeeDialog.showModal();
}

getElement('employee-action-cancel').addEventListener(
    'click',
    () => {
        if (!employeeActionInProgress) {
            employeeDialog.close();
        }
    }
);

employeeDialog.addEventListener('cancel', (event) => {
    if (employeeActionInProgress) {
        event.preventDefault();
    }
});

employeeDialog.addEventListener('close', () => {
    selectedEmployee = null;
});

// =========================
// SUSPEND OR REACTIVATE EMPLOYEE
// =========================

getElement('employee-action-form').addEventListener(
    'submit',
    async (event) => {
        event.preventDefault();

        if (!selectedEmployee || employeeActionInProgress) {
            return;
        }

        const employee = selectedEmployee;
        const suspended = !isSuspended(employee);

        const confirmButton = getElement('employee-action-confirm');
        const cancelButton = getElement('employee-action-cancel');

        employeeActionInProgress = true;

        confirmButton.disabled = true;
        cancelButton.disabled = true;

        const originalText = confirmButton.textContent;
        confirmButton.textContent = 'Processing...';

        showFeedback('employee-action-error', '');

        try {
            const csrfToken = await getCsrfToken(
                'admin-update-employee.php'
            );

            const data = await apiRequest(
                'admin-update-employee.php',
                {
                    method: 'POST',
                    csrfToken,
                    body: {
                        employee_id: Number(employee.id),
                        suspended
                    }
                }
            );

            employeeDialog.close();

            await Promise.all([
                loadOverview(),
                loadEmployees(),
                loadActivity()
            ]);

            const loggingFailed = data.activity_logged === false;

            showFeedback(
                'employees-message',
                loggingFailed
                    ? 'Employee updated, but activity logging failed.'
                    : data.message,
                loggingFailed ? 'error' : 'success'
            );

        } catch (error) {
            showFeedback(
                'employee-action-error',
                error.message,
                'error'
            );

        } finally {
            employeeActionInProgress = false;

            confirmButton.disabled = false;
            cancelButton.disabled = false;

            confirmButton.textContent = originalText;
        }
    }
);

// =========================
// ACTIVITY LOG LABELS
// =========================

const activityLabels = {
    'employee.created': 'Employee created',
    'employee.promoted': 'Player promoted to Employee',
    'employee.suspended': 'Employee suspended',
    'employee.reactivated': 'Employee reactivated',
    'character.approved': 'Character approved',
    'character.rejected': 'Character rejected',
    'review.approved': 'Review approved',
    'review.rejected': 'Review rejected',
    'player.suspended': 'Player suspended',
    'player.reactivated': 'Player reactivated',
    'player.deleted': 'Player deleted',
    'accessory.created': 'Accessory created',
    'accessory.updated': 'Accessory updated',
    'accessory.deleted': 'Accessory deleted'
};

// =========================
// FORMAT ACTIVITY DATES
// =========================

function formatActivityDate(value) {
    if (!value) {
        return 'Unknown';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

// =========================
// RENDER ACTIVITY LOGS
// =========================

function renderActivity(logs) {
    const tbody = getElement('activity-table-body');

    tbody.replaceChildren();

    if (logs.length === 0) {
        showEmptyTable(
            tbody,
            4,
            'No activity recorded yet.'
        );
    }

    for (const log of logs) {
        const row = document.createElement('tr');

        const username = log.actor_username ||
            `Account #${log.actor_id} (unavailable)`;

        const action = activityLabels[log.action] ||
            'Unknown activity';

        const target = `${log.target_type} #${log.target_id}`;

        createTableCell(
            row,
            formatActivityDate(log.created_at)
        );

        createTableCell(row, username);
        createTableCell(row, action);
        createTableCell(row, target);

        tbody.appendChild(row);
    }

    getElement('activity-count').textContent =
        `Showing ${logs.length} recent activities (maximum 50).`;
}

// =========================
// LOAD ACTIVITY LOGS
// =========================

async function loadActivity() {
    const button = getElement('refresh-activity');

    button.disabled = true;

    try {
        const data = await apiRequest('admin-activity-logs.php');

        if (!Array.isArray(data.logs)) {
            throw new Error('Invalid activity logs received.');
        }

        renderActivity(data.logs);

        showFeedback('activity-message', '');

    } catch (error) {
        showFeedback(
            'activity-message',
            error.message,
            'error'
        );

    } finally {
        button.disabled = false;
    }
}

getElement('refresh-activity').addEventListener(
    'click',
    loadActivity
);

// =========================
// ADMIN LOGOUT
// =========================

getElement('admin-logout').addEventListener(
    'click',
    async () => {
        const button = getElement('admin-logout');

        button.disabled = true;

        try {
            const sessionResponse = await fetch(
    '/FantasyRealm/Backend/api/session.php',
    {
        credentials: 'same-origin',
        cache: 'no-store'
    }
);

if (!sessionResponse.ok) {
    throw new Error('Unable to retrieve session.');
}

const sessionData = await sessionResponse.json();

if (
    !sessionData.authenticated ||
    typeof sessionData.csrf_token !== 'string'
) {
    throw new Error('Unable to verify session security.');
}

await apiRequest('logout.php', {
    method: 'POST',
    csrfToken: sessionData.csrf_token
});

            window.location.href = 'login.html';

        } catch (error) {
            showFeedback(
                'admin-access-message',
                error.message,
                'error'
            );

            button.disabled = false;
        }
    }
);

// =========================
// ADMIN DASHBOARD INITIALIZATION
// =========================

async function initializeAdminDashboard() {
    getElement('admin-content').hidden = true;

    showFeedback(
        'admin-access-message',
        'Checking administrator access...'
    );

    // Check administrator access first.
    const authorized = await loadOverview();

    if (!authorized) {
        return;
    }

    // Display the dashboard after authorization.
    getElement('admin-content').hidden = false;

    // Load all dashboard information.
    await Promise.all([
        loadPlayers(),
        loadEmployees(),
        loadActivity()
    ]);
}

// =========================
// ADMIN SETTINGS MENU
// =========================

const adminSettingsMenu = getElement('admin-settings-menu');
const adminSettingsButton = getElement('admin-settings-button');
const adminSettingsDropdown = getElement('admin-settings-dropdown');

function setAdminSettingsOpen(isOpen) {
    adminSettingsDropdown.hidden = !isOpen;

    adminSettingsButton.setAttribute(
        'aria-expanded',
        String(isOpen)
    );
}

adminSettingsButton.addEventListener('click', () => {
    setAdminSettingsOpen(adminSettingsDropdown.hidden);
});

document.addEventListener('click', (event) => {
    if (!adminSettingsMenu.contains(event.target)) {
        setAdminSettingsOpen(false);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !adminSettingsDropdown.hidden) {
        setAdminSettingsOpen(false);
        adminSettingsButton.focus();
    }
});

initializeAdminDashboard();