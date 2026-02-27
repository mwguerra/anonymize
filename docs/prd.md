# PRD — `@mwguerra/anonymize`

## Visão Geral

CLI em TypeScript para anonimização determinística de dados pessoais em arquivos XLS, XLSX e CSV. A ferramenta identifica colunas sensíveis, confirma com o usuário, e substitui os valores de forma consistente em todas as ocorrências — garantindo que o mesmo valor original sempre gere o mesmo valor fake dentro de uma execução.

---

## Problema

Desenvolvedores, analistas e equipes de QA frequentemente precisam trabalhar com dados reais exportados de sistemas internos (planilhas de clientes, relatórios financeiros, bases de teste). Compartilhar esses arquivos sem anonimização viola a LGPD e expõe a empresa a riscos legais. Hoje, esse processo é manual, inconsistente e propenso a erros.

---

## Solução

Uma ferramenta de terminal que:

1. Lê arquivos tabulares (XLS, XLSX, CSV).
2. Detecta automaticamente colunas com dados sensíveis com base em padrões de nomes.
3. Apresenta ao usuário as colunas detectadas para confirmação/ajuste.
4. Percorre linha a linha, coluna a coluna, substituindo valores reais por valores fake — mantendo consistência (mesmo CPF original → mesmo CPF fake em todas as linhas e abas).
5. Gera um novo arquivo anonimizado, preservando formatação e estrutura.

---

## Público-Alvo

- Desenvolvedores que precisam de dados realistas para testes.
- Analistas de dados que compartilham relatórios com terceiros.
- Equipes de compliance e DPOs que precisam sanitizar exports.

---

## Requisitos Funcionais

### RF-01 — Leitura de Arquivos

| Item | Detalhe |
|---|---|
| Formatos suportados | `.csv`, `.xls`, `.xlsx` |
| Múltiplas abas | Para XLS/XLSX, processar todas as abas (sheets) sequencialmente |
| Encoding CSV | Detectar automaticamente (UTF-8, Latin-1); flag `--encoding` para override |
| Delimitador CSV | Detectar automaticamente (`,`, `;`, `\t`); flag `--delimiter` para override |

### RF-02 — Detecção de Colunas Sensíveis

A ferramenta compara os nomes das colunas de cada aba contra as regras definidas no arquivo de configuração. Cada regra possui um array `columns` com padrões de nome (case-insensitive, match parcial).

**Algoritmo de match:**

```
Para cada coluna do arquivo:
  Para cada regra de configuração:
    Se o nome da coluna (lowercase, trimmed) contém algum dos padrões em rule.columns:
      → Marcar coluna como candidata àquela regra
```

### RF-03 — Confirmação Interativa

Após a detecção, exibir no terminal uma tabela com:

```
┌─────────────────────────────────────────────────────┐
│  @mwguerra/anonymize — Colunas Detectadas      │
├──────┬──────────────────┬───────────┬───────────────┤
│ Aba  │ Coluna           │ Regra     │ Ação          │
├──────┼──────────────────┼───────────┼───────────────┤
│ Plan1│ Nome Completo    │ name      │ ✔ Anonimizar  │
│ Plan1│ CPF Cliente      │ cpf       │ ✔ Anonimizar  │
│ Plan1│ Observações      │ —         │ ✘ Ignorar     │
│ Plan2│ E-mail           │ email     │ ✔ Anonimizar  │
└──────┴──────────────────┴───────────┴───────────────┘

Confirma? (Y para aceitar / N para editar / Q para sair)
```

Se o usuário escolher **editar**, permitir via prompt interativo:

- Adicionar colunas não detectadas a uma regra.
- Remover colunas da lista de anonimização.
- Alterar a regra associada a uma coluna.

### RF-04 — Anonimização Consistente

**Princípio central: mapeamento determinístico por execução.**

```
cacheGlobal: Map<string, Map<string, string>>
  → chave nível 1: nome da regra (ex: "cpf")
  → chave nível 2: valor original (ex: "123.456.789-00")
  → valor: valor fake gerado (ex: "987.654.321-00")
```

**Fluxo por célula:**

```
1. Ler valor original da célula
2. Se valor está vazio ou nulo → pular
3. Buscar no cache[regra][valorOriginal]
4. Se encontrou → usar valor cacheado
5. Se não encontrou:
   a. Executar a função geradora da regra (faker)
   b. Verificar se o valor gerado já existe como valor no cache (colisão)
   c. Se colidiu → re-gerar (máximo 10 tentativas)
   d. Salvar no cache[regra][valorOriginal] = valorGerado
6. Escrever valor fake na célula
```

**Ordem de processamento:**
- Aba por aba, da primeira à última.
- Dentro de cada aba: linha por linha (da primeira linha de dados até a última).
- Dentro de cada linha: coluna por coluna (apenas colunas marcadas).
- O cache é **global entre abas**, garantindo que "José da Silva" na Plan1 e na Plan2 receba o mesmo nome fake.

### RF-05 — Geração do Arquivo de Saída

| Item | Detalhe |
|---|---|
| Nome padrão | `<nome_original>.anonymized.<ext>` |
| Flag override | `--output <caminho>` |
| Preservação | Manter formatação de células, tipos de dados, fórmulas (substituídas por valores), e estrutura de abas |
| Sobrescrita | Nunca sobrescrever o arquivo original. Se o arquivo de saída já existe, perguntar ou falhar com `--no-overwrite` |

### RF-06 — Barra de Progresso

Exibir progresso durante o processamento:

```
Processando Plan1... [████████████░░░░░░░░] 60% (1.200/2.000 linhas)
```

### RF-07 — Modo Não-Interativo

Flag `--yes` ou `-y` para pular a confirmação e aceitar todas as detecções automaticamente. Essencial para uso em pipelines CI/CD.

### RF-08 — Dry Run

Flag `--dry-run` para executar toda a detecção e mostrar o plano de anonimização sem modificar nenhum arquivo. Útil para auditoria prévia.

---

## Arquivo de Configuração

### Localização (ordem de precedência)

1. Flag `--config <caminho>`
2. `.anonymizerc.json` no diretório do arquivo de entrada
3. `.anonymizerc.json` no diretório home do usuário
4. Configuração padrão embutida no pacote

### Estrutura

```jsonc
{
  "locale": "pt_BR",
  "rules": [
    {
      "id": "name",
      "columns": ["nome", "name", "nome_completo", "full_name", "nome completo", "nome do cliente", "client_name", "nome_cliente"],
      "generator": "faker.person.fullName()"
    },
    {
      "id": "cpf",
      "columns": ["cpf", "cpf_cnpj", "documento", "cpf do cliente"],
      "generator": "faker.helpers.replaceSymbols('###.###.###-##')"
    },
    {
      "id": "cnpj",
      "columns": ["cnpj", "cnpj_empresa"],
      "generator": "faker.helpers.replaceSymbols('##.###.###/####-##')"
    },
    {
      "id": "email",
      "columns": ["email", "e-mail", "email_address", "correio", "e_mail"],
      "generator": "faker.internet.email()"
    },
    {
      "id": "address",
      "columns": ["endereco", "endereço", "address", "logradouro", "rua", "endereco_completo"],
      "generator": "faker.location.streetAddress({ useFullAddress: true })"
    },
    {
      "id": "zipcode",
      "columns": ["cep", "zip", "zipcode", "codigo_postal", "zip_code"],
      "generator": "faker.location.zipCode('#####-###')"
    },
    {
      "id": "phone",
      "columns": ["telefone", "phone", "celular", "tel", "fone", "mobile", "whatsapp"],
      "generator": "faker.phone.number()"
    }
  ]
}
```

### Extensibilidade

O usuário pode adicionar regras customizadas ao JSON. O campo `generator` é uma expressão avaliada em runtime com acesso ao objeto `faker` (já configurado com o locale). Exemplos de regras adicionais que o usuário poderia criar:

```jsonc
{
  "id": "birthdate",
  "columns": ["data_nascimento", "birthdate", "dt_nasc"],
  "generator": "faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toISOString().split('T')[0]"
}
```

---

## Interface CLI

### Uso Básico

```bash
npx @mwguerra/anonymize ./clientes.xlsx
```

### Flags

| Flag | Alias | Descrição | Default |
|---|---|---|---|
| `--output` | `-o` | Caminho do arquivo de saída | `<input>.anonymized.<ext>` |
| `--config` | `-c` | Caminho do arquivo de configuração | Auto-detect |
| `--yes` | `-y` | Pular confirmação interativa | `false` |
| `--dry-run` | `-d` | Apenas mostrar plano, sem modificar | `false` |
| `--encoding` | `-e` | Forçar encoding do CSV | Auto-detect |
| `--delimiter` | | Forçar delimitador do CSV | Auto-detect |
| `--locale` | `-l` | Override do locale do faker | `pt_BR` |
| `--no-overwrite` | | Falhar se arquivo de saída já existe | `false` |
| `--verbose` | `-v` | Logs detalhados | `false` |
| `--silent` | `-s` | Suprimir toda saída exceto erros | `false` |
| `--version` | | Exibir versão | — |
| `--help` | `-h` | Exibir ajuda | — |

### Exemplos

```bash
# Anonimizar CSV com config customizada
anonymize ./dados.csv --config ./minha-config.json

# Modo não-interativo para CI/CD
anonymize ./export.xlsx --yes --output ./export-safe.xlsx

# Dry run para verificar detecção
anonymize ./clientes.xls --dry-run

# Override de locale
anonymize ./customers.csv --locale en_US
```

---

## Stack Técnica

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js ≥ 18 |
| Linguagem | TypeScript 5.x (strict mode) |
| Build | `tsup` (bundle para CJS + ESM) |
| Leitura/escrita XLS/XLSX | `xlsx` (SheetJS Community Edition) |
| Leitura/escrita CSV | `papaparse` |
| Geração de dados fake | `@faker-js/faker` |
| Interface CLI | `commander` |
| Prompts interativos | `inquirer` |
| Tabelas no terminal | `cli-table3` |
| Barra de progresso | `cli-progress` |
| Cores no terminal | `chalk` |
| Detecção de encoding | `chardet` |

---

## Estrutura do Projeto

```
@mwguerra/anonymize/
├── src/
│   ├── index.ts                 # Entry point CLI
│   ├── cli/
│   │   ├── commands.ts          # Definição de comandos e flags (commander)
│   │   ├── prompts.ts           # Interação com o usuário (inquirer)
│   │   └── display.ts           # Tabelas e barra de progresso
│   ├── core/
│   │   ├── anonymizer.ts        # Orquestrador principal do fluxo
│   │   ├── detector.ts          # Detecção de colunas sensíveis
│   │   ├── cache.ts             # Cache global de mapeamento
│   │   └── generator.ts         # Wrapper do faker + avaliação de expressões
│   ├── io/
│   │   ├── reader.ts            # Leitura unificada (CSV, XLS, XLSX)
│   │   ├── writer.ts            # Escrita unificada
│   │   └── types.ts             # Tipos internos (Sheet, Row, Cell)
│   ├── config/
│   │   ├── loader.ts            # Carregamento e merge de configurações
│   │   ├── defaults.ts          # Configuração padrão embutida
│   │   └── schema.ts            # Validação do JSON de configuração (zod)
│   └── utils/
│       ├── logger.ts            # Logger com níveis (verbose, silent)
│       └── errors.ts            # Classes de erro customizadas
├── tests/
│   ├── unit/
│   │   ├── detector.test.ts
│   │   ├── cache.test.ts
│   │   ├── generator.test.ts
│   │   └── config.test.ts
│   ├── integration/
│   │   ├── anonymizer.test.ts
│   │   └── cli.test.ts
│   └── fixtures/
│       ├── sample.csv
│       ├── sample.xlsx
│       └── sample.xls
├── .anonymizerc.default.json
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

---

## Fluxo de Execução Detalhado

```
┌─────────────────────────────────────┐
│  1. Parse de argumentos CLI         │
│     (commander)                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Carregar configuração           │
│     (flag > local > home > default) │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Ler arquivo de entrada          │
│     Detectar formato pelo extension │
│     Parsear todas as abas           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Detectar colunas sensíveis      │
│     Match nomes vs rules.columns    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. Exibir detecção ao usuário      │
│     (pular se --yes)                │
│     Permitir edição se necessário   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. Se --dry-run → exibir plano     │
│     e encerrar                      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. Inicializar cache global        │
│     Inicializar faker com locale    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8. Loop: aba → linha → coluna      │
│     Para cada célula marcada:       │
│     - Buscar/gerar valor fake       │
│     - Atualizar cache               │
│     - Substituir célula             │
│     Exibir progresso                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  9. Escrever arquivo de saída       │
│     Preservar estrutura original    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  10. Exibir resumo final            │
│      Total de células anonimizadas  │
│      Valores únicos por regra       │
│      Caminho do arquivo gerado      │
└─────────────────────────────────────┘
```

---

## Tratamento de Erros

| Cenário | Comportamento |
|---|---|
| Arquivo não encontrado | Erro claro com caminho tentado |
| Formato não suportado | Listar formatos suportados |
| Arquivo vazio ou sem dados | Warning e encerramento gracioso |
| Arquivo protegido por senha | Erro explicando limitação |
| Colisão no faker após 10 tentativas | Warning no log, usar último valor gerado |
| Config JSON inválido | Erro com detalhes de validação (zod) |
| Expressão do generator inválida | Erro indicando a regra e a expressão problemática |
| Permissão de escrita negada | Erro com sugestão de caminho alternativo |
| Arquivo de saída já existe (com `--no-overwrite`) | Erro sem sobrescrita |

---

## Segurança

- **Nunca** modificar o arquivo original.
- O campo `generator` executa código arbitrário — documentar o risco para configs de terceiros. Usar `new Function()` com escopo limitado (apenas `faker` disponível).
- Não logar valores originais em modo verbose (logar apenas contadores e nomes de colunas).
- Não persistir o cache em disco.

---

## Publicação npm

```jsonc
// package.json
{
  "name": "@mwguerra/anonymize",
  "version": "1.0.0",
  "description": "CLI para anonimização de dados em arquivos XLS, XLSX e CSV",
  "bin": {
    "anonymize": "./dist/index.js"
  },
  "files": ["dist", ".anonymizerc.default.json"],
  "keywords": ["anonymize", "lgpd", "gdpr", "faker", "csv", "xlsx", "cli", "data-privacy"],
  "license": "MIT",
  "repository": "github:mwguerra/anonymize",
  "engines": { "node": ">=18" }
}
```

---

## Métricas de Sucesso

| Métrica | Meta |
|---|---|
| Tempo de processamento | < 5s para 10.000 linhas |
| Consistência | 100% — mesmo input → mesmo output fake dentro da execução |
| Cobertura de testes | ≥ 80% |
| Zero data leaks | Nenhum valor original no arquivo de saída para colunas marcadas |

---

## Fora de Escopo (v1)

- Interface gráfica (GUI/web).
- Conexão direta com bancos de dados.
- Anonimização de arquivos JSON, XML ou Parquet.
- Persistência de cache entre execuções (seed determinístico).
- Detecção por conteúdo (regex no valor da célula, não apenas no nome da coluna).
- Suporte a arquivos protegidos por senha.

---

## Roadmap Futuro

| Versão | Feature |
|---|---|
| v1.1 | Detecção por conteúdo (regex nos valores, além dos nomes de coluna) |
| v1.2 | Seed determinístico para reprodutibilidade entre execuções |
| v1.3 | Suporte a JSON e XML |
| v2.0 | Plugin system para generators customizados (módulos npm) |
