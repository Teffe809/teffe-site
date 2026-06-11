"""
Teffe Power — Agente de Coleta SNMP
Coleta dados das impressoras via SNMP e envia ao Supabase.
Pode rodar como serviço Windows ou diretamente via python agente.py
"""

import asyncio
import os
import sys
import time
import logging
import configparser
import requests
from datetime import datetime, timezone

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    filename="agente.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("teffe-power")

# ── OIDs SNMP universais ─────────────────────────────────────────────────────
OID_STATUS         = "1.3.6.1.2.1.25.3.5.1.1.1"
OID_TONER_PRETO    = "1.3.6.1.2.1.43.11.1.1.9.1.1"
OID_TONER_CIANO    = "1.3.6.1.2.1.43.11.1.1.9.1.2"
OID_TONER_MAGENTA  = "1.3.6.1.2.1.43.11.1.1.9.1.3"
OID_TONER_AMARELO  = "1.3.6.1.2.1.43.11.1.1.9.1.4"
OID_TONER_MAX      = "1.3.6.1.2.1.43.11.1.1.8.1.1"
OID_PAPEL_NIVEL    = "1.3.6.1.2.1.43.8.2.1.10.1.1"
OID_PAPEL_MAX      = "1.3.6.1.2.1.43.8.2.1.9.1.1"
OID_PAGINAS        = "1.3.6.1.2.1.43.10.2.1.4.1.1"

# Status codes HR Printer Detection Status
STATUS_MAP = {1: "outro", 2: "desconhecido", 3: "idle", 4: "printing",
              5: "warmup", 6: "offline", 7: "standby"}


def carregar_config(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.ini")
    cfg = configparser.ConfigParser()
    cfg.read(path, encoding="utf-8")
    s = cfg["teffe_power"]
    return {
        "chave":      s.get("licenca_chave"),
        "sb_url":     s.get("supabase_url"),
        "sb_key":     s.get("supabase_key"),
        "intervalo":  int(s.get("intervalo_seg", 300)),
        "community":  s.get("snmp_community", "public"),
        "versao":     s.get("snmp_versao", "2c"),
        "al_toner":   int(s.get("alerta_toner", 20)),
        "al_papel":   int(s.get("alerta_papel", 15)),
    }


# ── Supabase REST helpers ─────────────────────────────────────────────────────
class Supabase:
    def __init__(self, url, key):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def get(self, table, params=""):
        r = requests.get(f"{self.url}/rest/v1/{table}?{params}",
                         headers=self.headers, timeout=15)
        r.raise_for_status()
        return r.json()

    def post(self, table, data):
        r = requests.post(f"{self.url}/rest/v1/{table}",
                          headers=self.headers, json=data, timeout=15)
        r.raise_for_status()
        return r.json()

    def patch(self, table, filtro, data):
        r = requests.patch(f"{self.url}/rest/v1/{table}?{filtro}",
                           headers=self.headers, json=data, timeout=15)
        r.raise_for_status()
        return r.json()


# ── SNMP helpers (pysnmp 7.x — API Slim/asyncio) ─────────────────────────────
async def snmp_get(ip, oid, community="public", versao="2c"):
    """Busca um OID via SNMP. Retorna valor inteiro ou None."""
    try:
        from pysnmp.hlapi.v1arch.asyncio import (
            Slim, ObjectType, ObjectIdentity,
        )
        ver = 1 if versao == "1" else 2
        with Slim(ver) as slim:
            errorIndication, errorStatus, _, varBinds = await slim.get(
                community,
                ip,
                161,
                ObjectType(ObjectIdentity(oid)),
                timeout=3,
                retries=1,
            )
        if errorIndication or errorStatus:
            return None
        for varBind in varBinds:
            return int(varBind[1])
    except Exception as e:
        log.debug(f"SNMP {ip} OID {oid}: {e}")
    return None


async def coletar_impressora(ip, community, versao):
    """Coleta todos os dados de uma impressora via SNMP (concorrente)."""
    def pct(val, max_val):
        if val is None:
            return None
        if val == -3:   # RFC 1759: at or near full capacity
            return 100
        if val < 0:     # -2 = unknown, -1 = no limit
            return None
        if max_val is None or max_val <= 0:
            return None
        return max(0, min(100, int(val * 100 / max_val)))

    # Dispara todas as queries SNMP ao mesmo tempo
    (
        status_raw,
        toner_preto_raw, toner_max_raw,
        toner_ciano_raw, toner_magenta_raw, toner_amarelo_raw,
        papel_raw, papel_max,
        paginas,
    ) = await asyncio.gather(
        snmp_get(ip, OID_STATUS,        community, versao),
        snmp_get(ip, OID_TONER_PRETO,   community, versao),
        snmp_get(ip, OID_TONER_MAX,     community, versao),
        snmp_get(ip, OID_TONER_CIANO,   community, versao),
        snmp_get(ip, OID_TONER_MAGENTA, community, versao),
        snmp_get(ip, OID_TONER_AMARELO, community, versao),
        snmp_get(ip, OID_PAPEL_NIVEL,   community, versao),
        snmp_get(ip, OID_PAPEL_MAX,     community, versao),
        snmp_get(ip, OID_PAGINAS,       community, versao),
    )

    if status_raw is None:
        return {"status": "offline"}

    status_nome = STATUS_MAP.get(status_raw, "online")
    if status_nome in ("offline", "desconhecido"):
        status_str = "offline"
    elif status_nome in ("printing", "warmup", "standby", "idle"):
        status_str = "online"
    else:
        status_str = "alerta"

    toner_preto_pct = pct(toner_preto_raw, toner_max_raw) if toner_max_raw else (
        max(0, min(100, toner_preto_raw)) if toner_preto_raw is not None else None
    )

    return {
        "status":         status_str,
        "toner_preto":    toner_preto_pct,
        "toner_ciano":    pct(toner_ciano_raw,   toner_max_raw),
        "toner_magenta":  pct(toner_magenta_raw, toner_max_raw),
        "toner_amarelo":  pct(toner_amarelo_raw, toner_max_raw),
        "nivel_papel":    pct(papel_raw, papel_max),
        "paginas_total":  paginas,
        "paginas_hoje":   None,
        "paginas_pb":     None,
        "paginas_color":  None,
        "ultimo_erro":    None,
    }


# ── Ciclo principal ───────────────────────────────────────────────────────────
async def ciclo(cfg, sb):
    log.info("=== Iniciando ciclo de coleta ===")
    chave = cfg["chave"]

    try:
        impressoras = sb.get(
            "teffe_power_impressoras",
            f"licenca_chave=eq.{chave}&ativo=eq.true&select=id,nome,ip",
        )
    except Exception as e:
        log.error(f"Erro ao buscar impressoras: {e}")
        return

    log.info(f"Encontradas {len(impressoras)} impressoras ativas")

    for imp in impressoras:
        ip   = imp["ip"]
        nome = imp["nome"]
        log.info(f"Coletando: {nome} ({ip})")

        dados = await coletar_impressora(ip, cfg["community"], cfg["versao"])
        dados["impressora_id"]  = imp["id"]
        dados["licenca_chave"]  = chave
        dados["coletado_em"]    = datetime.now(timezone.utc).isoformat()

        try:
            sb.post("teffe_power_leituras", dados)
            log.info(f"  → {nome}: status={dados['status']} toner={dados.get('toner_preto')}%")
        except Exception as e:
            log.error(f"  → Erro ao salvar leitura de {nome}: {e}")
            continue

        gerar_alertas(sb, chave, imp["id"], nome, dados, cfg)

    log.info("=== Ciclo concluído ===")


def gerar_alertas(sb, chave, imp_id, nome, dados, cfg):
    def criar_alerta(tipo, msg):
        existentes = sb.get(
            "teffe_power_alertas",
            f"licenca_chave=eq.{chave}&impressora_id=eq.{imp_id}&tipo=eq.{tipo}&resolvido=eq.false&select=id",
        )
        if existentes:
            return
        sb.post("teffe_power_alertas", {
            "licenca_chave": chave,
            "impressora_id": imp_id,
            "tipo":          tipo,
            "mensagem":      msg,
            "resolvido":     False,
        })
        log.warning(f"ALERTA criado: {msg}")

    def resolver_alerta(tipo):
        sb.patch(
            "teffe_power_alertas",
            f"licenca_chave=eq.{chave}&impressora_id=eq.{imp_id}&tipo=eq.{tipo}&resolvido=eq.false",
            {"resolvido": True},
        )

    status = dados.get("status")
    toner  = dados.get("toner_preto")
    papel  = dados.get("nivel_papel")

    if status == "offline":
        criar_alerta("offline", f"{nome} — Impressora offline. Verificar conexão de rede.")
    else:
        resolver_alerta("offline")

    if toner is not None:
        if toner <= cfg["al_toner"]:
            criar_alerta("toner_baixo", f"{nome} — Toner preto em {toner}%. {'Substituição urgente' if toner < 10 else 'Reposição necessária'}.")
        elif toner > cfg["al_toner"] + 5:
            resolver_alerta("toner_baixo")

    if papel is not None:
        if papel <= cfg["al_papel"]:
            criar_alerta("papel_baixo", f"{nome} — Papel abaixo de {papel}%. Reabastecer bandeja.")
        elif papel > cfg["al_papel"] + 5:
            resolver_alerta("papel_baixo")


# ── Modo serviço Windows ──────────────────────────────────────────────────────
SERVICO_NOME = "TeffePowerAgent"
SERVICO_DESC = "Teffe Power — Agente de Monitoramento SNMP"

def instalar_servico():
    try:
        import win32serviceutil
        win32serviceutil.InstallService(
            None,
            SERVICO_NOME,
            SERVICO_DESC,
            startType=2,
            exeName=sys.executable,
            exeArgs=f'"{__file__}" run',
        )
        print(f"Serviço '{SERVICO_NOME}' instalado com sucesso.")
    except ImportError:
        print("pywin32 não instalado. Rodando em modo contínuo...")
        asyncio.run(main_loop())
    except Exception as e:
        print(f"Erro ao instalar serviço: {e}")


async def main_loop():
    log.info("Teffe Power Agent iniciado")
    cfg = carregar_config()
    sb = Supabase(cfg["sb_url"], cfg["sb_key"])

    while True:
        try:
            await ciclo(cfg, sb)
        except Exception as e:
            log.error(f"Erro no ciclo: {e}")
        log.info(f"Aguardando {cfg['intervalo']}s para próxima coleta...")
        await asyncio.sleep(cfg["intervalo"])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "instalar":
        instalar_servico()
    elif cmd == "uma-vez":
        cfg = carregar_config()
        sb = Supabase(cfg["sb_url"], cfg["sb_key"])
        asyncio.run(ciclo(cfg, sb))
    else:
        asyncio.run(main_loop())
