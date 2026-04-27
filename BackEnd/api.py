from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from pydantic import BaseModel

from main import (
    load_database,
    find_v90_by_motor,
    find_v90_set,
    find_best_match,
    build_result
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# carrega banco
df_v90, df_s200 = load_database("banco.db")


class InputData(BaseModel):
    motor: str
    drive: str | None = None
    comunicacao: str | None = None


@app.post("/migrar")
def migrar(data: InputData):

    ref = None

    # CASO 1 → motor + drive
    if data.motor and data.drive:
        ref = find_v90_set(df_v90, data.motor, data.drive)

    # CASO 2 → somente motor
    elif data.motor:
        ref = find_v90_by_motor(df_v90, data.motor)

        if ref is not None and data.comunicacao:
            ref = ref.copy()
            ref["comunicacao"] = data.comunicacao.upper()

    # validação
    if ref is None:
        return {"erro": "Conjunto não encontrado"}

    # 🔥 AGORA SEM QUALQUER LÓGICA DE IP
    best = find_best_match(ref, df_s200)

    if best is None:
        return {"erro": "Nenhum sucessor encontrado"}

    result = build_result(ref, best)

    # 🔍 DEBUG (OBRIGATÓRIO AGORA)
    print("\n🚀 RESULTADO GERADO PELO BACKEND:")
    print(result)

    # 🔥 GARANTIA DO CAMPO (TESTE CONTROLADO)
    altura = result["sucessor"]["altura_eixo_mm"]

    if altura in [20, 30]:
        result["sucessor"]["permite_ip54"] = True
    else:
        result["sucessor"]["permite_ip54"] = False

    print("\n✅ RESULTADO FINAL ENVIADO:")
    print(result)

    return result

@app.get("/health")
def health():
    return {"status": "ok"}

@app.options("/migrar")
async def options_migrar():
    return {}
