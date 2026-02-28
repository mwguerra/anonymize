# @mwguerra/anonymize

CLI para anonimização determinística de dados pessoais em arquivos CSV, XLS e XLSX.

Detecta colunas sensíveis automaticamente, confirma com o usuário, e substitui valores de forma consistente — o mesmo valor original sempre gera o mesmo valor fake dentro de uma execução, inclusive entre múltiplas abas.

## Instalação

```bash
npm install -g @mwguerra/anonymize
```

Ou execute diretamente:

```bash
npx @mwguerra/anonymize run ./clientes.xlsx
```

## Uso

```bash
anonymize <comando> [opções]
```

### Comandos

| Comando | Descrição |
|---|---|
| `anonymize run <caminho>` | Anonimizar um arquivo ou diretório (comando principal) |
| `anonymize inspect <arquivo>` | Mostrar colunas detectadas sem modificar nada |
| `anonymize config:init` | Criar `.anonymizerc.json` no diretório atual |
| `anonymize config:show` | Exibir configuração resolvida |

### Exemplos

```bash
# Anonimizar CSV (interativo)
anonymize run ./dados.csv

# Anonimizar XLSX com saída customizada
anonymize run ./clientes.xlsx --output ./clientes-safe.xlsx

# Modo não-interativo (CI/CD)
anonymize run ./export.xlsx --yes --output ./export-safe.xlsx

# Dry run — ver plano sem modificar
anonymize run ./clientes.csv --dry-run

# Config customizada com locale inglês
anonymize run ./customers.csv --config ./my-rules.json --locale en_US

# Anonimizar diretório inteiro (requer --output)
anonymize run ./dados/ --output ./dados-safe/ --yes

# Dry run em diretório — ver plano sem modificar
anonymize run ./dados/ --output ./dados-safe/ --dry-run

# Inspecionar colunas detectadas
anonymize inspect ./clientes.csv

# Criar arquivo de configuração
anonymize config:init

# Ver configuração resolvida
anonymize config:show
anonymize config:show --config ./my-rules.json
```

## Flags (`run`)

| Flag | Alias | Descrição | Default |
|---|---|---|---|
| `--output` | `-o` | Caminho do arquivo de saída | `<input>.anonymized.<ext>` |
| `--config` | `-c` | Caminho do arquivo de configuração | Auto-detect |
| `--yes` | `-y` | Pular confirmação interativa | `false` |
| `--dry-run` | `-d` | Mostrar plano sem modificar | `false` |
| `--encoding` | `-e` | Forçar encoding do CSV | Auto-detect |
| `--delimiter` | | Forçar delimitador do CSV | Auto-detect |
| `--locale` | `-l` | Override do locale do faker | `pt_BR` |
| `--no-overwrite` | | Falhar se arquivo de saída já existe | `false` |
| `--verbose` | `-v` | Logs detalhados | `false` |
| `--silent` | `-s` | Suprimir toda saída exceto erros | `false` |

## Configuração

A ferramenta busca configuração nesta ordem:

1. Flag `--config <caminho>`
2. `.anonymizerc.json` no diretório do arquivo de entrada
3. `.anonymizerc.json` no diretório home do usuário
4. Configuração padrão embutida

### Formato

```json
{
  "locale": "pt_BR",
  "rules": [
    {
      "id": "name",
      "columns": ["nome", "name", "nome_completo", "full_name"],
      "generator": "faker.person.fullName()"
    },
    {
      "id": "cpf",
      "columns": ["cpf", "cpf_cnpj", "documento"],
      "generator": "faker.helpers.replaceSymbols('###.###.###-##')"
    }
  ]
}
```

### Regras Padrão

| Regra | Colunas Detectadas | Gerador |
|---|---|---|
| `name` | nome, name, nome_completo, full_name, ... | `faker.person.fullName()` |
| `cpf` | cpf, cpf_cnpj, documento, ... | `faker.helpers.replaceSymbols('###.###.###-##')` |
| `cnpj` | cnpj, cnpj_empresa | `faker.helpers.replaceSymbols('##.###.###/####-##')` |
| `email` | email, e-mail, email_address, ... | `faker.internet.email()` |
| `address` | endereco, endereço, address, logradouro, ... | `faker.location.streetAddress(...)` |
| `zipcode` | cep, zip, zipcode, ... | `faker.location.zipCode('#####-###')` |
| `phone` | telefone, phone, celular, whatsapp, ... | `faker.phone.number()` |

### Regras Customizadas

O campo `generator` aceita qualquer expressão válida do `@faker-js/faker`:

```json
{
  "id": "birthdate",
  "columns": ["data_nascimento", "birthdate"],
  "generator": "faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toISOString().split('T')[0]"
}
```

## Como Funciona

### Arquivo único
1. Lê o arquivo de entrada (CSV, XLS ou XLSX)
2. Detecta colunas sensíveis comparando nomes com as regras (case-insensitive, match parcial)
3. Exibe tabela de detecção para confirmação (pular com `--yes`)
4. Percorre cada célula marcada, substituindo por valores fake via `@faker-js/faker`
5. Mantém cache global: o mesmo valor original → mesmo valor fake (inclusive entre abas)
6. Gera arquivo de saída preservando estrutura e formatação

### Diretório
1. Percorre recursivamente o diretório de entrada
2. Replica a estrutura de pastas no diretório de saída
3. Arquivos suportados (.csv, .xls, .xlsx) são anonimizados individualmente
4. Arquivos não suportados (ex: .md, .txt, .pdf) são copiados sem alteração
5. Confirmação interativa é desabilitada no modo diretório (equivalente a `--yes`)

## Segurança

- O arquivo original nunca é modificado
- O cache de mapeamento existe apenas em memória (não é persistido)
- O campo `generator` executa código via `new Function()` com escopo limitado (apenas `faker` disponível) — cuidado ao usar configs de terceiros
- Valores originais não são logados (apenas contadores e nomes de colunas)

## Requisitos

- Node.js >= 18

## Licença

[MIT](LICENSE)
