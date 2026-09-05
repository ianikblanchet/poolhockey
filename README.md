# Pool de hockey en temps réel

Application de pool de hockey avec frontend React/Vite et backend FastAPI.

## Développement local

### Backend

```bash
cd backend/pool_app
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Le backend écoute par défaut sur `http://127.0.0.1:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend utilise l’API locale du backend. Les secrets et la configuration locale doivent rester dans un fichier `.env` non versionné.

## Validation

```bash
cd backend/pool_app
python3 -m py_compile main.py models.py

cd ../../frontend
npm run build
```
