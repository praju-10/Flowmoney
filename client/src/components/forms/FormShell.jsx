import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import { useApp } from '../../context/AppContext.jsx';

/** Shared modal+submit handling: shows server validation errors per field, never silently fails. */
export default function FormShell({ title, description, submitLabel = 'Save', onSubmit, children, danger }) {
  const { closeModal, refresh, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  async function handle(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormError('');
    try {
      const msg = await onSubmit(new FormData(e.target));
      refresh(); closeModal(); if (msg) toast(msg);
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.fields && Object.keys(err.fields).length ? '' : err.message);
      if (!err.fields) toast(err.message, 'error');
    } finally { setBusy(false); }
  }
  return (
    <Modal title={title} description={description} onClose={closeModal}>
      <form onSubmit={handle} noValidate>
        {typeof children === 'function' ? children(errors) : children}
        {formError && <p className="errText" role="alert">{formError}</p>}
        <div className="modalActions">
          <button type="button" className="secondary" onClick={closeModal}>Cancel</button>
          <button className={danger ? 'primary dangerBtn' : 'primary'} type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
