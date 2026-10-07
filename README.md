# TechFatec

Plataforma acadêmica para apoiar grupos de estudos e cursos de extensão. O projeto reúne uma interface web, uma API e um banco de dados MySQL, com áreas destinadas a estudantes, professores/orientadores e gestores.

## Tecnologias

- **Frontend:** HTML, CSS e JavaScript, servido e compilado pelo Vite.
- **Backend:** API em Node.js.
- **Banco de dados:** MySQL, acessado pela biblioteca `mysql2`.
- **Outras dependências:** `bcryptjs` para hash de senhas, `busboy` para receber arquivos, `dotenv` para variáveis de ambiente e `nodemailer` para envio de e-mails.

## Requisitos

- Node.js **22**.
- pnpm **10.34.3** (ou uma versão compatível com o lockfile).
- MySQL **8.0.16 ou superior**.
- Um navegador atualizado.
- Para executar no Windows com XAMPP, basta iniciar o serviço **MySQL** pelo Painel de Controle do XAMPP. O Apache não é necessário para rodar o Vite e a API.
- Acesso à internet para recursos externos carregados pela página, como o widget VLibras.

## Configuração inicial no Windows

Abra o PowerShell na pasta do projeto:

```powershell
Set-Location C:\xampp\TechFatec
```

### 1. Ative o pnpm e instale as dependências

Se o pnpm ainda não estiver disponível, habilite o Corepack, que acompanha versões recentes do Node.js, e ative a versão usada pelo projeto:

```powershell
corepack enable
corepack prepare pnpm@10.34.3 --activate
pnpm install
```

Confirme que as ferramentas estão instaladas:

```powershell
node --version
pnpm --version
```

### 2. Configure as variáveis de ambiente

Crie o arquivo local `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Edite `.env` com os dados do seu MySQL. Os nomes e valores de exemplo estão em [.env.example](./.env.example). Não compartilhe nem envie o arquivo `.env` ao Git; ele pode conter credenciais.

Variáveis principais:

| Variável | Uso | Valor local padrão |
| --- | --- | --- |
| `API_PORT` | Porta da API | `3001` |
| `MYSQL_HOST` | Endereço do MySQL | `127.0.0.1` |
| `MYSQL_PORT` | Porta do MySQL | `3306` |
| `MYSQL_USER` | Usuário do MySQL | `root` |
| `MYSQL_PASSWORD` | Senha do usuário do MySQL | Vazia no exemplo |
| `MYSQL_DATABASE` | Banco utilizado pela aplicação | `conecta_fatec` |
| `APP_BASE_URL` | Endereço local do frontend, usado em links da aplicação | `http://localhost:8443` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Configuração do servidor de e-mail | Preencher com dados válidos para habilitar envio |

O envio de e-mails, por exemplo para recuperação de senha, depende de credenciais SMTP válidas. Não coloque credenciais reais no código ou no repositório.

### 3. Inicie o MySQL e crie o banco

No XAMPP, inicie **MySQL**. Depois, no PowerShell, crie o banco:

```powershell
mysql -u root -p -e "CREATE DATABASE conecta_fatec CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Informe a senha do MySQL quando solicitado. Se o usuário não tiver senha, remova `-p`. Caso `mysql` não seja reconhecido, use o executável do XAMPP:

```powershell
& C:\xampp\mysql\bin\mysql.exe -u root -p -e "CREATE DATABASE conecta_fatec CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Conecte-se ao banco:

```powershell
mysql -u root -p conecta_fatec
```

No prompt `mysql>`, carregue o arquivo de esquema e encerre a sessão:

```sql
source C:/xampp/TechFatec/database/schema.sql
exit
```

Se o projeto estiver em outra pasta, ajuste o caminho do arquivo. Se `mysql` não for reconhecido, inicie o cliente com `& C:\xampp\mysql\bin\mysql.exe -u root -p conecta_fatec`.

O arquivo [database/schema.sql](./database/schema.sql) é o esquema inicial para um banco novo. Os arquivos em [database/migrations/](./database/migrations/) são alterações incrementais para bancos existentes; não execute todos indiscriminadamente sobre um banco recém-criado, pois algumas alterações podem já estar incluídas no esquema inicial.

### 4. Execute a aplicação

Abra **dois terminais** na pasta do projeto. No primeiro, inicie a API:

```powershell
pnpm dev:api
```

No segundo, inicie o frontend:

```powershell
pnpm dev
```

Abra [http://localhost:8443](http://localhost:8443) no navegador. O Vite encaminha as requisições `/api` para a API local na porta `3001`.

Para executar a API sem modo de observação, use `pnpm start:api` no lugar de `pnpm dev:api`.

## Criar o gestor inicial

Depois de configurar o `.env`, criar o banco e carregar o esquema, execute uma única vez:

```powershell
pnpm run create:admin -- "gestor@fatec.edu.br" "Nome do Gestor"
```

O comando gera uma senha temporária e a mostra no terminal. Guarde-a em local seguro; ela não será exibida novamente. O script impede a criação de outro gestor ativo quando já existe um.

## Comandos úteis

| Comando | Descrição |
| --- | --- |
| `pnpm install` | Instala as dependências do projeto. |
| `pnpm dev` | Inicia o frontend Vite na porta `8443`. |
| `pnpm dev:api` | Inicia a API Node.js em modo de observação na porta `3001`. |
| `pnpm start:api` | Inicia a API sem modo de observação. |
| `pnpm run create:admin -- "email" "Nome"` | Cria o gestor inicial e gera uma senha temporária. |
| `pnpm build` | Gera a versão de produção em `dist/`. |
| `pnpm preview` | Serve localmente a versão de produção gerada. |
| `pnpm format` | Formata os arquivos com o Oxfmt. |

Para verificar a compilação de produção:

```powershell
pnpm build
```

## Estrutura principal

- [index.html](./index.html): ponto de entrada da página.
- [app.js](./app.js): renderização das telas e interações do frontend.
- [styles.css](./styles.css): estilos e comportamento responsivo.
- [server/index.js](./server/index.js): API e integração com o MySQL.
- [server/create-admin.js](./server/create-admin.js): criação do gestor inicial.
- [database/schema.sql](./database/schema.sql): esquema inicial do banco.
- [database/migrations/](./database/migrations/): alterações incrementais do banco.
- [src/imports/pasted_text/techFatec.md](./src/imports/pasted_text/techFatec.md): briefing de produto e requisitos das jornadas.
- [vite.config.js](./vite.config.js): configuração do servidor Vite e do proxy da API.

## Observações de segurança

- O `.env` contém configuração local e pode conter credenciais. Não o publique nem o adicione ao Git.
- Use senhas fortes e credenciais próprias para ambientes compartilhados ou de produção; não reutilize a conta administrativa do MySQL sem avaliar as permissões necessárias.
- A senha temporária do gestor é exibida somente durante sua criação. Armazene-a com segurança e altere-a de acordo com os procedimentos da instituição.
