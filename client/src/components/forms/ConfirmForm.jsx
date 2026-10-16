import FormShell from './FormShell.jsx';

export default function ConfirmForm({ title, message, confirmLabel = 'Delete', action, doneMessage }) {
  return (
    <FormShell title={title} description={message} submitLabel={confirmLabel} danger onSubmit={async () => { await action(); return doneMessage; }}>
      <></>
    </FormShell>
  );
}
