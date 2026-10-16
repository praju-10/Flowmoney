import { useApp } from '../../context/AppContext.jsx';
import TransactionForm from './TransactionForm.jsx';
import LoanForm from './LoanForm.jsx';
import PaymentForm from './PaymentForm.jsx';
import ProfileForm from './ProfileForm.jsx';
import ConfirmForm from './ConfirmForm.jsx';
import RestoreForm from './RestoreForm.jsx';
import ResetForm from './ResetForm.jsx';

export default function ModalHost() {
  const { modal } = useApp();
  if (!modal) return null;
  const { type, props } = modal;
  switch (type) {
    case 'transaction': return <TransactionForm {...props} />;
    case 'loan': return <LoanForm {...props} />;
    case 'payment': return <PaymentForm {...props} />;
    case 'profile': return <ProfileForm mode="profile" />;
    case 'goal': return <ProfileForm mode="goal" />;
    case 'confirm': return <ConfirmForm {...props} />;
    case 'restore': return <RestoreForm {...props} />;
    case 'reset': return <ResetForm />;
    default: return null;
  }
}
