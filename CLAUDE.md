# CLAUDE.md — Weather Risk Dashboard

## Visão Geral do Projeto

Sistema fullstack de monitoramento de riscos climáticos para 10 cidades brasileiras.
Desafio técnico construído do zero em 4 dias (prazo: 29/04/2026 às 23h59).

**Stack:**
- Backend: Python 3.12 + FastAPI + SQLAlchemy 2.0 (sync) + PostgreSQL 15
- Frontend: Next.js 14 (App Router) + Tailwind CSS + Recharts
- Agente: OpenAI gpt-4o-mini com contexto climático injetado
- API Externa: Open-Meteo (gratuita, sem chave)
- Deploy: Docker Compose (3 serviços: db, backend, frontend)

---

## Comandos Essenciais

### Subir o sistema completo
```bash
# Primeira vez ou após problemas (remove volumes):
docker-compose down -v
docker-compose up --build

# Reiniciar sem rebuild:
docker-compose up
```

### Rodar testes unitários (backend)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
pytest tests/unit/ -v
```

### Backend local sem Docker (requer Python 3.12 + Postgres rodando)
```bash
cd backend
# Sobe só o banco via Docker:
docker run -d --name pg -e POSTGRES_USER=weather_user -e POSTGRES_PASSWORD=weather_pass -e POSTGRES_DB=weather_db -p 5432:5432 postgres:15-alpine
# Crie backend/.env com DATABASE_URL=postgresql://weather_user:weather_pass@localhost:5432/weather_db
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

### Frontend local sem Docker (requer Node.js 20)
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000 — aponta para localhost:8000 por padrão
```

---

## Configuração de Ambiente

### Fluxo correto do .env
```bash
cp .env.example .env
# Edite .env: preencha OPENAI_API_KEY e troque SECRET_KEY por valor seguro
```

- `.env.example` — template com placeholders, commitado no git (sem segredos reais)
- `.env` — valores reais, excluído pelo `.gitignore`, nunca vai para o repositório
- As credenciais do banco (`weather_user`/`weather_pass`/`weather_db`) são criadas pelo Docker Compose na primeira execução — não são credenciais de nenhum banco externo

### Variáveis obrigatórias no .env para produção
```
OPENAI_API_KEY=sk-...        # Chave real da OpenAI
SECRET_KEY=...               # String aleatória segura (32+ chars)
CORS_ORIGINS=http://SEU_IP:3000
NEXT_PUBLIC_API_URL=http://SEU_IP:8000
```

---

## Arquitetura (Clean Architecture — 4 camadas)

```
backend/app/
├── domain/          # Entidades puras, enums, exceções (zero deps de framework)
├── use_cases/       # Regras de negócio (injetam repositórios via ABC)
├── infrastructure/  # DB (SQLAlchemy), APIs externas (Open-Meteo, OpenAI), segurança
└── presentation/    # FastAPI routers, schemas Pydantic, wiring de dependências
```

**Regra de dependência:** domain ← use_cases ← infrastructure ← presentation

### Arquivo crítico: calculate_risk_use_case.py
Função pura (sem I/O). Todo display de risco no sistema deriva daqui.

**Fórmula de score:**
| Condição | Pontos |
|---|---|
| Prob. chuva > 70% | +2 |
| Prob. chuva > 40% | +1 |
| Vento > 50 km/h | +2 |
| Vento > 30 km/h | +1 |
| Temp > 38°C ou < 5°C | +2 |
| Temp > 35°C ou < 10°C | +1 |
| Volume chuva > 20 mm | +1 |

**Score 0–2 = LOW (verde) · 3–4 = MEDIUM (amarelo) · 5+ = HIGH (vermelho)**

---

## Credenciais de Teste

| Email | Senha | Perfil |
|---|---|---|
| admin@weather.com | admin123 | Admin (CRUD completo) |
| operator@weather.com | operator123 | Operador (cidades, sem users) |
| viewer@weather.com | viewer123 | Visualizador (somente leitura) |

---

## Endpoints da API

| Método | Rota | Auth |
|---|---|---|
| POST | /auth/login | público |
| GET | /auth/me | qualquer |
| GET | /weather/dashboard | qualquer |
| GET | /weather/cities/{id}/forecast | qualquer |
| GET | /weather/location?lat=&lon= | qualquer |
| GET/POST/PUT/DELETE | /cities | admin/operator (DELETE só admin) |
| GET/POST/PUT/DELETE | /users | admin |
| POST | /agent/chat | qualquer |
| GET | /health | público |

---

## Páginas do Frontend

| Página | Rota | Acesso |
|---|---|---|
| Login | /login | público |
| Dashboard | /dashboard | qualquer autenticado |
| Cidades | /cities | qualquer (gestão: admin/operator) |
| Detalhe da cidade | /cities/[id] | qualquer |
| Usuários (admin) | /admin/users | admin |
| Chat (widget flutuante) | todas as páginas protegidas | qualquer |

---

## Problemas Resolvidos e Decisões

### Build Docker
- `npm ci` → `npm install`: `package-lock.json` não existe (projeto criado manualmente)
- `frontend/public/` deve existir: Next.js standalone copia essa pasta; criada com `.gitkeep`
- Healthcheck do Postgres deve especificar `-d weather_db`, senão `pg_isready -U weather_user` tenta conectar ao banco `weather_user` que não existe

### Volume corrompido
Se o loop `FATAL: database "weather_user" does not exist` aparecer:
```bash
docker-compose down -v   # OBRIGATÓRIO: remove o volume com dados antigos
docker-compose up --build
```

### Geolocalização
`useGeolocation` hook usa `navigator.geolocation.getCurrentPosition`. Se o usuário negar → `LocationWeatherCard` exibe "Localização não disponível" e o dashboard continua normalmente.

### Agente e OpenAI
- Chave expirada → erro 503 com mensagem clara no chat
- Contexto injetado no system prompt: dados de todas as cidades ativas em JSON
- Modelo: `gpt-4o-mini`, temperature=0.3, max_tokens=500

### Cache de clima
15 minutos no banco (`weather_cache`). Reduz chamadas ao Open-Meteo em acessos simultâneos das 10 cidades.

---

## Estrutura de Arquivos Importantes

```
backend/
├── app/
│   ├── domain/entities/weather.py          # RiskResult, CurrentWeather, DailyForecast
│   ├── use_cases/weather/calculate_risk_use_case.py   # CRÍTICO — função pura
│   ├── use_cases/weather/get_dashboard_data_use_case.py
│   ├── use_cases/agent/chat_use_case.py    # Contexto + OpenAI
│   ├── infrastructure/external/open_meteo/client.py   # Cache 15min
│   ├── presentation/dependencies.py        # Wiring de DI
│   └── main.py                             # FastAPI app factory
├── alembic/versions/001_initial_schema.py  # Schema único
├── scripts/seed.py                         # Idempotente: 3 users + 10 cidades
└── tests/unit/
    ├── test_risk_scoring.py    # 16 casos de boundary
    ├── test_auth_use_case.py
    └── test_city_use_cases.py

frontend/src/
├── lib/api.ts                  # Fetch wrapper com JWT e redirect em 401
├── context/AuthContext.tsx     # Token + user no localStorage
├── hooks/useGeolocation.ts     # State machine: idle→loading→success/error
├── components/agent/ChatWidget.tsx          # Widget flutuante
└── app/(protected)/dashboard/page.tsx       # Página principal
```
