const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers');

const KEY = 'financas:transacoes';
const text = (el) => el.textContent.replace(/ /g, ' ').trim();

function addTransaction(document, description, amount, type) {
  document.getElementById('description').value = description;
  document.getElementById('amount').value = amount;
  document.querySelector(`input[name="type"][value="${type}"]`).checked = true;
  document.getElementById('transaction-form').dispatchEvent(
    new document.defaultView.Event('submit', { bubbles: true, cancelable: true })
  );
}

test('página inicia vazia com valores zerados', () => {
  const { window } = loadPage();
  const doc = window.document;
  assert.equal(text(doc.getElementById('balance')), 'R$ 0,00');
  assert.equal(doc.getElementById('transactions-body').children.length, 0);
  assert.equal(doc.getElementById('empty-state').hidden, false);
});

test('adicionar entrada e saída atualiza cards e tabela com cores corretas', () => {
  const { window } = loadPage();
  const doc = window.document;

  addTransaction(doc, 'Salário', '5.000,00', 'income');
  addTransaction(doc, 'Aluguel', '1500', 'expense');

  assert.equal(text(doc.getElementById('income')), 'R$ 5.000,00');
  assert.equal(text(doc.getElementById('expense')), 'R$ 1.500,00');
  assert.equal(text(doc.getElementById('balance')), 'R$ 3.500,00');

  const rows = doc.querySelectorAll('#transactions-body tr');
  assert.equal(rows.length, 2);
  assert.ok(doc.querySelector('.amount--income'));
  assert.ok(doc.querySelector('.amount--expense'));
  assert.equal(doc.getElementById('empty-state').hidden, true);
  assert.equal(doc.getElementById('description').value, '', 'formulário deve ser limpo');
});

test('formulário inválido mostra erro e não adiciona nada', () => {
  const { window } = loadPage();
  const doc = window.document;
  addTransaction(doc, '', '10', 'income');
  assert.equal(doc.getElementById('form-error').hidden, false);
  assert.match(doc.getElementById('form-error').textContent, /descrição/);
  assert.equal(doc.querySelectorAll('#transactions-body tr').length, 0);
});

test('transações persistem no localStorage e voltam após recarregar (F5)', () => {
  const first = loadPage();
  addTransaction(first.window.document, 'Freela', '800', 'income');
  const saved = first.window.localStorage.getItem(KEY);
  assert.ok(saved);

  const second = loadPage({ storage: { [KEY]: saved } });
  const doc = second.window.document;
  assert.equal(doc.querySelectorAll('#transactions-body tr').length, 1);
  assert.equal(text(doc.querySelector('.cell-desc')), 'Freela');
  assert.equal(text(doc.getElementById('balance')), 'R$ 800,00');
});

test('remover transação atualiza totais e storage', () => {
  const { window } = loadPage();
  const doc = window.document;
  addTransaction(doc, 'Café', '10', 'expense');
  addTransaction(doc, 'Pix', '50', 'income');

  doc.querySelector('.amount--expense').closest('tr').querySelector('[data-action="remove"]').click();

  assert.equal(doc.querySelectorAll('#transactions-body tr').length, 1);
  assert.equal(text(doc.getElementById('balance')), 'R$ 50,00');
  assert.equal(JSON.parse(window.localStorage.getItem(KEY)).length, 1);
});

test('saldo negativo destaca o card de saldo', () => {
  const { window } = loadPage();
  const doc = window.document;
  addTransaction(doc, 'Conta', '100', 'expense');
  assert.ok(doc.getElementById('balance-card').classList.contains('is-negative'));
});

test('filtros mostram só entradas ou só saídas', () => {
  const { window } = loadPage();
  const doc = window.document;
  addTransaction(doc, 'A', '10', 'income');
  addTransaction(doc, 'B', '5', 'expense');
  addTransaction(doc, 'C', '7', 'expense');

  doc.querySelector('[data-filter="expense"]').click();
  assert.equal(doc.querySelectorAll('#transactions-body tr').length, 2);
  doc.querySelector('[data-filter="income"]').click();
  assert.equal(doc.querySelectorAll('#transactions-body tr').length, 1);
  doc.querySelector('[data-filter="all"]').click();
  assert.equal(doc.querySelectorAll('#transactions-body tr').length, 3);
});

test('descrição com HTML é exibida como texto (sem XSS)', () => {
  const { window } = loadPage();
  const doc = window.document;
  addTransaction(doc, '<img src=x onerror=alert(1)>', '1', 'income');
  assert.equal(doc.querySelector('#transactions-body img'), null);
  assert.equal(text(doc.querySelector('.cell-desc')), '<img src=x onerror=alert(1)>');
});
