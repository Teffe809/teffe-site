; Teffe Power — Custom NSIS macros
; Cria atalhos extras para o Agente após instalação

!macro customInstall
  ; Atalho "Teffe Power Agent" na área de trabalho
  CreateShortcut "$DESKTOP\Teffe Power Agent.lnk" \
    "cmd.exe" \
    '/k cd /d "$INSTDIR\agente" && python agente.py run' \
    "$INSTDIR\build\icon.ico" 0 \
    SW_SHOWNORMAL \
    "" \
    "Inicia o agente de monitoramento SNMP"

  ; Atalho "Teffe Power Agent" no Menu Iniciar
  CreateShortcut "$SMPROGRAMS\Teffe Power\Teffe Power Agent.lnk" \
    "cmd.exe" \
    '/k cd /d "$INSTDIR\agente" && python agente.py run' \
    "$INSTDIR\build\icon.ico" 0 \
    SW_SHOWNORMAL \
    "" \
    "Inicia o agente de monitoramento SNMP"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Teffe Power Agent.lnk"
  Delete "$SMPROGRAMS\Teffe Power\Teffe Power Agent.lnk"
!macroend
