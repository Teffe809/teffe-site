@echo off
chcp 65001 > nul
title Teffe Power — Instalação do Agente

echo.
echo  ████████╗███████╗███████╗███████╗███████╗    ██████╗  ██████╗ ██╗    ██╗███████╗██████╗
echo  ╚══██╔══╝██╔════╝██╔════╝██╔════╝██╔════╝    ██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔══██╗
echo     ██║   █████╗  █████╗  █████╗  █████╗      ██████╔╝██║   ██║██║ █╗ ██║█████╗  ██████╔╝
echo     ██║   ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝      ██╔═══╝ ██║   ██║██║███╗██║██╔══╝  ██╔══██╗
echo     ██║   ███████╗██║     ██║     ███████╗    ██║     ╚██████╔╝╚███╔███╔╝███████╗██║  ██║
echo     ╚═╝   ╚══════╝╚═╝     ╚═╝     ╚══════╝    ╚═╝      ╚═════╝  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝
echo.
echo  Agente de Monitoramento SNMP — Instalador v1.0
echo  ─────────────────────────────────────────────────
echo.

:: Verificar privilégios de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRO] Este script requer privilégios de Administrador.
    echo  Clique com o botão direito no arquivo e selecione "Executar como administrador".
    pause
    exit /b 1
)

:: ── PASSO 1: Verificar Python ────────────────────────────────────────────────
echo  [1/5] Verificando Python...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  Python não encontrado. Instalando via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if %errorLevel% neq 0 (
        echo  [ERRO] Falha ao instalar Python. Instale manualmente em https://python.org
        pause
        exit /b 1
    )
    :: Atualizar PATH
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
)

python --version
echo  Python OK!
echo.

:: ── PASSO 2: Atualizar pip ───────────────────────────────────────────────────
echo  [2/5] Atualizando pip...
python -m pip install --upgrade pip --quiet
echo  pip OK!
echo.

:: ── PASSO 3: Instalar dependências ──────────────────────────────────────────
echo  [3/5] Instalando dependências...
echo  (pysnmp, requests, pywin32 — pode demorar alguns minutos)
python -m pip install pysnmp requests pywin32 --quiet
if %errorLevel% neq 0 (
    echo  [AVISO] Falha em algumas dependências. Tentando individualmente...
    python -m pip install pysnmp --quiet
    python -m pip install requests --quiet
    python -m pip install pywin32 --quiet
)
echo  Dependências instaladas!
echo.

:: ── PASSO 4: Copiar arquivos para pasta de instalação ───────────────────────
echo  [4/5] Copiando arquivos...
set "INSTALL_DIR=%ProgramFiles%\Teffe\TeffePowerAgent"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

copy /Y "%~dp0agente.py"    "%INSTALL_DIR%\agente.py"    > nul
copy /Y "%~dp0config.ini"   "%INSTALL_DIR%\config.ini"   > nul

echo  Arquivos copiados para: %INSTALL_DIR%
echo.

:: ── PASSO 5: Registrar como serviço Windows ─────────────────────────────────
echo  [5/5] Registrando serviço Windows...

:: Remover serviço anterior se existir
sc stop TeffePowerAgent > nul 2>&1
sc delete TeffePowerAgent > nul 2>&1

:: Criar serviço via NSSM (Non-Sucking Service Manager) se disponível
where nssm > nul 2>&1
if %errorLevel% equ 0 (
    nssm install TeffePowerAgent python "%INSTALL_DIR%\agente.py" run
    nssm set TeffePowerAgent AppDirectory "%INSTALL_DIR%"
    nssm set TeffePowerAgent DisplayName "Teffe Power Agent"
    nssm set TeffePowerAgent Description "Teffe Power — Agente de Monitoramento SNMP de Impressoras"
    nssm set TeffePowerAgent Start SERVICE_AUTO_START
    nssm start TeffePowerAgent
    echo  Serviço registrado via NSSM!
) else (
    :: Fallback: registrar via pywin32
    cd /d "%INSTALL_DIR%"
    python agente.py instalar > nul 2>&1
    if %errorLevel% equ 0 (
        sc start TeffePowerAgent > nul 2>&1
        echo  Serviço registrado!
    ) else (
        echo  [AVISO] Serviço não registrado automaticamente.
        echo  Para rodar manualmente: abra o Prompt de Comando e execute:
        echo     python "%INSTALL_DIR%\agente.py" run
    )
)

echo.

:: ── Criar atalho para o painel no Desktop ───────────────────────────────────
echo  Criando atalho para o painel web...
set "PAINEL_URL=file:///%~dp0..\index.html"
set "SHORTCUT=%USERPROFILE%\Desktop\Teffe Power.url"
(
    echo [InternetShortcut]
    echo URL=%PAINEL_URL%
    echo IconFile=%SystemRoot%\system32\shell32.dll
    echo IconIndex=14
) > "%SHORTCUT%"
echo  Atalho criado na área de trabalho: "Teffe Power"
echo.

:: ── Verificar serviço ───────────────────────────────────────────────────────
sc query TeffePowerAgent > nul 2>&1
if %errorLevel% equ 0 (
    echo  ╔══════════════════════════════════════════════════╗
    echo  ║  ✓ Instalação concluída com sucesso!             ║
    echo  ║                                                  ║
    echo  ║  Serviço: TeffePowerAgent                        ║
    echo  ║  Status:  Rodando                                ║
    echo  ║  Coleta:  A cada 5 minutos                       ║
    echo  ║                                                  ║
    echo  ║  Abra "Teffe Power" na área de trabalho          ║
    echo  ║  para acessar o painel.                          ║
    echo  ╚══════════════════════════════════════════════════╝
) else (
    echo  ╔══════════════════════════════════════════════════╗
    echo  ║  Instalação concluída.                           ║
    echo  ║                                                  ║
    echo  ║  Para iniciar o agente manualmente:              ║
    echo  ║  python "%INSTALL_DIR%\agente.py"                ║
    echo  ║                                                  ║
    echo  ║  Abra "Teffe Power" na área de trabalho          ║
    echo  ║  para acessar o painel.                          ║
    echo  ╚══════════════════════════════════════════════════╝
)

echo.
echo  Pressione qualquer tecla para fechar...
pause > nul
