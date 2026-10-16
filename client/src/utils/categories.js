// Visual identity for the four main groups — values taken from the original homepage's CATS object.
export const GROUPS = [
  { key: 'loan', name: 'Loan / EMI', short: 'Loan/EMI', icon: '⌂', color: '#7896ff', tint: '#101e42', verb: 'spent' },
  { key: 'saving', name: 'Saving', short: 'Saving', icon: '♧', color: '#4ce0c0', tint: '#0c282d', verb: 'saved' },
  { key: 'necessary', name: 'Necessary expenses', short: 'Necessary', icon: '✚', color: '#ffad65', tint: '#2a201b', verb: 'spent' },
  { key: 'misc', name: 'Misc', short: 'Misc', icon: '✣', color: '#b68aff', tint: '#211b3a', verb: 'spent' },
];
export const HEAT = ['#152747', '#243d73', '#354e9a', '#595ec3', '#8b72ed']; // original heat ramp
export const TYPE_LABEL = {
  income: 'Income', expense: 'Expense', saving: 'Saving', loan_payment: 'Loan payment', transfer: 'Transfer', refund: 'Refund',
};
// Which category groups each type may use (server enforces this too).
export const TYPE_GROUPS = {
  income: ['income'], expense: ['necessary', 'misc', 'loan'], saving: ['saving'], transfer: ['transfer'], refund: ['necessary', 'misc', 'loan'],
};
// Necessary and Misc show a final sum in the heatmap once a month has finished.
export const MONTH_END_GROUPS = ['necessary', 'misc'];
