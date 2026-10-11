# Vehicle Price Estimator

A local web application that estimates prices for supported Sri Lankan vehicles using a trained XGBoost pipeline. It is intended as a university machine-learning project and does not use a database.

> Predictions are estimates based on historical training data, not guaranteed market values.

## Architecture

```text
React/Vite :5173 → Express :5000 → FastAPI :8000 → XGBoost pipeline
```

- `frontend/` contains the React user interface.
- `backend/` contains the Express proxy API.
- `ml-service/` contains FastAPI, support data, and the saved model pipeline.

## Prerequisites

Install these tools before continuing:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (current LTS version, including npm)
- Python 3.13

On macOS, XGBoost also needs the OpenMP runtime. If you use Homebrew:

```bash
brew install python@3.13 libomp node git
```

## First-time setup

Clone the repository and enter its directory:

```bash
git clone https://github.com/YOUR-USERNAME/vehicle-price-predictor.git
cd vehicle-price-predictor
```

Replace `YOUR-USERNAME` with the GitHub account or organization that owns the repository.

### 1. Set up the Python service

```bash
cd ml-service
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python verify_model.py
deactivate
cd ..
```

`verify_model.py` should load the included model successfully. Do not continue if model verification fails.

### 2. Install backend dependencies

```bash
cd backend
npm ci
cp .env.example .env
cd ..
```

### 3. Install frontend dependencies

```bash
cd frontend
npm ci
cp .env.example .env
cd ..
```

The example environment files already point to the local default ports. Change the copied `.env` files only when using different addresses or ports.

## Run locally

Open three Terminal windows or tabs in the repository. Start the services in this order and keep each command running.

### Terminal 1 — FastAPI and the model

```bash
cd ml-service
source .venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Check:

- Health: <http://127.0.0.1:8000/health>
- API documentation: <http://127.0.0.1:8000/docs>

The health response should include `"status":"ok"` and `"model_loaded":true`.

### Terminal 2 — Express

```bash
cd backend
npm start
```

Check the combined Express and FastAPI health endpoint:

- <http://127.0.0.1:5000/api/health>

### Terminal 3 — React

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the application:

- <http://127.0.0.1:5173>

## Stop the application

Press **Control+C** once in each of the three Terminal windows. In the FastAPI terminal, run `deactivate` afterward if the Python virtual environment remains active.

## Quality checks

Run the frontend checks before committing changes:

```bash
cd frontend
npm run lint
npm run build
```

Check that the Python service can load the model:

```bash
cd ml-service
source .venv/bin/activate
python verify_model.py
```

## Environment variables

| File | Variable | Default purpose |
| --- | --- | --- |
| `backend/.env` | `PORT` | Express port, normally `5000` |
| `backend/.env` | `FASTAPI_BASE_URL` | FastAPI URL, normally `http://127.0.0.1:8000` |
| `backend/.env` | `ML_REQUEST_TIMEOUT_MS` | ML request timeout in milliseconds |
| `frontend/.env` | `VITE_API_BASE_URL` | Express URL, normally `http://127.0.0.1:5000` |

Real `.env` files, dependencies, virtual environments, build output, caches, and general model artifacts are ignored by Git. The specific trained pipeline required by this application is intentionally included.

## GitHub publishing

If this folder is not already a Git repository, create one and make the first commit:

```bash
git init
git add .
git status
git commit -m "Initial vehicle price estimator"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/vehicle-price-predictor.git
git push -u origin main
```

Review `git status` before committing. Do not commit personal `.env` files or virtual environments.

