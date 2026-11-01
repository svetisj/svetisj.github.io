'use strict';
window.SAINT_UI_CONFIG = Object.freeze({
  months: ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'],
  prefixes: { saint: 'Sv.', blessed: 'Bl.', venerable: 'Časni sluga Božji', 'servant-of-god': 'Sluga Božji' },
  filters: [
    { id: 'all', label: 'Svi' },
    { id: 'saint', label: 'Sveci', statuses: ['saint'] },
    { id: 'blessed', label: 'Blaženici', statuses: ['blessed'] },
    { id: 'servants', label: 'Sluge Božji', statuses: ['venerable', 'servant-of-god'] },
    { id: 'laity', label: 'Laici', groupId: 'laity' },
  ],
});
