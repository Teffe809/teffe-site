@echo off
chcp 65001 > nul
title Teffe Power — Agente SNMP
echo.
echo  TEFFE POWER — Agente de Monitoramento SNMP
echo  ────────────────────────────────────────────
echo  Coletando dados das impressoras a cada 5 minutos...
echo  Pressione Ctrl+C para encerrar.
echo.
cd /d "%~dp0agente"
python agente.py run
