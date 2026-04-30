# Weather Risk Dashboard

Plataforma web interna para monitoramento de riscos climáticos operacionais em cidades brasileiras, com dashboard interativo, controle de acesso por perfil e agente climático com IA.

## Como rodar

```bash
# 1. Clone o repositório
git clone https://github.com/educarvallho/Weather_Risk_Dashboard.git
cd Weather_Risk_Dashboard

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env e preencha:
# - OPENAI_API_KEY (chave fornecida pelos avaliadores)
# - SECRET_KEY — gere com o comando abaixo e cole o resultado no .env:
#     python -c "import secrets; print(secrets.token_hex(32))"
#   Exemplo de valor válido: a3f8c1d2e5b7094f6a2e1d8c3b5f7a9e2d4c6b8a0f1e3d5c7b9a2e4d6c8b0f2
#   Essa chave assina todos os tokens JWT do sistema. Com um valor fraco
#   qualquer pessoa poderia forjar credenciais de admin.

# 3. Suba todos os serviços
docker compose up --build
```

A aplicação estará disponível em:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentação da API**: http://localhost:8000/docs

## Usuários de teste

| E-mail | Senha | Perfil |
|--------|-------|--------|
| admin@weather.com | admin123 | Administrador |
| operator@weather.com | operator123 | Operador |
| viewer@weather.com | viewer123 | Visualizador |

## Arquitetura

### Visão geral

```
weather-dashboard/
├── backend/     # FastAPI + Python 3.12
├── frontend/    # Next.js 14 + Tailwind CSS
└── docker-compose.yml
```

### Backend — Clean Architecture

O backend segue rigorosamente Clean Architecture com 4 camadas:

```
app/
├── domain/           # Camada 1: Entidades e regras de negócio puras
│   ├── entities/     # User, City, Weather — sem dependência de frameworks
│   ├── enums.py      # UserRole, RiskLevel
│   └── exceptions.py # Exceções de domínio
├── use_cases/        # Camada 2: Casos de uso da aplicação
│   ├── auth/         # LoginUseCase, GetCurrentUserUseCase
│   ├── cities/       # CRUD de cidades com regras de autorização
│   ├── weather/      # Dashboard, previsão, localização, cálculo de risco
│   ├── users/        # CRUD de usuários (admin only)
│   └── agent/        # ChatUseCase — agente com contexto climático
├── infrastructure/   # Camada 3: Implementações concretas
│   ├── database/     # SQLAlchemy models + repositórios
│   ├── external/     # Clientes Open-Meteo e OpenAI
│   └── security/     # JWT e bcrypt
└── presentation/     # Camada 4: FastAPI routers + schemas Pydantic
```

**Regra de dependência**: Domínio → Use Cases → Infraestrutura → Apresentação. Nunca o inverso.

### Frontend — Next.js App Router

```
src/
├── app/                    # Páginas (App Router)
│   ├── (auth)/login        # Página de login
│   └── (protected)/        # Layout autenticado
│       ├── dashboard/      # Dashboard principal com KPIs e ranking
│       ├── compare/        # Comparação multi-cidade (gráficos)
│       ├── cities/         # Listagem e gestão de cidades
│       ├── cities/[id]/    # Detalhe + previsão de 7 dias
│       ├── cities/location/# Previsão de 7 dias da localização do usuário
│       ├── admin/users/    # Gestão de usuários (admin)
│       └── admin/rules/    # Calibração de limiares de risco (admin)
├── components/             # Componentes reutilizáveis
├── context/                # AuthContext (token + user no localStorage)
├── hooks/                  # useAuth, useGeolocation
├── lib/
│   ├── api.ts              # Cliente HTTP com interceptador JWT e retry
│   ├── dashboardCache.ts   # Cache de módulo 5 min para dados do dashboard
│   └── locationWeatherCache.ts  # Cache de módulo 5 min para clima da localização
└── types/                  # TypeScript interfaces
```

## Princípios SOLID aplicados

| Princípio | Exemplo no código |
|-----------|-----------------|
| **S** (Single Responsibility) | `CalculateRiskUseCase` faz apenas cálculo de risco. `LoginUseCase` apenas autentica. |
| **O** (Open/Closed) | Novos provedores climáticos podem ser adicionados implementando um novo cliente sem alterar os use cases. |
| **L** (Liskov) | `UserRepository` e `CityRepository` implementam `IUserRepository` e `ICityRepository` de forma intercambiável. |
| **I** (Interface Segregation) | `IUserRepository` e `ICityRepository` são interfaces separadas, sem acoplamento cruzado. |
| **D** (Dependency Inversion) | Use cases recebem os repositórios via injeção de dependência; não instanciam implementações concretas. |

## Regra de Risco Operacional

O cálculo está em `backend/app/use_cases/weather/calculate_risk_use_case.py` — função pura sem I/O:

| Condição | Pontuação |
|----------|-----------|
| Probabilidade de chuva > 70% | +2 |
| Probabilidade de chuva > 40% | +1 |
| Velocidade do vento > 50 km/h | +2 |
| Velocidade do vento > 30 km/h | +1 |
| Temperatura > 33°C ou < 5°C | +2 |
| Temperatura > 28°C ou < 10°C | +1 |
| Volume de chuva > 20 mm | +1 |

**Classificação**: Score 0–2 = **Baixo** · Score 3–4 = **Médio** · Score 5+ = **Alto**

Os limiares acima são os valores padrão do sistema. Administradores podem calibrá-los em tempo real pelo menu **Regras** no dashboard.

A mesma lógica é usada em: dashboard, ranking, previsão detalhada, alertas e respostas do agente.

## Agente Climático

O agente usa o modelo `gpt-4o-mini` da OpenAI com temperatura baixa (0.3) para respostas factuais.

**Estratégia de contexto**: a cada requisição, o sistema injeta no prompt os dados climáticos reais de todas as cidades ativas em formato JSON estruturado. O LLM responde somente com base nesses dados — nunca inventa valores.

```
[System Prompt]
Você é um assistente de riscos climáticos.
Responda APENAS com base nos dados fornecidos.

DADOS ATUAIS: { cidades: [...], resumo: {...} }

[User]
Qual cidade está em risco alto?
```

**Segurança**: a chave OpenAI fica exclusivamente no arquivo `.env` do servidor. Nunca é exposta ao frontend ou ao repositório.

**Token expirado**: se o token expirar, o agente retorna mensagem clara de erro com instruções. Para renovar: atualizar `OPENAI_API_KEY` no `.env` e reiniciar o backend (`docker-compose restart backend`).

## Localização atual do usuário

Após o login, o dashboard solicita a localização do dispositivo. O hook `useGeolocation` implementa três camadas de fallback:

1. **`navigator.geolocation.getCurrentPosition`** — GPS/rede do dispositivo (10 s de timeout); após sucesso, Nominatim (OpenStreetMap) faz reverse geocoding para obter nome da cidade e sigla do estado
2. **ipapi.co** — chamada direta do browser, detecta cidade e coordenadas pelo IP real do cliente
3. **freeipapi.com** — alternativa se ipapi.co falhar, também chamada diretamente do browser

As APIs de IP são chamadas **diretamente do browser** (não via proxy do servidor) para que detectem o IP real do cliente — ambas suportam CORS nativamente.

Um watchdog de **25 segundos** garante que, mesmo que o diálogo de permissão seja ignorado ou o GPS demore em cold start mobile, o fallback de IP seja acionado.

Quando o fallback de IP é usado, o card exibe o nome da cidade detectada e a mensagem **"Localização aproximada via IP"**. Em qualquer caso de falha, o sistema continua funcionando normalmente com as cidades cadastradas.

| Estado | Comportamento |
|--------|--------------|
| GPS concedido | Coordenadas exatas + nome da cidade via reverse geocoding |
| IP fallback | Coordenadas + cidade + aviso de localização aproximada |
| Todas as fontes falham | Mensagem de erro; dashboard opera sem card de localização |

## Cache de dados climáticos

O sistema usa dois níveis de cache para minimizar chamadas externas:

**Backend — banco de dados (15 minutos)**
Cada consulta à Open-Meteo é gravada na tabela `weather_cache` com o timestamp real (`fetched_at`). Chamadas para a mesma cidade dentro de 15 minutos retornam o cache, evitando requisições redundantes quando múltiplos usuários acessam o dashboard simultaneamente.

**Frontend — módulo em memória (5 minutos)**
`dashboardCache.ts` e `locationWeatherCache.ts` mantêm os últimos dados em variáveis de módulo com TTL de 5 minutos. Ao navegar entre páginas e voltar ao dashboard, os dados em cache são usados sem nova chamada ao backend — o campo "Atualizado às" não muda. Um auto-refresh a cada 5 minutos força a renovação.

## Decisões técnicas

**Por que FastAPI?** Rápido de implementar, documentação automática (Swagger em `/docs`), validação nativa com Pydantic, ecossistema Python moderno.

**Por que SQLAlchemy síncrono?** Para um sistema com ~10 cidades e poucos usuários simultâneos, a complexidade do async não se justifica. O SQLAlchemy 2.0 síncrono com psycopg2 é robusto, bem documentado e mais simples de testar.

**Por que Next.js?** Roteamento embutido, suporte a TypeScript e Tailwind out-of-the-box, build otimizado e `output: standalone` facilita o deploy via Docker.

**Por que Open-Meteo?** API climática gratuita, sem necessidade de chave, com dados de alta qualidade para o Brasil. Fornece todas as variáveis necessárias (temperatura, chuva, vento) em uma única chamada.

## Testes

### Testes unitários (Ubuntu/Linux)

```bash
cd backend

# Crie e ative o ambiente virtual
python3 -m venv .venv
source .venv/bin/activate

# Instale as dependências
pip install -r requirements.txt

# Execute os testes (29 casos)
pytest tests/unit/ -v
```

Os testes cobrem:
- **Cálculo de risco** — 16 casos de borda (limites exatos das thresholds de chuva, vento e temperatura)
- **Autenticação** — credenciais válidas/inválidas, usuário inativo, JWT expirado
- **Casos de uso de cidades** — filtros, toggle de status, controle de acesso por perfil

### Teste funcional da API (sistema rodando)

```bash
# Login e extração do token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@weather.com","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Dashboard com o token obtido
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/weather/dashboard \
  | python3 -m json.tool | head -40
```

> `python3 -m json.tool` formata o JSON sem dependência adicional. Se preferir, substitua por `jq .` (requer instalação: `sudo apt install jq`).

## Sistema de Logs

O backend usa o módulo `logging` padrão do Python, configurado em `app/main.py`:

```
FORMAT: YYYY-MM-DDTHH:MM:SS  LEVEL  logger_name  mensagem
EXEMPLO: 2026-04-29T14:32:01 WARNING app.presentation.routers.auth login_rate_limited ip=192.168.1.10 email=teste@email.com
```

Cada router tem seu próprio `logger = logging.getLogger(__name__)`, gerando logs com o caminho do módulo como nome — facilita rastrear a origem de cada evento.

**Eventos registrados:**
| Nível | Evento |
|-------|--------|
| `INFO` | Startup do FastAPI, inicializações |
| `WARNING` | Rate limit atingido no login, erros de geolocalização por IP |
| `ERROR` | Falhas na OpenAI, erros de acesso ao banco |

**Visualizar logs em tempo real (Docker):**

```bash
# Backend
docker compose logs backend -f --tail=100

# Todos os serviços
docker compose logs -f --tail=50

# Filtrar apenas erros
docker compose logs backend 2>&1 | grep -E "ERROR|WARNING"
```

> Os logs do Docker são voláteis: são perdidos ao rodar `docker compose down`. Para persistência, adicione um volume montando `/var/log` ou use um agregador como Loki/Grafana.

## Stack completa

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.12 + FastAPI 0.111 |
| ORM | SQLAlchemy 2.0 |
| Banco de dados | PostgreSQL 15 |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Agente | OpenAI gpt-4o-mini |
| Weather API | Open-Meteo (gratuita) |
| Deploy | Docker Compose |
