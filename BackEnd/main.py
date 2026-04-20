import sqlite3
import pandas as pd
import logging
from typing import Optional, Dict, Any, Tuple, List

# ============================================================
# CONFIGURAÇÃO DE LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)-8s: %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# NORMALIZAÇÕES
# ============================================================


def normalize_text(text):
    """Normaliza texto removendo espaços extras e convertendo para minúsculas."""
    if pd.isna(text):
        return ""
    return str(text).strip().lower().replace("  ", " ")


def normalize_mlfb(code):
    """Normaliza código MLFB removendo hífens e convertendo para maiúsculas."""
    return str(code).replace("-", "").strip().upper()


def format_mlfb(code):
    """Formata código MLFB no padrão XXXXX-XXXXX-XXXXX."""
    code = normalize_mlfb(code)

    if len(code) < 16:
        return code

    return f"{code[0:7]}-{code[7:12]}-{code[12:]}"


def normalize_phases(p):
    """Normaliza fases extraindo valores numéricos (1 ou 3)."""
    p = str(p).upper()
    phases = []

    if "1AC" in p:
        phases.append(1)
    if "3AC" in p:
        phases.append(3)

    return phases


def classify_encoder(enc):
    """Classifica tipo de encoder em categorias padrão."""
    enc = normalize_text(enc)

    if "multi" in enc:
        return "MT"

    if "single" in enc:
        if "21" in enc:
            return "ST21"
        if "17" in enc:
            return "ST17"
        return "ST"

    if "incremental" in enc:
        return "INC"

    return "UNKNOWN"


def to_python(val):
    """Converte numpy/pandas para tipo nativo Python."""
    if hasattr(val, "item"):
        return val.item()
    return val


def build_result(ref: Optional[pd.Series], best: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    import numpy as np

    def convert(obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, dict):
            return {k: convert(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [convert(i) for i in obj]
        return obj

    if ref is None or best is None:
        return {"erro": "Dados insuficientes"}

    ref = ref.to_dict()
    cand = best["data"]

    return convert({
        "atual": {
            "motor": ref["motor_mlfb"],
            "drive": ref.get("drive_mlfb"),
            "potencia_kw": ref["motor_power_kw"],
            "potencia_kw_drive": ref["drive_power_kw"],
            "torque_nm": ref["motor_torque_nm"],
            "velocidade_rpm": ref["speed_rpm"],
            "tensao": ref["tensao"],
            "fases": ref["fases"],
            "comunicacao": ref["comunicacao"],
            "encoder": ref["encoder"],
            "eixo": ref["tipo_de_eixo"],
            "freio": ref["freio"],
            "altura_eixo_mm": ref["altura_eixo_mm"]
        },
        "sucessor": {
            "motor": cand["motor_mlfb"],
            "drive": cand.get("drive_mlfb"),
            "potencia_kw": cand["motor_power_kw"],
            "potencia_kw_drive": cand["drive_power_kw"],
            "torque_nm": cand["motor_torque_nm"],
            "velocidade_rpm": cand["speed_rpm"],
            "tensao": cand["tensao"],
            "fases": cand["fases"],
            "comunicacao": cand["comunicacao"],
            "encoder": cand["encoder"],
            "eixo": cand["tipo_de_eixo"],
            "freio": cand["freio"],
            "altura_eixo_mm": cand["altura_eixo_mm"],
        },
        "desvios": best["warnings"]
    })
# ============================================================
# LOAD DATABASE
# ============================================================


def load_database(db_path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Carrega banco de dados SQLite e retorna DataFrames normalizados.

    Args:
        db_path: Caminho para arquivo database.db

    Returns:
        Tuple com (df_v90, df_s200)

    Raises:
        FileNotFoundError: Se arquivo não existir
        sqlite3.Error: Se houver erro ao conectar
    """
    try:
        logger.info(f"Conectando ao banco de dados: {db_path}")

        conn = sqlite3.connect(db_path)

        df_v90 = pd.read_sql_query("SELECT * FROM V90", conn)
        df_s200 = pd.read_sql_query("SELECT * FROM S200", conn)

        for df in [df_v90, df_s200]:

            df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

            df["motor_mlfb"] = df["motor_mlfb"].apply(normalize_mlfb)
            df["drive_mlfb"] = df["drive_mlfb"].apply(normalize_mlfb)

            df["encoder_class"] = df["encoder"].apply(classify_encoder)

            df["comunicacao"] = df["comunicacao"].astype(str).str.strip()

            df["voltage_class"] = df["tensao"]

            df["phases_list"] = df["fases"].apply(normalize_phases)

            df["tipo_de_eixo"] = df["tipo_de_eixo"].apply(normalize_text)
            df["freio"] = df["freio"].apply(normalize_text)

        conn.close()

        logger.info(
            f"Carregados {len(df_v90)} registros V90 e {len(df_s200)} registros S200")

        return df_v90, df_s200

    except FileNotFoundError:
        logger.error(f"Arquivo de banco de dados não encontrado: {db_path}")
        raise
    except sqlite3.Error as e:
        logger.error(f"Erro ao conectar ao banco de dados: {e}")
        raise
    except Exception as e:
        logger.error(f"Erro ao carregar banco de dados: {e}")
        raise

# ============================================================
# BUSCAS
# ============================================================


def find_v90_by_motor(df: pd.DataFrame, motor: str) -> Optional[pd.Series]:
    """
    Busca motor V90 pelo MLFB.

    Args:
        df: DataFrame com dados V90
        motor: MLFB do motor

    Returns:
        Series com dados do motor ou None
    """
    try:
        motor = normalize_mlfb(motor)

        if not motor:
            logger.warning("Motor vazio fornecido")
            return None

        result = df[df["motor_mlfb"] == motor]

        if result.empty:
            logger.warning(f"Motor não encontrado: {motor}")
            return None

        logger.info(f"Motor encontrado: {motor}")
        return result.iloc[0]

    except Exception as e:
        logger.error(f"Erro ao buscar motor: {e}")
        return None


def find_v90_set(df: pd.DataFrame, motor: str, drive: str) -> Optional[pd.Series]:
    """
    Busca conjunto motor + drive V90.

    Args:
        df: DataFrame com dados V90
        motor: MLFB do motor
        drive: MLFB do drive

    Returns:
        Series com dados do conjunto ou None
    """
    try:
        motor = normalize_mlfb(motor)
        drive = normalize_mlfb(drive)

        if not motor or not drive:
            logger.warning("Motor ou drive vazio fornecido")
            return None

        result = df[
            (df["motor_mlfb"] == motor) &
            (df["drive_mlfb"] == drive)
        ]

        if result.empty:
            logger.warning(f"Conjunto não encontrado: {motor} + {drive}")
            return None

        logger.info(f"Conjunto encontrado: {motor} + {drive}")
        return result.iloc[0]

    except Exception as e:
        logger.error(f"Erro ao buscar conjunto: {e}")
        return None

# ============================================================
# COMPATIBILIDADE
# ============================================================


def check_phase_compatibility(ref: List[int], cand: List[int]) -> bool:
    """Verifica compatibilidade de fases."""
    return any(p in cand for p in ref)

# ============================================================
# SCORING
# ============================================================


def calculate_score(ref: pd.Series, cand: pd.Series) -> Optional[Tuple[int, List[str]]]:
    """
    Calcula score de compatibilidade entre motores.

    Args:
        ref: Series com dados do motor V90
        cand: Series com dados do motor S200

    Returns:
        Tuple (score, warnings) ou None se incompatível
    """
    try:
        score = 0
        warnings = []

        if cand["motor_torque_nm"] < ref["motor_torque_nm"]:
            logger.debug(
                f"Torque insuficiente: {cand['motor_torque_nm']} < {ref['motor_torque_nm']}")
            return None
        score += 30

        if cand["motor_power_kw"] >= ref["motor_power_kw"]:
            score += 15
        else:
            warnings.append("Potência do motor inferior ao requerido")

        if cand["drive_power_kw"] >= ref["drive_power_kw"]:
            score += 10
        else:
            warnings.append("Potência do drive inferior ao requerido")

        if cand["speed_rpm"] == ref["speed_rpm"]:
            score += 20
        else:
            score -= 5
            warnings.append("Velocidade nominal inferior")

        if cand["voltage_class"] == ref["voltage_class"]:
            score += 15
        else:
            score -= 20
            warnings.append("A classe de tensão do sistema foi alterada de 200–240 V (V90) para 380–480 V (S200), conforme padrão da nova geração de acionamentos. Essa mudança exige verificação da infraestrutura elétrica, ajustes no dimensionamento de proteção e adequação da alimentação de potência.")

        if check_phase_compatibility(ref["phases_list"], cand["phases_list"]):
            score += 10
        else:
            logger.debug(
                "Alteração na configuração de fases entre V90 e S200. Verificar compatibilidade da alimentação elétrica e esquema de conexão.")
            return None

        if cand["comunicacao"] == ref["comunicacao"]:
            score += 15
        else:
            score += 0
            warnings.append("Interface de comunicação diferente")

        # ENCODER (REGRA CORRIGIDA)
        ref_enc = ref["encoder_class"]
        cand_enc = cand["encoder_class"]

        if ref_enc == "MT" and cand_enc in ["ST", "ST17", "ST21"]:
            logger.debug("Encoder multi-turn para single-turn não permitido")
            return None

        if ref_enc == "ST21":
            if cand_enc == "ST21":
                score += 5
            else:
                score -= 5
                warnings.append(
                    f"Encoder ST 21-bit substituído por '{cand['encoder']}'"
                )

        elif ref_enc == "INC":
            if cand_enc == "ST17":
                warnings.append(
                    f"O encoder incremental TTL 2500 PPR utilizado no sistema V90 foi substituído por encoder absoluto single-turn de 17 bits na solução S200, devido à não disponibilidade de suporte a encoders incrementais nesta geração. Pode ser necessária adequação de parametrização no drive e verificação de compatibilidade com o sistema de controle."
                )

        elif ref_enc == cand_enc:
            score += 5
        else:
            score += 2
            warnings.append(
                f"Encoder alterado de '{ref['encoder']}' para '{cand['encoder']}'"
            )

        eixo_match = ref["tipo_de_eixo"] == cand["tipo_de_eixo"]
        freio_match = ref["freio"] == cand["freio"]

        if eixo_match and freio_match:
            score += 15
        else:
            score -= 10
            if not eixo_match:
                warnings.append("Diferença no tipo de eixo")
            if not freio_match:
                warnings.append("Diferença na configuração de freio")

        if ref["altura_eixo_mm"] != cand["altura_eixo_mm"]:
            warnings.append("Altura de eixo diferente")

        return score, warnings

    except Exception as e:
        logger.error(f"Erro ao calcular score: {e}")
        return None

# ============================================================
# MATCH
# ============================================================


def find_best_match(ref: pd.Series, df_s200: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """
    Encontra melhor correspondência S200 para motor V90.

    Args:
        ref: Series com dados do motor V90
        df_s200: DataFrame com dados S200

    Returns:
        Dict com melhor match ou None
    """
    try:
        if ref is None:
            logger.warning("Referência V90 é None")
            return None

        if df_s200.empty:
            logger.warning("DataFrame S200 está vazio")
            return None

        candidates = []

        for _, cand in df_s200.iterrows():

            result = calculate_score(ref, cand)

            if result is None:
                continue

            score, warnings = result

            candidates.append({
                "data": cand,
                "score": score,
                "warnings": warnings
            })

        if not candidates:
            logger.warning("Nenhuma correspondência compatível encontrada")
            return None

        candidates.sort(key=lambda x: x["score"], reverse=True)
        logger.info(
            f"Melhor correspondência encontrada com score: {candidates[0]['score']}")
        return candidates[0]

    except Exception as e:
        logger.error(f"Erro ao buscar melhor match: {e}")
        return None

# ============================================================
# PRINT
# ============================================================


def print_result(ref: Optional[pd.Series], best: Optional[Dict[str, Any]]) -> None:
    """
    Exibe resultado da migração de forma formatada.

    Args:
        ref: Series com dados V90
        best: Dict com melhor match S200
    """
    try:
        print("\n" + "="*80)
        print("RESULTADO DA MIGRAÇÃO")
        print("="*80)

        if ref is None:
            print("❌ Motor V90 não encontrado")
            logger.warning("Tentativa de exibir resultado com ref=None")
            return

        print("\n🔵 CONJUNTO ATUAL")
        print("-"*80)
        print(f"Motor        : {format_mlfb(ref['motor_mlfb'])}")
        print(f"Drive        : {format_mlfb(ref['drive_mlfb'])}")
        print(f"Pot. Drive   : {ref['drive_power_kw']} kW")
        print(f"Pot. Motor   : {ref['motor_power_kw']} kW")
        print(f"Torque       : {ref['motor_torque_nm']} Nm")
        print(f"Velocidade   : {ref['speed_rpm']} rpm")
        print(f"Tensão       : {ref['tensao']}V")
        print(f"Fases        : {ref['fases']}")
        print(f"Comunicação  : {ref['comunicacao']}")
        print(f"Encoder      : {ref['encoder']}")
        print(f"Eixo         : {ref['tipo_de_eixo']}")
        print(f"Freio        : {ref['freio']}")
        print(f"Freio        : {ref['freio']}")

        if not best:
            print("\n❌ Nenhum sucessor encontrado")
            return

        cand = best["data"]

        print("\n🟢 CONJUNTO SUCESSOR")
        print("-"*80)
        print(f"Motor        : {format_mlfb(cand['motor_mlfb'])}")
        print(f"Drive        : {format_mlfb(cand['drive_mlfb'])}")
        print(f"Pot. Drive   : {cand['drive_power_kw']} kW")
        print(f"Pot. Motor   : {cand['motor_power_kw']} kW")
        print(f"Torque       : {cand['motor_torque_nm']} Nm")
        print(f"Velocidade   : {cand['speed_rpm']} rpm")
        print(f"Tensão       : {cand['tensao']}V")
        print(f"Fases        : {cand['fases']}")
        print(f"Comunicação  : {cand['comunicacao']}")
        print(f"Encoder      : {cand['encoder']}")
        print(f"Eixo         : {cand['tipo_de_eixo']}")
        print(f"Freio        : {cand['freio']}")

        print(f"\n📊 SCORE DE COMPATIBILIDADE: {best['score']}")
        print("-"*80)

        print("\n⚠️ DESVIOS")
        print("-"*80)

        if best["warnings"]:
            for w in best["warnings"]:
                print(f"- {w}")
        else:
            print("✓ Nenhum desvio detectado")

        print("\n" + "="*80 + "\n")

    except Exception as e:
        logger.error(f"Erro ao exibir resultado: {e}")


# ============================================================
# LOOP PRINCIPAL
# ============================================================


def main() -> None:
    """Função principal com loop interativo."""
    try:
        logger.info("Iniciando aplicação de migração V90 → S200")

        try:
            df_v90, df_s200 = load_database("banco.db")
        except Exception as e:
            logger.error(f"Falha ao carregar banco de dados: {e}")
            return

        while True:

            print("\n" + "="*80)
            print("MIGRAÇÃO V90 → S200")
            print("="*80)
            print("\n[1] Informar MOTOR")
            print("[2] Informar MOTOR + DRIVE")
            print("[3] Sair")

            option = input("\nEscolha: ").strip()

            ref = None

            if option == "1":

                motor = input("\nMLFB MOTOR 1FL6: ").strip()

                if not motor:
                    logger.warning("Motor vazio fornecido")
                    continue

                print("\nSelecione o tipo de comunicação do sistema:")
                print("[1] PTI (Trem de Pulso)")
                print("[2] PROFINET")

                comm_option = input("Escolha: ").strip()

                if comm_option == "1":
                    user_comm = "PTI"
                elif comm_option == "2":
                    user_comm = "PROFINET"
                else:
                    print("❌ Opção inválida")
                    logger.warning("Opção de comunicação inválida")
                    continue

                ref = find_v90_by_motor(df_v90, motor)

                if ref is not None:
                    ref = ref.copy()
                    ref["comunicacao"] = user_comm
                    logger.info(f"Comunicação ajustada para: {user_comm}")

            elif option == "2":

                motor = input("\nMLFB MOTOR 1FL6: ").strip()
                drive = input("MLFB DRIVE V90: ").strip()

                if not motor or not drive:
                    logger.warning("Motor ou drive vazio fornecido")
                    continue

                ref = find_v90_set(df_v90, motor, drive)

            elif option == "3":
                logger.info("Encerrando aplicação")
                print("\n👋 Até logo!")
                break

            else:
                print("❌ Opção inválida")
                logger.warning("Opção inválida no menu principal")
                continue

            if ref is None:
                print("❌ Conjunto não encontrado")
                continue

            best = find_best_match(ref, df_s200)
            print_result(ref, best)

            result = build_result(ref, best)
            logger.info(f"Resultado: {result['status']}")

            print("\nDeseja realizar outra conversão?")
            print("[1] Sim")
            print("[2] Sair")

            if input("Escolha: ").strip() != "1":
                logger.info("Encerrando aplicação")
                print("\n👋 Até logo!")
                break

    except KeyboardInterrupt:
        logger.info("Aplicação interrompida pelo usuário (Ctrl+C)")
        print("\n\n👋 Até logo!")
    except Exception as e:
        logger.error(f"Erro fatal na aplicação: {e}")


if __name__ == "__main__":
    main()
