╔══════════════════════════════════════════════════════════════╗
║           TEFFE POWER — Fleet Management System              ║
║                        v1.0                                  ║
╚══════════════════════════════════════════════════════════════╝

Powered by Teffe Tecnologia — https://teffe.com.br

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 O QUE É O TEFFE POWER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Teffe Power é um sistema de gerenciamento de frota de impressoras
que coleta dados via SNMP e exibe em um painel web em tempo real.

Componentes instalados:
  • Painel Web  — interface principal (atalho "Teffe Power")
  • Agente SNMP — coleta dados das impressoras (atalho "Teffe Power Agent")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CONFIGURAÇÃO DO AGENTE — agente\config.ini
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de usar, edite o arquivo:
  [pasta de instalação]\agente\config.ini

Parâmetros:

  licenca_chave  = Sua chave de licença Teffe Power
                   (ex: TEFFE-POWER-DEMO-2026)

  supabase_url   = URL do Supabase (não alterar)

  supabase_key   = Chave de API Supabase (não alterar)

  intervalo_seg  = Intervalo de coleta em segundos
                   Padrão: 300 (5 minutos)
                   Mínimo recomendado: 60

  snmp_community = Community SNMP da rede
                   Padrão: public
                   Altere se sua rede usa community diferente

  snmp_versao    = Versão do SNMP: "1" ou "2c"
                   Padrão: 2c (recomendado)

  alerta_toner   = Percentual de toner para gerar alerta
                   Padrão: 20 (alerta quando abaixo de 20%)

  alerta_papel   = Percentual de papel para gerar alerta
                   Padrão: 15 (alerta quando abaixo de 15%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REQUISITOS PARA O AGENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Python 3.8 ou superior instalado
   Download: https://python.org/downloads

2. Bibliotecas Python (instalar via CMD):
   pip install pysnmp requests

   Nota: se pysnmp der erro de compatibilidade, use:
   pip install pysnmp-lextudio requests

3. Impressoras com SNMP habilitado na rede
   • Porta UDP 161 acessível
   • Community "public" (ou conforme configurado)

4. Acesso à internet na porta 443 (HTTPS para Supabase)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMO USAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Abra o painel:
   → Clique no atalho "Teffe Power" na área de trabalho
   → Login com email, senha e chave de licença

2. Cadastre as impressoras:
   → Painel > Impressoras > "+ Adicionar Impressora"
   → Informe: Nome, IP, Fabricante, Modelo, Localização

3. Inicie o agente:
   → Clique em "Teffe Power Agent" na área de trabalho
   → Uma janela CMD abrirá mostrando as coletas em tempo real
   → Deixe rodando em segundo plano

4. Acompanhe os dados:
   → O painel atualiza automaticamente a cada 30 segundos
   → Alertas aparecem no sino do menu lateral

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXECUTAR AGENTE EM MODO DE TESTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para testar uma única coleta sem loop contínuo:
  1. Abra o Prompt de Comando (CMD)
  2. Execute:
     python "[pasta de instalação]\agente\agente.py" uma-vez
  3. Verifique o arquivo agente.log gerado na mesma pasta

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUPORTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Site:    https://teffe.com.br
  E-mail:  contato@teffe.com.br
  WhatsApp: (11) 99999-9999

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
