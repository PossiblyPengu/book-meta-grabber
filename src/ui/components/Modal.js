import { icons } from '../icons.js';

export function Modal({
  title,
  body,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
}) {
  return `
    <div class="modal-overlay" data-action="close-modal">
      <div class="modal" data-stop-propagation>
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="btn-icon" data-action="close-modal" style="margin-left:auto">${
            icons.x
          }</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          <button class="btn" data-action="close-modal">${cancelText}</button>
          <button class="btn ${
            danger ? 'btn-danger' : 'btn-primary'
          }" data-action="confirm-modal">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
}
