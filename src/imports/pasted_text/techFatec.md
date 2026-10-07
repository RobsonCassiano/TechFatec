Crie um wireframe de baixa fidelidade para uma plataforma acadêmica chamada TechFatec, voltada para três perfis de usuário: Estudante, Professor/Orientador e Gestor/Administrador. O sistema deve permitir login, recuperação de senha e acesso a áreas específicas conforme a persona, mantendo consistência visual e hierarquia clara. A liderança de um grupo é uma responsabilidade exercida dentro do grupo, não uma persona ou área de acesso independente.

Gere wireframes para as seguintes telas e fluxos:

1. Autenticação e Acesso

Login: campos de e-mail e senha, botão "Entrar", link "Esqueci minha senha", link "Criar conta", logo ConectaFatec.

Recuperação de Senha: campo de e-mail, botão "Enviar link de recuperação", link "Voltar ao login".

Cadastro: campos de nome, e-mail, senha, confirmação de senha, seleção de perfil (Estudante ou Professor), botão "Criar conta". O gestor é provisionado pela instituição.

Seleção de Perfil (pós-login): tela que identifica o perfil do usuário e redireciona para a área correspondente: Estudante, Professor/Orientador ou Gestor/Administrador.

2. Jornada do Estudante

Home do Estudante: logo/nome ConectaFatec, header, navegação principal, campo de pesquisa de grupos, mensagem de apresentação, CTA "Explorar grupos", grupos em destaque, atalhos para Agenda, Materiais, Atividades e Projetos, footer.

Lista de Grupos: título "Explorar Grupos", campo de pesquisa, filtros (tema, nível, modalidade), chips de filtros ativos, ordenação, cards de grupos (nome, objetivo resumido, temas, nível, modalidade, participantes, próximo encontro, botão "Ver detalhes"), paginação e estado vazio.

Detalhes do Grupo: nome do grupo, descrição/objetivo, temas, nível, modalidade, líder, participantes, próximos encontros, botão "Participar do grupo", botão "Voltar para grupos", navegação por tabs (Visão geral, Agenda, Materiais, Atividades, Projetos).

Feedback de Participação: mensagem de sucesso "Você entrou no grupo!", informação de que o grupo está disponível na área do usuário, botão "Ir para Área do Grupo".

Área do Grupo (Estudante): nome do grupo, resumo, próximo encontro, navegação por tabs (Visão geral, Agenda, Materiais, Atividades, Projetos), cards de indicadores (próximo encontro, materiais, atividades, projetos), lista de participantes.

Agenda: calendário, lista de encontros (data, horário, modalidade, local/link, grupo relacionado), detalhes do encontro.

Materiais: título, busca, categorias, filtros, lista de materiais (título, tipo, descrição, grupo, data, botão "Abrir material").

Atividades: lista de atividades (nome, status, prazo, descrição, grupo, indicador de conclusão), detalhes da atividade.

Projetos: lista de projetos (nome, descrição, grupo, status, participantes, período), detalhes do projeto.

3. Jornada do Professor/Orientador

Dashboard do Professor: grupos orientados, número de estudantes, resumo de atividades e projetos, indicadores de participação e frequência.

Acompanhar Grupos: lista de grupos orientados, botão "Ver detalhes", informações do responsável do grupo, participantes e próximos encontros.

Acompanhar Atividades: lista de atividades dos grupos orientados, status, prazo, indicador de conclusão, botão "Ver detalhes".

Acompanhar Projetos: lista de projetos dos grupos orientados, status, participantes, período, botão "Ver detalhes".

Relatórios de Participação: filtros por grupo e período, tabela com frequência, atividades concluídas, projetos entregues.

4. Jornada do Gestor/Administrador

Dashboard Institucional: indicadores reais de grupos ativos, alunos, frequência registrada e tarefas concluídas.

Acompanhamento de Grupos: lista somente para consulta com grupo, professor responsável, alunos e frequência.

Acompanhamento de Participação: consulta da frequência e do desempenho de cada aluno por grupo. O gestor não cria, edita ou arquiva grupos e não administra contas nem aprova acessos.

Requisitos Visuais e de Interação

Utilize elementos simples (retângulos, linhas, texto), sem cores ou imagens decorativas.

Mantenha consistência de header, menu, botões, cards, tipografia, espaçamentos, ícones, filtros, tabs e mensagens em todas as telas.

Considere estados de erro, vazio, carregamento e sucesso.

A sequência deve permitir navegação entre as telas, começando no Login e seguindo para o Dashboard correspondente ao perfil.
Separe claramente as áreas de cada persona, mantendo a jornada do estudante como prioridade, mas garantindo que as funcionalidades administrativas estejam acessíveis aos perfis correspondentes.

Atualização de responsabilidades: o Gestor/Administrador possui somente acesso de consulta ao dashboard institucional, aos grupos criados pelos professores, à frequência dos alunos e ao desempenho nas atividades. O gestor não cria grupos, não administra alunos e não aprova cadastros ou solicitações. Cada professor cadastrado cria, consulta, edita e arquiva seus próprios grupos, administra os integrantes e pode remover um aluno quando necessário, publica materiais de diferentes extensões, abre tarefas com prazo, registra frequência, avalia entregas e envia e recebe mensagens na plataforma. Mensagens enviadas por estudantes também notificam o professor por e-mail institucional. Professores criam e atualizam projetos dos próprios grupos, e estudantes podem consultá-los e participar dos projetos disponíveis nos grupos dos quais fazem parte. Ao criar um grupo, o nome da matéria é livre e Inglês deve estar disponível como sugestão. Cadastros de estudantes e professores ficam ativos após o registro; estudantes entram diretamente nos grupos disponíveis que escolherem, sem aprovação prévia do professor, e o professor pode removê-los do grupo se necessário.