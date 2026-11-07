/*
 * FantasyRealm - Administrator Dashboard
 *
 * The shared header manages navigation and logout.
 * This controller handles administrator features only.
 * Backend permissions remain authoritative.
 */

(() => {
	'use strict';

	const API = '/FantasyRealm/Backend/api/';
	const el = (id) => document.getElementById(id);

	const state = {
		employees: [],
		players: [],
		selected: null,
		busy: false,
		creating: false,
		promoting: false
	};

	// =====================================================
	// FEEDBACK
	// =====================================================

	function feedback(id, message = '', kind = '') {
		const target = el(id);

		target.textContent = message;
		target.hidden = !message;

		target.classList.toggle('is-error', kind === 'error');
		target.classList.toggle('is-success', kind === 'success');
	}

	// =====================================================
	// API REQUESTS
	// =====================================================

	async function request(
		endpoint,
		{ method = 'GET', body, csrfToken } = {}
	) {
		const headers = {
			Accept: 'application/json'
		};

		if (body !== undefined) {
			headers['Content-Type'] = 'application/json';
		}

		if (csrfToken) {
			headers['X-CSRF-Token'] = csrfToken;
		}

		const response = await fetch(API + endpoint, {
			method,
			headers,
			credentials: 'same-origin',
			cache: 'no-store',
			...(body !== undefined
				? { body: JSON.stringify(body) }
				: {})
		});

		let data;

		try {
			data = await response.json();
		} catch {
			throw new Error('Invalid server response.');
		}

		if (response.status === 401) {
			window.location.assign('login.html');
			throw new Error('Authentication required.');
		}

		if (!response.ok || data.success !== true) {
			const error = new Error(
				data.message || 'Request failed.'
			);

			error.status = response.status;
			throw error;
		}

		return data;
	}

	async function token(endpoint) {
		const data = await request(endpoint);

		if (
			typeof data.csrf_token !== 'string' ||
			!data.csrf_token
		) {
			throw new Error('Missing security token.');
		}

		return data.csrf_token;
	}

	// =====================================================
	// TABLE HELPERS
	// =====================================================

	function suspended(user) {
		return (
			user.suspended === true ||
			user.suspended === 1 ||
			user.suspended === '1'
		);
	}

	function textCell(row, text) {
		const td = document.createElement('td');

		td.textContent = String(text ?? '—');
		row.appendChild(td);

		return td;
	}

	function emptyRow(tbody, columns, message) {
		tbody.replaceChildren();

		const row = document.createElement('tr');
		const td = textCell(row, message);

		td.colSpan = columns;
		tbody.appendChild(row);
	}

	function number(value) {
		const n = Number(value);

		return Number.isFinite(n)
			? n.toLocaleString()
			: '—';
	}

	// =====================================================
	// ADMIN OVERVIEW
	// =====================================================

	async function loadOverview() {
		const button = el('refresh-overview');

		button.disabled = true;

		try {
			const data = await request('admin-dashboard.php');

			el('admin-username').textContent =
				data.admin.username;

			const fields = {
				'total-employees': 'total_employees',
				'active-employees': 'active_employees',
				'suspended-employees': 'suspended_employees',
				'total-players': 'total_players',
				'total-admins': 'total_admins'
			};

			for (const [id, field] of Object.entries(fields)) {
				el(id).textContent = number(
					data.statistics[field]
				);
			}

			feedback('admin-access-message');

			return true;
		} catch (error) {
			feedback(
				'admin-access-message',
				error.message,
				'error'
			);

			if (error.status === 403) {
				el('admin-content').hidden = true;
			}

			return false;
		} finally {
			button.disabled = false;
		}
	}

	// =====================================================
	// PLAYER PROMOTION
	// =====================================================

	function playerOptions() {
		const select = el('promote-user-select');
		const previous = select.value;

		const query = el('promote-user-search')
			.value.trim()
			.toLocaleLowerCase();

		const matches = state.players.filter((user) =>
			`${user.username} ${user.email}`
				.toLocaleLowerCase()
				.includes(query)
		);

		select.replaceChildren(
			new Option(
				matches.length
					? 'Select a player'
					: 'No matching active players',
				''
			)
		);

		for (const user of matches) {
			select.appendChild(
				new Option(
					`${user.username} (${user.email})`,
					String(user.id)
				)
			);
		}

		if (
			matches.some(
				(user) => String(user.id) === previous
			)
		) {
			select.value = previous;
		}

		select.disabled =
			!matches.length || state.promoting;

		el('promote-employee-button').disabled =
			!select.value || state.promoting;
	}

	async function loadPlayers() {
		try {
			const data = await request('employee-users.php');

			if (!Array.isArray(data.users)) {
				throw new Error('Invalid player list.');
			}

			state.players = data.users.filter(
				(user) => !suspended(user)
			);

			playerOptions();
			feedback('promote-employee-message');
		} catch (error) {
			state.players = [];

			playerOptions();

			feedback(
				'promote-employee-message',
				error.message,
				'error'
			);
		}
	}


	/* =====================================================
		 PLAYER PROMOTION CONFIRMATION
	===================================================== */

	const promoteDialog = el('promote-player-dialog');

	let playerPendingPromotion = null;

	function openPromoteDialog(player) {
		if (state.promoting || promoteDialog.open) {
			return;
		}

		playerPendingPromotion = player;

		el('promote-player-dialog-description').textContent =
			`Promote ${player.username} to Employee? ` +
			'Their existing password and email will remain unchanged.';

		feedback('promote-player-dialog-error');

		promoteDialog.showModal();
	}

	/*
	 * Opening the confirmation window does not update
	 * the account. Only submitting the dialog does.
	 */
	function promote(event) {
		event.preventDefault();

		if (state.promoting) {
			return;
		}

		const id = Number(el('promote-user-select').value);

		const player = state.players.find(
			(user) => Number(user.id) === id
		);

		if (!player || !Number.isSafeInteger(id) || id <= 0) {
			feedback(
				'promote-employee-message',
				'Please select a valid player.',
				'error'
			);
			return;
		}

		openPromoteDialog(player);
	}

	/*
	 * Perform the actual role change only after
	 * the administrator confirms the dialog.
	 */
	async function confirmPlayerPromotion(event) {
		event.preventDefault();

		if (!playerPendingPromotion || state.promoting) {
			return;
		}

		const player = playerPendingPromotion;
		const userId = Number(player.id);

		state.promoting = true;

		const confirmButton = el('promote-player-dialog-confirm');
		const cancelButton = el('promote-player-dialog-cancel');
		const promoteButton = el('promote-employee-button');
		const searchInput = el('promote-user-search');
		const playerSelect = el('promote-user-select');

		confirmButton.disabled = true;
		cancelButton.disabled = true;
		promoteButton.disabled = true;
		searchInput.disabled = true;
		playerSelect.disabled = true;

		confirmButton.textContent = 'Promoting...';

		feedback('promote-player-dialog-error');
		feedback('promote-employee-message');

		try {
			const csrfToken = await token(
				'admin-promote-employee.php'
			);

			const result = await request(
				'admin-promote-employee.php',
				{
					method: 'POST',
					csrfToken,
					body: {
						user_id: userId
					}
				}
			);

			promoteDialog.close();

			searchInput.value = '';

			await Promise.allSettled([
				loadPlayers(),
				loadEmployees(),
				loadOverview(),
				loadActivity()
			]);

			const loggingFailed = result.activity_logged === false;

			feedback(
				'promote-employee-message',
				loggingFailed
					? 'Player promoted, but activity logging failed.'
					: `${player.username} is now an employee.`,
				loggingFailed ? 'error' : 'success'
			);

		} catch (error) {
			feedback(
				'promote-player-dialog-error',
				error.message,
				'error'
			);

		} finally {
			state.promoting = false;

			confirmButton.disabled = false;
			cancelButton.disabled = false;
			promoteButton.disabled = false;
			searchInput.disabled = false;

			confirmButton.textContent = 'Confirm Promotion';

			playerOptions();
		}
	}

	// =====================================================
	// EMPLOYEE LIST
	// =====================================================

	function renderEmployees() {
		const tbody = el('employees-table-body');

		const query = el('employee-search')
			.value.trim()
			.toLocaleLowerCase();

		const filter = el(
			'employee-status-filter'
		).value;

		const matching = state.employees.filter(
			(user) => {
				const matchesText =
					`${user.id} ${user.username} ${user.email}`
						.toLocaleLowerCase()
						.includes(query);

				const matchesStatus =
					filter === 'all' ||
					(
						(filter === 'suspended') ===
						suspended(user)
					);

				return matchesText && matchesStatus;
			}
		);

		tbody.replaceChildren();

		if (!matching.length) {
			emptyRow(
				tbody,
				6,
				'No matching employees found.'
			);
		}

		for (const user of matching) {
			const row = document.createElement('tr');

			// Display the employee ID for audit-log identification.
			textCell(row, user.id);

			textCell(row, user.username);
			textCell(row, user.email);

			// Account status.
			const statusCell =
				document.createElement('td');

			const statusLabel =
				document.createElement('span');

			statusLabel.className = suspended(user)
				? 'admin-status admin-status-suspended'
				: 'admin-status admin-status-active';

			statusLabel.textContent = suspended(user)
				? 'Suspended'
				: 'Active';

			statusCell.appendChild(statusLabel);
			row.appendChild(statusCell);

			// Account creation date.
			const createdAt =
				typeof user.created_at === 'string'
					? user.created_at
						.replace('T', ' ')
						.slice(0, 16)
					: '—';

			textCell(row, createdAt);

			// Employee action.
			const actionCell =
				document.createElement('td');

			const button =
				document.createElement('button');

			button.type = 'button';

			button.className = suspended(user)
				? 'admin-table-action'
				: 'admin-table-action admin-table-action-danger';

			button.textContent = suspended(user)
				? 'Reactivate'
				: 'Suspend';

			button.addEventListener('click', () => {
				openDialog(user);
			});

			/*
 * Keep suspension controls and password management
 * together in the employee actions column.
 */
			const actions = document.createElement('div');
			actions.className = 'admin-employee-actions';

			actions.appendChild(button);

			const passwordButton = document.createElement('button');

			passwordButton.type = 'button';
			passwordButton.className = 'admin-table-action';
			passwordButton.textContent = 'Change Password';

			passwordButton.addEventListener('click', () => {
				openEmployeePasswordDialog(user);
			});

			actions.appendChild(passwordButton);

			/*
			 * Open a dedicated confirmation dialog before
			 * permanently deleting an employee account.
			 */
			const deleteButton = document.createElement('button');

			deleteButton.type = 'button';
			deleteButton.className =
				'admin-table-action admin-table-action-danger';

			deleteButton.textContent = 'Delete';

			deleteButton.addEventListener('click', () => {
				openEmployeeDeleteDialog(user);
			});

			actions.appendChild(deleteButton);

			actionCell.appendChild(actions);
			row.appendChild(actionCell);

			tbody.appendChild(row);
		}

		el('employees-count').textContent =
			`Showing ${matching.length} of ` +
			`${state.employees.length} employees`;
	}

	async function loadEmployees() {
		const button = el('refresh-employees');

		button.disabled = true;

		try {
			const data = await request(
				'admin-employees.php'
			);

			if (!Array.isArray(data.employees)) {
				throw new Error('Invalid employee list.');
			}

			state.employees = data.employees;

			renderEmployees();
			feedback('employees-message');
		} catch (error) {
			feedback(
				'employees-message',
				error.message,
				'error'
			);
		} finally {
			button.disabled = false;
		}
	}

	// =====================================================
	// EMPLOYEE CONFIRMATION DIALOG
	// =====================================================

	function openDialog(employee) {
		if (state.busy) {
			return;
		}

		state.selected = employee;

		const active = !suspended(employee);

		el('employee-action-title').textContent =
			active
				? 'Suspend Employee'
				: 'Reactivate Employee';

		el('employee-action-description').textContent =
			`Are you sure you want to ` +
			`${active ? 'suspend' : 'reactivate'} ` +
			`${employee.username}?`;

		el('employee-action-confirm').textContent =
			active ? 'Suspend' : 'Reactivate';

		feedback('employee-action-error');

		el('employee-action-dialog').showModal();
	}

	async function updateEmployee(event) {
		event.preventDefault();

		if (!state.selected || state.busy) {
			return;
		}

		state.busy = true;

		const user = state.selected;
		const nextStatus = !suspended(user);

		const confirm = el(
			'employee-action-confirm'
		);

		const cancel = el(
			'employee-action-cancel'
		);

		confirm.disabled = true;
		cancel.disabled = true;

		try {
			const csrfToken = await token(
				'admin-update-employee.php'
			);

			const data = await request(
				'admin-update-employee.php',
				{
					method: 'POST',
					csrfToken,
					body: {
						employee_id: Number(user.id),
						suspended: nextStatus
					}
				}
			);

			el('employee-action-dialog').close();

			await Promise.allSettled([
				loadOverview(),
				loadEmployees(),
				loadActivity()
			]);

			feedback(
				'employees-message',
				data.message,
				data.activity_logged === false
					? 'error'
					: 'success'
			);
		} catch (error) {
			feedback(
				'employee-action-error',
				error.message,
				'error'
			);
		} finally {
			state.busy = false;

			confirm.disabled = false;
			cancel.disabled = false;
		}
	}

	// =====================================================
	// ACTIVITY LOGS
	// =====================================================

	const activityLabels = {
		'employee.created': 'Employee created',
		'employee.promoted': 'Player promoted to Employee',
		'employee.suspended': 'Employee suspended',
		'employee.reactivated': 'Employee reactivated',
		'employee.password_updated': 'Employee password updated',
		'employee.deleted': 'Employee deleted',

		'character.approved': 'Character approved',
		'character.rejected': 'Character rejected',
		'character.deleted': 'Character deleted',

		'review.approved': 'Review approved',
		'review.rejected': 'Review rejected',

		'player.suspended': 'Player suspended',
		'player.reactivated': 'Player reactivated',
		'player.deleted': 'Player deleted',

		'accessory.created': 'Accessory created',
		'accessory.updated': 'Accessory updated',
		'accessory.deleted': 'Accessory deleted'
	};

	async function loadActivity() {
		const button = el('refresh-activity');

		button.disabled = true;

		try {
			const data = await request(
				'admin-activity-logs.php'
			);

			if (!Array.isArray(data.logs)) {
				throw new Error(
					'Invalid activity log response.'
				);
			}

			const tbody = el(
				'activity-table-body'
			);

			tbody.replaceChildren();

			if (!data.logs.length) {
				emptyRow(
					tbody,
					4,
					'No activity recorded yet.'
				);
			}

			for (const log of data.logs) {
				const row =
					document.createElement('tr');

				let date = 'Unknown';

				if (log.created_at) {
					const value = new Date(
						log.created_at
					);

					if (!Number.isNaN(value.getTime())) {
						date = new Intl.DateTimeFormat(
							undefined,
							{
								dateStyle: 'medium',
								timeStyle: 'short'
							}
						).format(value);
					}
				}

				textCell(row, date);

				textCell(
					row,
					log.actor_username ||
					`Account #${log.actor_id} (unavailable)`
				);

				textCell(
					row,
					activityLabels[log.action] ||
					log.action ||
					'Unknown action'
				);

				textCell(
					row,
					`${log.target_type ?? 'target'} ` +
					`#${log.target_id ?? '—'}`
				);

				tbody.appendChild(row);
			}

			el('activity-count').textContent =
				`Showing ${data.logs.length} ` +
				'recent activities (maximum 50).';

			feedback('activity-message');
		} catch (error) {
			feedback(
				'activity-message',
				error.message,
				'error'
			);
		} finally {
			button.disabled = false;
		}
	}

	// =====================================================
	// CREATE EMPLOYEE
	// =====================================================

	async function createEmployee(event) {
		event.preventDefault();

		if (state.creating) {
			return;
		}

		const username = el(
			'new-employee-username'
		).value.trim();

		const email = el(
			'new-employee-email'
		).value.trim();

		const password = el(
			'new-employee-password'
		).value;

		const passwordConfirm = el(
			'new-employee-password-confirm'
		).value;

		if (password !== passwordConfirm) {
			feedback(
				'create-employee-message',
				'Passwords do not match.',
				'error'
			);
			return;
		}

		/*
		 * Client-side validation improves UX.
		 * The PHP API validates the password again.
		 */
		const validPassword =
			Array.from(password).length >= 12 &&
			new TextEncoder().encode(password).length <= 72 &&
			/[A-Z]/.test(password) &&
			/[a-z]/.test(password) &&
			/[0-9]/.test(password) &&
			/[^\p{L}\p{N}\s]/u.test(password);

		if (!validPassword) {
			feedback(
				'create-employee-message',
				'Use at least 12 characters (up to 72 bytes), ' +
				'with uppercase, lowercase, number and ' +
				'special character.',
				'error'
			);
			return;
		}

		const button = el(
			'create-employee-button'
		);

		button.disabled = true;
		button.textContent = 'Creating...';

		state.creating = true;

		try {
			const csrfToken = await token(
				'admin-create-employee.php'
			);

			const data = await request(
				'admin-create-employee.php',
				{
					method: 'POST',
					csrfToken,
					body: {
						username,
						email,
						password,
						password_confirm: passwordConfirm
					}
				}
			);

			el('create-employee-form').reset();

			await Promise.allSettled([
				loadOverview(),
				loadEmployees(),
				loadActivity()
			]);

			feedback(
				'create-employee-message',
				data.message,
				data.activity_logged === false
					? 'error'
					: 'success'
			);
		} catch (error) {
			feedback(
				'create-employee-message',
				error.message,
				'error'
			);
		} finally {
			state.creating = false;

			button.disabled = false;
			button.textContent = 'Create Employee';
		}
	}

	/* =====================================================
		 PROMOTION DIALOG EVENTS
	===================================================== */

	el('promote-player-dialog-form').addEventListener(
		'submit',
		confirmPlayerPromotion
	);

	el('promote-player-dialog-cancel').addEventListener(
		'click',
		() => {
			if (!state.promoting) {
				promoteDialog.close();
			}
		}
	);

	promoteDialog.addEventListener('cancel', (event) => {
		if (state.promoting) {
			event.preventDefault();
		}
	});

	promoteDialog.addEventListener('close', () => {
		playerPendingPromotion = null;
	});

	/* =====================================================
		 EMPLOYEE PASSWORD MANAGEMENT
	===================================================== */

	const employeePasswordDialog = el('employee-password-dialog');
	const employeePasswordForm = el('employee-password-form');

	let passwordEmployee = null;
	let passwordUpdateInProgress = false;

	function openEmployeePasswordDialog(employee) {
		if (passwordUpdateInProgress || employeePasswordDialog.open) {
			return;
		}

		passwordEmployee = employee;
		employeePasswordForm.reset();

		el('employee-password-description').textContent =
			`Set a new password for ${employee.username}.`;

		feedback('employee-password-error');

		employeePasswordDialog.showModal();
		el('employee-new-password').focus();
	}

	async function updateEmployeePassword(event) {
		event.preventDefault();

		if (!passwordEmployee || passwordUpdateInProgress) {
			return;
		}

		const password = el('employee-new-password').value;
		const passwordConfirm = el('employee-confirm-password').value;

		feedback('employee-password-error');

		if (password !== passwordConfirm) {
			feedback(
				'employee-password-error',
				'Passwords do not match.',
				'error'
			);
			return;
		}

		const validPassword =
			Array.from(password).length >= 12 &&
			new TextEncoder().encode(password).length <= 72 &&
			/[A-Z]/.test(password) &&
			/[a-z]/.test(password) &&
			/[0-9]/.test(password) &&
			/[^\p{L}\p{N}\s]/u.test(password);

		if (!validPassword) {
			feedback(
				'employee-password-error',
				'Password must have at least 12 characters, ' +
				'no more than 72 bytes, uppercase and lowercase ' +
				'letters, a number and a special character.',
				'error'
			);
			return;
		}

		passwordUpdateInProgress = true;

		const employeeId = Number(passwordEmployee.id);
		const confirmButton = el('employee-password-confirm');
		const cancelButton = el('employee-password-cancel');

		confirmButton.disabled = true;
		cancelButton.disabled = true;
		confirmButton.textContent = 'Updating...';

		try {
			const csrfToken = await token(
				'admin-reset-employee-password.php'
			);

			const result = await request(
				'admin-reset-employee-password.php',
				{
					method: 'POST',
					csrfToken,
					body: {
						employee_id: employeeId,
						password,
						password_confirm: passwordConfirm
					}
				}
			);

			employeePasswordDialog.close();
			employeePasswordForm.reset();

			feedback(
				'employees-message',
				result.activity_logged === false
					? 'Password updated, but activity logging failed.'
					: result.message,
				result.activity_logged === false ? 'error' : 'success'
			);

			await loadActivity();

		} catch (error) {
			feedback(
				'employee-password-error',
				error.message,
				'error'
			);

		} finally {
			passwordUpdateInProgress = false;
			confirmButton.disabled = false;
			cancelButton.disabled = false;
			confirmButton.textContent = 'Update Password';
		}
	}

	employeePasswordForm.addEventListener(
		'submit',
		updateEmployeePassword
	);

	el('employee-password-cancel').addEventListener(
		'click',
		() => {
			if (!passwordUpdateInProgress) {
				employeePasswordDialog.close();
			}
		}
	);

	employeePasswordDialog.addEventListener('cancel', (event) => {
		if (passwordUpdateInProgress) {
			event.preventDefault();
		}
	});

	employeePasswordDialog.addEventListener('close', () => {
		employeePasswordForm.reset();
		passwordEmployee = null;
	});

	/* =====================================================
		 EMPLOYEE ACCOUNT DELETION
	===================================================== */

	const employeeDeleteDialog = el('employee-delete-dialog');
	const employeeDeleteForm = el('employee-delete-form');

	let employeePendingDeletion = null;
	let employeeDeletionInProgress = false;

	function openEmployeeDeleteDialog(employee) {
		if (employeeDeletionInProgress || employeeDeleteDialog.open) {
			return;
		}

		employeePendingDeletion = employee;

		el('employee-delete-description').textContent =
			`Permanently delete ${employee.username} ` +
			`(ID #${employee.id})?`;

		feedback('employee-delete-error');

		employeeDeleteDialog.showModal();
	}

	async function confirmEmployeeDeletion(event) {
		event.preventDefault();

		if (!employeePendingDeletion || employeeDeletionInProgress) {
			return;
		}

		const employee = employeePendingDeletion;

		employeeDeletionInProgress = true;

		const confirmButton = el('employee-delete-confirm');
		const cancelButton = el('employee-delete-cancel');

		confirmButton.disabled = true;
		cancelButton.disabled = true;
		confirmButton.textContent = 'Deleting...';

		feedback('employee-delete-error');

		try {
			const csrfToken = await token(
				'admin-delete-employee.php'
			);

			const result = await request(
				'admin-delete-employee.php',
				{
					method: 'POST',
					csrfToken,
					body: {
						employee_id: Number(employee.id)
					}
				}
			);

			employeeDeleteDialog.close();

			await Promise.allSettled([
				loadEmployees(),
				loadOverview(),
				loadActivity()
			]);

			feedback(
				'employees-message',
				result.activity_logged === false
					? 'Employee deleted, but activity logging failed.'
					: `${employee.username} (ID #${employee.id}) deleted successfully.`,
				result.activity_logged === false
					? 'error'
					: 'success'
			);

		} catch (error) {
			feedback(
				'employee-delete-error',
				error.message,
				'error'
			);

		} finally {
			employeeDeletionInProgress = false;

			confirmButton.disabled = false;
			cancelButton.disabled = false;
			confirmButton.textContent = 'Delete Employee';
		}
	}

	employeeDeleteForm.addEventListener(
		'submit',
		confirmEmployeeDeletion
	);

	el('employee-delete-cancel').addEventListener(
		'click',
		() => {
			if (!employeeDeletionInProgress) {
				employeeDeleteDialog.close();
			}
		}
	);

	employeeDeleteDialog.addEventListener('cancel', (event) => {
		if (employeeDeletionInProgress) {
			event.preventDefault();
		}
	});

	employeeDeleteDialog.addEventListener('close', () => {
		employeePendingDeletion = null;
	});

	/* =====================================================
		 CHARACTER CUSTOMIZATION HISTORY
	===================================================== */

	const characterHistoryLabels = {
		'character.created': 'Created',
		'character.duplicated': 'Duplicated',
		'character.updated': 'Updated'
	};

	function historyDetail(label, value) {
		const line = document.createElement('div');
		const strong = document.createElement('strong');

		strong.textContent = `${label}: `;

		line.appendChild(strong);
		line.appendChild(
			document.createTextNode(String(value ?? '—'))
		);

		return line;
	}

	async function loadCharacterHistory() {
		const button = el('refresh-character-history');
		const tbody = el('character-history-body');

		button.disabled = true;

		try {
			const data = await request(
				'admin-character-history.php'
			);

			if (!Array.isArray(data.history)) {
				throw new Error('Invalid character history response.');
			}

			tbody.replaceChildren();

			if (data.history.length === 0) {
				emptyRow(
					tbody,
					5,
					'No character customization history recorded yet.'
				);
			}

			for (const entry of data.history) {
				const row = document.createElement('tr');

				let formattedDate = '—';

				if (entry.created_at) {
					const date = new Date(entry.created_at);

					if (!Number.isNaN(date.getTime())) {
						formattedDate = new Intl.DateTimeFormat(
							undefined,
							{
								dateStyle: 'medium',
								timeStyle: 'short'
							}
						).format(date);
					}
				}

				textCell(row, formattedDate);

				textCell(
					row,
					`${entry.character_name} (#${entry.character_id})`
				);

				textCell(
					row,
					`${entry.username} (#${entry.user_id})`
				);

				textCell(
					row,
					characterHistoryLabels[entry.action] ||
					entry.action ||
					'Unknown'
				);

				const detailsCell = document.createElement('td');
				const details = document.createElement('details');
				const summary = document.createElement('summary');

				summary.textContent = 'View customization';

				details.appendChild(summary);

				const appearance = entry.appearance || {};

				const fields = [
					['Gender', entry.gender],
					['Hair Style', appearance.hair_style],
					['Hair Color', appearance.hair_color],
					['Eye Shape', appearance.eye_shape],
					['Eye Color', appearance.eye_color],
					['Nose Shape', appearance.nose_shape],
					['Mouth Shape', appearance.mouth_shape],
					['Skin Color', appearance.skin_color]
				];

				if (entry.source_character_id) {
					fields.unshift([
						'Source Character',
						`#${entry.source_character_id}`
					]);
				}

				for (const [label, value] of fields) {
					details.appendChild(historyDetail(label, value));
				}

				const equipment = Array.isArray(entry.equipment)
					? entry.equipment
					: [];

				details.appendChild(
					historyDetail(
						'Equipment',
						equipment.length
							? equipment
								.map(
									(item) =>
										`${item.name} (#${item.id}, ${item.type})`
								)
								.join(', ')
							: 'None'
					)
				);

				detailsCell.appendChild(details);
				row.appendChild(detailsCell);

				tbody.appendChild(row);
			}

			el('character-history-count').textContent =
				`Showing ${data.history.length} recent events ` +
				'(maximum 100).';

			feedback('character-history-message');

		} catch (error) {
			feedback(
				'character-history-message',
				error.message,
				'error'
			);

		} finally {
			button.disabled = false;
		}
	}

	el('refresh-character-history').addEventListener(
		'click',
		loadCharacterHistory
	);

	// =====================================================
	// INITIALIZATION
	// =====================================================

	async function initialize() {
		el('admin-content').hidden = true;

		// Verify administrator access before loading data.
		if (!await loadOverview()) {
			return;
		}

		el('admin-content').hidden = false;

		await Promise.allSettled([
			loadPlayers(),
			loadEmployees(),
			loadActivity(),
			loadCharacterHistory()
		]);
	}

	// =====================================================
	// EVENT LISTENERS
	// =====================================================

	el('refresh-overview').addEventListener(
		'click',
		loadOverview
	);

	el('promote-user-search').addEventListener(
		'input',
		playerOptions
	);

	el('promote-user-select').addEventListener(
		'change',
		playerOptions
	);

	el('promote-employee-form').addEventListener(
		'submit',
		promote
	);

	el('employee-search').addEventListener(
		'input',
		renderEmployees
	);

	el('employee-status-filter').addEventListener(
		'change',
		renderEmployees
	);

	el('refresh-employees').addEventListener(
		'click',
		loadEmployees
	);

	el('refresh-activity').addEventListener(
		'click',
		loadActivity
	);

	el('create-employee-form').addEventListener(
		'submit',
		createEmployee
	);

	el('employee-action-form').addEventListener(
		'submit',
		updateEmployee
	);

	el('employee-action-cancel').addEventListener(
		'click',
		() => {
			if (!state.busy) {
				el('employee-action-dialog').close();
			}
		}
	);

	el('employee-action-dialog').addEventListener(
		'cancel',
		(event) => {
			if (state.busy) {
				event.preventDefault();
			}
		}
	);

	el('employee-action-dialog').addEventListener(
		'close',
		() => {
			state.selected = null;
		}
	);

	initialize();
})();
