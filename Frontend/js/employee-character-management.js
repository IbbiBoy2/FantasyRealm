/*
 * FANTASYREALM - STAFF CHARACTER DELETION UI
 *
 * Adds the character catalogue and confirmation dialog to the current
 * employee dashboard without changing its existing moderation features.
 * Authorization and deletion validation are enforced by PHP APIs.
 */
(() => {
  'use strict';

  const API = '/FantasyRealm/Backend/api/';
  const workspace = document.getElementById('employee-content');
  const characterSection = document.getElementById('employee-characters');
  if (!workspace || !characterSection) return;

  let characters = [];
  let selectedCharacter = null;
  let busy = false;

  /* Build DOM nodes without interpreting user-supplied text as HTML. */
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function showMessage(target, message, isError = false) {
    target.textContent = message;
    target.hidden = !message;
    target.classList.toggle('is-error', isError);
    target.classList.toggle('is-success', !isError && !!message);
  }

  /* Match the current dashboard's same-origin session and CSRF rules. */
  async function request(path, payload) {
    const headers = { Accept: 'application/json' };
    if (payload !== undefined) {
      const response = await fetch(API + 'session.php', {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Unable to verify your session.');
      const session = await response.json();
      if (!session.authenticated || !session.csrf_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = session.csrf_token;
    }

    const response = await fetch(API + path, {
      method: payload === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Unexpected server response.');
    }
    if (response.status === 401) {
      window.location.assign('login.html');
      throw new Error('Authentication required.');
    }
    if (response.status === 403) {
      workspace.hidden = true;
      throw new Error('Employee access required.');
    }
    if (!response.ok || data.success !== true) {
      throw new Error(data.message || 'Unable to complete this request.');
    }
    return data;
  }

  /* Create an additional staff section using existing dashboard styles. */
  const section = element('section', 'employee-section');
  section.id = 'employee-manage-characters';
  section.setAttribute('aria-labelledby', 'employee-manage-characters-title');

  const heading = element('div', 'employee-section-head');
  const headingText = element('div');
  headingText.appendChild(element('p', 'employee-eyebrow', 'CHARACTER MANAGEMENT'));
  const title = element('h2', '', 'Manage Existing Characters');
  title.id = 'employee-manage-characters-title';
  headingText.appendChild(title);
  headingText.appendChild(element(
    'p', '', 'Find existing characters and remove those that violate the rules.'
  ));
  heading.appendChild(headingText);

  const refresh = element('button', 'employee-button-secondary', 'Refresh');
  refresh.type = 'button';
  heading.appendChild(refresh);
  section.appendChild(heading);

  const searchPanel = element('div', 'employee-panel employee-search-panel');
  const label = element('label', '', 'Search characters by name, creator or ID');
  label.htmlFor = 'employee-character-search';
  const search = element('input');
  search.id = 'employee-character-search';
  search.type = 'search';
  search.placeholder = 'Search existing characters...';
  searchPanel.append(label, search);
  section.appendChild(searchPanel);

  const status = element('p', 'employee-feedback');
  status.id = 'staff-character-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  const list = element('div', 'employee-card-grid');
  list.id = 'staff-character-list';
  section.append(status, list);
  characterSection.insertAdjacentElement('afterend', section);

  // Include this module in the dashboard's existing section shortcuts.
  const nav = document.querySelector('.employee-jump-links');
  if (nav) {
    const link = element('a', '', 'Manage Characters');
    link.href = '#employee-manage-characters';
    nav.appendChild(link);
  }

  /* Use one native dialog with an explicit reason and irreversible warning. */
  const dialog = element('dialog', 'employee-dialog staff-character-delete-dialog');
  dialog.id = 'staff-character-delete-dialog';
  dialog.setAttribute('aria-labelledby', 'staff-delete-title');

  const form = element('form');
  form.id = 'staff-character-delete-form';
  const dialogTitle = element('h2', '', 'Delete Character');
  dialogTitle.id = 'staff-delete-title';
  const description = element('p');
  description.id = 'staff-delete-description';
  const warning = element(
    'p', 'employee-dialog-note',
    'This permanently removes the character, its appearance, equipment links and reviews. This cannot be undone.'
  );
  const reasonLabel = element('label', '', 'Deletion reason');
  reasonLabel.htmlFor = 'staff-delete-reason';
  const reason = element('textarea');
  reason.id = 'staff-delete-reason';
  reason.rows = 4;
  reason.maxLength = 1000;
  reason.required = true;
  reason.placeholder = 'Explain why this character must be removed...';
  const error = element('p', 'employee-feedback');
  error.id = 'staff-delete-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const buttons = element('div', 'employee-dialog-actions');
  const cancel = element('button', 'employee-button-secondary', 'Cancel');
  cancel.type = 'button';
  const confirm = element('button', 'employee-button-danger', 'Permanently Delete');
  confirm.type = 'submit';
  buttons.append(cancel, confirm);
  form.append(dialogTitle, description, warning, reasonLabel, reason, error, buttons);
  dialog.appendChild(form);
  document.body.appendChild(dialog);

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }

  /* Restrict filtering to loaded text; every record is authorized server-side. */
  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const visible = characters.filter((character) => {
      return [character.name, character.creator_username, String(character.id)]
        .some((value) => String(value).toLocaleLowerCase().includes(term));
    });

    list.replaceChildren();
    if (!visible.length) {
      list.appendChild(element(
        'p', 'employee-feedback',
        characters.length ? 'No characters match your search.' : 'No characters found.'
      ));
      return;
    }

    visible.forEach((character) => {
      const card = element('article', 'employee-card');
      card.appendChild(element('h3', '', character.name));
      card.appendChild(element('p', 'employee-meta', `Character ID: ${character.id}`));
      card.appendChild(element('p', 'employee-meta', `Creator: ${character.creator_username}`));
      card.appendChild(element('p', 'employee-meta', `Status: ${character.status}`));
      card.appendChild(element('p', 'employee-meta', `Created: ${formatDate(character.created_at)}`));

      const actions = element('div', 'employee-card-actions');
      const remove = element('button', 'employee-button-danger', 'Delete Character');
      remove.type = 'button';
      remove.addEventListener('click', () => {
        if (busy || selectedCharacter) return;
        selectedCharacter = character;
        description.textContent = `Permanently delete "${character.name}" (#${character.id}) created by ${character.creator_username}?`;
        reason.value = '';
        showMessage(error, '');
        dialog.showModal();
        reason.focus();
      });
      actions.appendChild(remove);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  async function load() {
    if (busy) return;
    refresh.disabled = true;
    try {
      const data = await request('employee-characters.php');
      characters = data.characters || [];
      render();
      showMessage(status, '');
    } catch (caught) {
      // Do not keep stale deletion targets after a failed refresh.
      characters = [];
      list.replaceChildren();
      showMessage(status, caught.message, true);
    } finally {
      refresh.disabled = false;
    }
  }

  cancel.addEventListener('click', () => {
    if (!busy) dialog.close();
  });
  dialog.addEventListener('cancel', (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    if (!busy) selectedCharacter = null;
  });
  refresh.addEventListener('click', load);
  search.addEventListener('input', render);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !selectedCharacter) return;

    const explanation = reason.value.trim();
    if (!explanation || Array.from(explanation).length > 1000) {
      showMessage(error, 'Enter a reason of 1 to 1000 characters.', true);
      reason.focus();
      return;
    }

    const target = selectedCharacter;
    busy = true;
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      const result = await request('delete-staff-character.php', {
        character_id: Number(target.id),
        reason: explanation
      });
      dialog.close();
      selectedCharacter = null;
      characters = characters.filter((character) => Number(character.id) !== Number(target.id));
      render();
      showMessage(status, result.message || 'Character permanently deleted.');

      // Refresh the existing moderation queue and counters without
      // duplicating the original dashboard's private controller functions.
      const queueRefresh = document.querySelector('[data-refresh="characters"]');
      if (queueRefresh) queueRefresh.click();
    } catch (caught) {
      showMessage(error, caught.message, true);
    } finally {
      busy = false;
      confirm.disabled = false;
      cancel.disabled = false;
    }
  });

  // The API independently checks permissions, including if the page is
  // briefly visible before the main dashboard's authorization request.
  load();
})();
