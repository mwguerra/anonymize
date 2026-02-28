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
| `anonymize run <caminhos...>` | Anonimizar arquivo(s) ou diretório (comando principal) |
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

# Anonimizar múltiplos arquivos com consistência cruzada (requer --output com diretório)
anonymize run ./clientes.csv ./pedidos.xlsx --output ./safe/ --yes

# Dry run em múltiplos arquivos
anonymize run ./a.csv ./b.xlsx --output ./safe/ --dry-run

# Anonimizar diretório inteiro (requer --output)
anonymize run ./dados/ --output ./dados-safe/ --yes

# Dry run em diretório — ver plano sem modificar
anonymize run ./dados/ --output ./dados-safe/ --dry-run

# Anonimizar com agrupamento por identidade (CPF)
anonymize run ./clientes.csv --identity-column cpf --yes

# Múltiplos arquivos com identidade + consistência cruzada
anonymize run ./clientes.csv ./pedidos.xlsx --output ./safe/ --identity-column cpf --yes

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
| `--identity-column` | | Agrupar anonimização por coluna identidade (referencia um rule ID) | `undefined` |
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
      "generator": "faker.person.fullName()",
      "identityColumn": "cpf"
    },
    {
      "id": "cpf",
      "columns": ["cpf", "cpf_cnpj", "documento"],
      "generator": "faker.helpers.replaceSymbols('###.###.###-##')"
    }
  ],
  "columnOverrides": {
    "name": [
      { "file1.csv:Sheet1": "nome" },
      { "file2.xlsx:Clientes": "Nome do Cliente" }
    ],
    "email": "correo_electronico"
  }
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

### Coluna de Identidade (`identityColumn`)

Por padrão, todos os registros com o mesmo nome (ex: "Marcelo") recebem o mesmo nome fake. Com `identityColumn`, a anonimização é agrupada pela identidade real da pessoa:

```json
{
  "id": "name",
  "columns": ["nome"],
  "generator": "faker.person.fullName()",
  "identityColumn": "cpf"
}
```

Se houver 8 registros "Marcelo" mas 5 CPFs distintos, serão gerados 5 nomes fake diferentes. Registros com mesmo CPF + mesmo nome → mesmo nome fake.

Também disponível via CLI: `--identity-column cpf` (sobrescreve todas as regras).

### Mapeamento de Colunas (`columnOverrides`)

Quando arquivos diferentes usam nomes de colunas diferentes para os mesmos dados:

```json
{
  "columnOverrides": {
    "name": [
      { "arquivo1.csv:Sheet1": "nome" },
      { "arquivo2.xlsx:Clientes": "Nome do Cliente" }
    ],
    "email": "correo_electronico"
  }
}
```

- **String**: aplica para todos os arquivos (ex: `"email": "correo_electronico"`)
- **Array de objetos**: mapeia por `arquivo:aba` (ex: `[{ "file.csv:Sheet1": "nome" }]`)
- **Omitido**: usa o padrão (detecção por nome da coluna)

Prioridade: `columnOverrides` > detecção por padrão.

## Como Funciona

### Arquivo único
1. Lê o arquivo de entrada (CSV, XLS ou XLSX)
2. Detecta colunas sensíveis comparando nomes com as regras (case-insensitive, match parcial)
3. Exibe tabela de detecção para confirmação (pular com `--yes`)
4. Percorre cada célula marcada, substituindo por valores fake via `@faker-js/faker`
5. Mantém cache global: o mesmo valor original → mesmo valor fake (inclusive entre abas)
6. Gera arquivo de saída preservando estrutura e formatação

### Múltiplos arquivos
1. Lê todos os arquivos de entrada e detecta colunas sensíveis em cada um
2. Exibe tabela unificada de detecção para confirmação (pular com `--yes`)
3. Cria um cache único compartilhado entre todos os arquivos
4. Processa cada arquivo sequencialmente usando o cache compartilhado
5. O mesmo valor original → mesmo valor fake em todos os arquivos (ex: "José" em `a.csv` e `b.xlsx` → mesmo nome fake)
6. `--output` (diretório) é obrigatório. Não é permitido misturar arquivos e diretórios.

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
