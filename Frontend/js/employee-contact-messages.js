/**
 * FANTASYREALM - STAFF CONTACT INBOX
 *
 * Adds a read-only Contact Messages section to the existing employee page.
 * Messages are fetched from a protected PHP endpoint, not embedded in HTML.
 * Dynamic sender content is added with textContent to prevent XSS.
 */
(() => {
  'use strict';

  const API_URL = '/FantasyRealm/Backend/api/employee-contact-messages.php';
  let currentPage = 1;
  let currentSearch = '';
  let requestCounter = 0;
  let searchDebounce;

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  }

  function formatDate(value) {
    if (!value) return 'Unknown date';
    // The API returns MariaDB DATETIME; parse as local time.
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function makeInbox() {
    const root = document.getElementById('employee-content');
    const nav = document.querySelector('.employee-jump-links');
    if (!root || !nav || document.getElementById('employee-contact')) return null;

    const link = node('a', '', 'Contact Messages');
    link.href = '#employee-contact';
    nav.appendChild(link);

    const section = node('section', 'employee-section employee-contact-section');
    section.id = 'employee-contact';
    section.setAttribute('aria-labelledby', 'employee-contact-title');

    const heading = node('div', 'employee-section-head');
    const titleBox = node('div');
    titleBox.appendChild(node('p', 'employee-eyebrow', 'CUSTOMER SUPPORT'));
    const title = node('h2', '', 'Contact Messages');
    title.id = 'employee-contact-title';
    titleBox.appendChild(title);
    titleBox.appendChild(node('p', '', 'Read messages submitted through the contact form.'));
    heading.appendChild(titleBox);
    const refresh = node('button', 'employee-button-secondary', 'Refresh');
    refresh.type = 'button';
    refresh.addEventListener('click', () => loadInbox());
    heading.appendChild(refresh);
    section.appendChild(heading);

    const searchPanel = node('div', 'employee-panel employee-contact-search');
    const label = node('label', '', 'Search by username or email');
    label.htmlFor = 'contact-message-search';
    const search = node('input');
    search.type = 'search';
    search.id = 'contact-message-search';
    search.placeholder = 'Search sender...';
    search.maxLength = 100;
    label.appendChild(search);
    searchPanel.appendChild(label);
    search.addEventListener('input', () => {
      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(() => {
        currentPage = 1;
        currentSearch = search.value.trim();
        loadInbox();
      }, 250);
    });
    section.appendChild(searchPanel);

    const status = node('p', 'employee-feedback');
    status.id = 'employee-contact-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    section.appendChild(status);

    const list = node('div', 'employee-contact-list');
    list.id = 'employee-contact-list';
    section.appendChild(list);

    const paging = node('div', 'employee-contact-pagination');
    const previous = node('button', 'employee-button-secondary', 'Previous');
    previous.type = 'button';
    previous.addEventListener('click', () => {
      if (currentPage > 1) { currentPage -= 1; loadInbox(); }
    });
    const indicator = node('span', 'employee-meta');
    indicator.id = 'employee-contact-pages';
    const next = node('button', 'employee-button-secondary', 'Next');
    next.type = 'button';
    next.addEventListener('click', () => { currentPage += 1; loadInbox(); });
    paging.append(previous, indicator, next);
    paging.id = 'employee-contact-pagination';
    section.appendChild(paging);

    // Insert after the existing player moderation panel.
    const players = document.getElementById('employee-users');
    if (players) players.after(section);
    else root.appendChild(section);
    return section;
  }

  function renderMessage(data) {
    const item = node('article', 'employee-panel employee-contact-message');
    const heading = node('div', 'employee-contact-message-heading');
    heading.appendChild(node('h3', '', data.username || 'Unknown sender'));
    heading.appendChild(node('time', 'employee-meta', formatDate(data.created_at)));
    item.appendChild(heading);

    const sender = node('p', 'employee-meta');
    sender.appendChild(node('span', '', 'Email: '));
    const email = node('a', '', data.email || '');
    email.href = `mailto:${encodeURIComponent(data.email || '')}`;
    sender.appendChild(email);
    item.appendChild(sender);
    item.appendChild(node('p', 'employee-meta', data.user_id == null ? 'Guest submission' : `Registered account #${data.user_id}`));

    const details = document.createElement('details');
    details.className = 'employee-contact-details';
    details.appendChild(node('summary', '', 'Read message'));
    details.appendChild(node('p', 'employee-contact-body', data.message || ''));
    item.appendChild(details);
    return item;
  }

  async function loadInbox() {
    const list = document.getElementById('employee-contact-list');
    const status = document.getElementById('employee-contact-status');
    const pagination = document.getElementById('employee-contact-pagination');
    if (!list || !status) return;
    const serial = ++requestCounter;
    status.hidden = false;
    status.classList.remove('is-error');
    status.textContent = 'Loading contact messages...';

    try {
      const url = `${API_URL}?page=${currentPage}&q=${encodeURIComponent(currentSearch)}`;
      const response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const payload = await response.json();
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.message || 'Unable to load contact messages.');
      }
      if (serial !== requestCounter) return;

      list.replaceChildren();
      for (const message of payload.messages) list.appendChild(renderMessage(message));
      status.textContent = payload.total === 0
        ? 'No contact messages found.'
        : `${payload.total} message${payload.total === 1 ? '' : 's'} found.`;

      const totalPages = Math.max(1, Number(payload.total_pages) || 1);
      pagination.hidden = totalPages <= 1;
      pagination.querySelector('#employee-contact-pages').textContent = `Page ${currentPage} of ${totalPages}`;
      const buttons = pagination.querySelectorAll('button');
      buttons[0].disabled = currentPage <= 1;
      buttons[1].disabled = currentPage >= totalPages;
    } catch (error) {
      if (serial !== requestCounter) return;
      list.replaceChildren();
      pagination.hidden = true;
      status.textContent = error.message || 'Unable to load contact messages.';
      status.classList.add('is-error');
    }
  }

  function initialize() {
    // The existing employee controller manages authentication and hides the
    // workspace if the server denies staff access. This inbox does not weaken it.
    if (makeInbox()) loadInbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
