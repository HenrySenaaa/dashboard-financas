const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

// Intl usa espaço não separável entre "R$" e o número.
const brl = (s) => s.replace(/ /g, ' ');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data
  };
}

test('parseAmount aceita formatos brasileiros e rejeita lixo', () => {
  assert.equal(L.parseAmount('10'), 10);
  assert.equal(L.parseAmount('10,50'), 10.5);
  assert.equal(L.parseAmount('1.234,56'), 1234.56);
  assert.equal(L.parseAmount('R$ 99,90'), 99.9);
  assert.equal(L.parseAmount('12.5'), 12.5);
  assert.equal(L.parseAmount('1.450'), 1450, 'ponto como separador de milhar');
  assert.equal(L.parseAmount('1.200'), 1200);
  assert.equal(L.parseAmount('2.500.000'), 2500000);
  assert.equal(L.parseAmount('1.5'), 1.5);
  assert.ok(Number.isNaN(L.parseAmount('1.2.3')));
  assert.ok(Number.isNaN(L.parseAmount('abc')));
  assert.ok(Number.isNaN(L.parseAmount('')));
  assert.ok(Number.isNaN(L.parseAmount(null)));
});

test('createTransaction monta a transação com os campos certos', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const t = L.createTransaction({ description: '  Salário ', amount: '3.500,00', type: 'income' }, now);
  assert.equal(t.description, 'Salário');
  assert.equal(t.amount, 3500);
  assert.equal(t.type, 'income');
  assert.equal(t.date, now.toISOString());
  assert.equal(typeof t.id, 'string');
  assert.ok(t.id.length > 0);
});

test('createTransaction valida descrição, valor e tipo', () => {
  assert.throws(() => L.createTransaction({ description: '', amount: '10', type: 'income' }), /descrição/);
  assert.throws(() => L.createTransaction({ description: 'x'.repeat(81), amount: '10', type: 'income' }), /80/);
  assert.throws(() => L.createTransaction({ description: 'A', amount: '0', type: 'income' }), /maior que zero/);
  assert.throws(() => L.createTransaction({ description: 'A', amount: '-5', type: 'income' }), /maior que zero/);
  assert.throws(() => L.createTransaction({ description: 'A', amount: '10', type: 'outro' }), /entrada ou uma saída/);
});

test('createTransaction arredonda para centavos', () => {
  const t = L.createTransaction({ description: 'A', amount: 10.005, type: 'expense' });
  assert.equal(t.amount, 10.01);
});

test('calcSummary soma receitas, despesas e saldo sem erro de ponto flutuante', () => {
  const list = [
    { type: 'income', amount: 0.1 },
    { type: 'income', amount: 0.2 },
    { type: 'expense', amount: 0.3 },
    { type: 'income', amount: 1000 },
    { type: 'expense', amount: 250.75 }
  ];
  assert.deepEqual(L.calcSummary(list), { income: 1000.3, expense: 251.05, balance: 749.25 });
  assert.deepEqual(L.calcSummary([]), { income: 0, expense: 0, balance: 0 });
});

test('calcSummary aceita saldo negativo', () => {
  const s = L.calcSummary([{ type: 'income', amount: 50 }, { type: 'expense', amount: 80 }]);
  assert.equal(s.balance, -30);
});

test('formatCurrency usa o padrão brasileiro', () => {
  assert.equal(brl(L.formatCurrency(1234.5)), 'R$ 1.234,50');
  assert.equal(brl(L.formatCurrency(0)), 'R$ 0,00');
  assert.match(brl(L.formatCurrency(-30)), /-\s?R\$ 30,00/);
});

test('removeTransaction remove apenas o id informado', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(L.removeTransaction(list, 'b').map((t) => t.id), ['a', 'c']);
  assert.equal(list.length, 3, 'não deve mutar o array original');
});

test('save/load fazem o caminho de ida e volta no storage', () => {
  const storage = memoryStorage();
  const t = L.createTransaction({ description: 'Mercado', amount: '120,40', type: 'expense' });
  assert.equal(L.saveTransactions(storage, [t]), true);
  assert.deepEqual(L.loadTransactions(storage), [t]);
});

test('loadTransactions ignora JSON corrompido e itens inválidos', () => {
  assert.deepEqual(L.loadTransactions(memoryStorage({ [L.STORAGE_KEY]: '{quebrado' })), []);
  assert.deepEqual(L.loadTransactions(memoryStorage({ [L.STORAGE_KEY]: '{"a":1}' })), []);
  const mixed = JSON.stringify([
    { id: '1', description: 'ok', amount: 10, type: 'income', date: '2026-01-01' },
    { id: '2', description: 'sem valor', type: 'income' },
    null
  ]);
  assert.equal(L.loadTransactions(memoryStorage({ [L.STORAGE_KEY]: mixed })).length, 1);
  assert.deepEqual(L.loadTransactions(memoryStorage()), []);
});
