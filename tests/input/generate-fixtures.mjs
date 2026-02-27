/**
 * One-time script to generate XLSX and XLS test fixtures.
 * Run: node tests/input/generate-fixtures.mjs
 *
 * These generated files are committed to git and should never be modified by tests.
 */
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

XLSX.set_fs(fs);

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- sample.xlsx: single sheet, same data as CSV ---
{
  const wb = XLSX.utils.book_new();
  const data = [
    ['nome', 'email', 'cpf', 'cidade', 'valor'],
    ['José da Silva', 'jose@example.com', '123.456.789-00', 'São Paulo', 1500.00],
    ['Maria Santos', 'maria@example.com', '987.654.321-00', 'Rio de Janeiro', 2300.50],
    ['José da Silva', 'jose@work.com', '123.456.789-00', 'São Paulo', 800.00],
    ['Ana Oliveira', 'ana.oliveira@test.com', '111.222.333-44', 'Belo Horizonte', 1200.00],
    ['Carlos Pereira', 'carlos.p@email.com', '555.666.777-88', 'Curitiba', 3100.75],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Clientes');
  XLSX.writeFile(wb, join(__dirname, 'sample.xlsx'));
  console.log('Created sample.xlsx');
}

// --- multi-sheet.xlsx: two sheets with cross-sheet overlap ---
{
  const wb = XLSX.utils.book_new();

  const sheet1 = [
    ['nome', 'cpf', 'email'],
    ['José da Silva', '123.456.789-00', 'jose@example.com'],
    ['Maria Santos', '987.654.321-00', 'maria@example.com'],
    ['Ana Oliveira', '111.222.333-44', 'ana@test.com'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), 'Clientes');

  const sheet2 = [
    ['nome', 'telefone', 'endereco'],
    ['José da Silva', '(11) 99999-0001', 'Rua das Flores 123'],
    ['Carlos Pereira', '(41) 98888-0002', 'Av. Paraná 500'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), 'Contatos');

  XLSX.writeFile(wb, join(__dirname, 'multi-sheet.xlsx'));
  console.log('Created multi-sheet.xlsx');
}

// --- sample.xls: old Excel format ---
{
  const wb = XLSX.utils.book_new();
  const data = [
    ['nome', 'email', 'cpf'],
    ['José da Silva', 'jose@example.com', '123.456.789-00'],
    ['Maria Santos', 'maria@example.com', '987.654.321-00'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Plan1');
  XLSX.writeFile(wb, join(__dirname, 'sample.xls'), { bookType: 'biff8' });
  console.log('Created sample.xls');
}

// --- headers-only.xlsx: sheet with only headers, no data rows ---
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['nome', 'email', 'cpf']]), 'Empty');
  XLSX.writeFile(wb, join(__dirname, 'headers-only.xlsx'));
  console.log('Created headers-only.xlsx');
}

// --- dupes.csv: duplicate names for cross-row consistency testing ---
fs.writeFileSync(join(__dirname, 'dupes.csv'), 'nome,valor\nJosé,100\nJosé,200\nMaria,300\n');
console.log('Created dupes.csv');

console.log('\nAll fixtures generated successfully.');
