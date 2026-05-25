// Generic UI helpers shared by the study-session modules.
const modalFocusStack = [];

// Escape dynamic text before using it inside HTML strings.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    return {
      '&': '&amp;',

      '<': '&lt;',

      '>': '&gt;',

      '"': '&quot;',

      "'": '&#39;',
    }[char];
  });
}

// Clamp progress-like values so sliders, meters, and scores always stay between 0 and 100.
function asPercent(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

// Build a short avatar label from a member name, falling back to "U" for unknown users.
function initials(name) {
  const letters = String(name || 'U')
    .trim()

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part.charAt(0).toUpperCase())

    .join('');

  return letters || 'U';
}

// Pick the Font Awesome icon that best matches an uploaded evidence type.
function fileIcon(type) {
  if (type === 'image') return 'fa-file-image';

  if (type === 'file') return 'fa-file-lines';

  return 'fa-square-root-alt';
}

// Show a page-level status message without replacing the rest of the session UI.
function showMessage(text, type = 'info') {
  page.message.textContent = text;

  page.message.className = `session-alert session-alert-${type}`;
}

// Hide the page-level status area after a successful action or a fresh load.
function clearMessage() {
  page.message.textContent = '';
  page.message.className = 'session-alert d-none';
}

// Find focusable controls inside a modal so keyboard users stay inside the active dialog.
function focusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', '),
    ),
  ).filter((element) => {
    const style = window.getComputedStyle(element);
    return (
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  });
}

// Open or close a modal while remembering where focus should return afterwards.
function showModal(modal, shouldShow) {
  if (!modal) return;
  const wasHidden = modal.classList.contains('d-none');

  if (shouldShow && wasHidden) modalFocusStack.push(document.activeElement);
  modal.classList.toggle('d-none', !shouldShow);
  modal.setAttribute('aria-hidden', String(!shouldShow));
  if (shouldShow && wasHidden) {
    if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
    window.setTimeout(() => (focusableElements(modal)[0] || modal).focus(), 0);
  }
  if (!shouldShow && !wasHidden) {
    const previousFocus = modalFocusStack.pop();
    if (previousFocus?.isConnected) previousFocus.focus();
  }
}

// Toggle groups of related buttons during async work.
function setButtonsDisabled(buttons, disabled) {
  buttons.filter(Boolean).forEach((button) => {
    button.disabled = disabled;
  });
}

// Create a small temporary toast, optionally as a clickable action.
function showToast({ title, message, type = 'info', actionLabel = '', action = null }) {
  if (!page.toastContainer) return null;

  const toast = document.createElement(action ? 'button' : 'div');

  toast.className = `session-toast session-toast-${type}`;

  if (action) toast.type = 'button';

  toast.innerHTML = `

    <strong>${escapeHtml(title)}</strong>

    ${message ? `<p>${escapeHtml(message)}</p>` : ''}

    ${actionLabel ? `<span>${escapeHtml(actionLabel)}</span>` : ''}

  `;

  const removeToast = () => toast.remove();

  if (action) {
    toast.addEventListener('click', () => {
      removeToast();

      action();
    });
  }

  page.toastContainer.appendChild(toast);

  window.setTimeout(removeToast, 10000);

  return toast;
}

// Render a reusable empty-state paragraph for lists and panels.
function emptyText(text, className = 'member-evidence-empty') {
  return `<p class="${className}">${escapeHtml(text)}</p>`;
}

// Return every modal that can currently be dismissed from shared keyboard/backdrop logic.
function visibleModalClosers() {
  return [
    { modal: page.exitModal, close: () => showModal(page.exitModal, false) },
    { modal: page.queueModal, close: () => showModal(page.queueModal, false) },
    { modal: page.consultationModal, close: () => showModal(page.consultationModal, false) },
    { modal: page.consultationWorkspaceModal, close: closeConsultationWorkspace },
    {
      modal: page.consultationReviewModal,
      close: () => showModal(page.consultationReviewModal, false),
    },
    {
      modal: page.consultationDirectionModal,
      close: () => showModal(page.consultationDirectionModal, false),
    },
    { modal: page.memberGoalsModal, close: () => showModal(page.memberGoalsModal, false) },
    { modal: page.completionModal, close: () => showModal(page.completionModal, false) },
    {
      modal: page.intentionModal,
      close: () => {
        if (readSessionIntention()) showModal(page.intentionModal, false);
      },
    },
  ];
}

// Close whichever modal is visible when the user presses Escape.
function closeVisibleModalOnEscape(event) {
  if (event.key !== 'Escape') return;

  const visibleModal = visibleModalClosers().find(
    (item) => item.modal && !item.modal.classList.contains('d-none'),
  );
  if (!visibleModal) return;

  event.preventDefault();
  visibleModal.close();
}

// Keep Tab navigation inside the open modal instead of letting focus escape behind it.
function keepFocusInsideVisibleModal(event) {
  if (event.key !== 'Tab') return;

  const visibleModal = visibleModalClosers()
    .map((item) => item.modal)
    .find((modal) => modal && !modal.classList.contains('d-none'));
  if (!visibleModal) return;

  const focusableItems = focusableElements(visibleModal);
  if (!focusableItems.length) {
    event.preventDefault();
    visibleModal.focus();
    return;
  }

  const firstItem = focusableItems[0];
  const lastItem = focusableItems[focusableItems.length - 1];

  if (event.shiftKey && document.activeElement === firstItem) {
    event.preventDefault();
    lastItem.focus();
  } else if (!event.shiftKey && document.activeElement === lastItem) {
    event.preventDefault();
    firstItem.focus();
  }
}
