import { sortByName } from './sort.js';

describe('sortByName', () => {
  it('sorts in Hungarian order, numbers by value', () => {
    const names = ['Nappali 10', 'Konyha', 'Étkező', 'Nappali 2', 'ebédlő'];
    expect(
      sortByName(names.map((name) => ({ name }))).map((x) => x.name),
    ).toEqual(['ebédlő', 'Étkező', 'Konyha', 'Nappali 2', 'Nappali 10']);
  });
});
