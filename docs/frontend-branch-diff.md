# Mudancas Para o Frontend

Este documento resume as mudancas da branch de integracao `dev/integracao-predicao-ai-utils` que podem impactar ou ajudar o frontend.

## Predicao de Alertas

Rota afetada:

- `GET /maquinas/:id/predicao-alertas`

O contrato foi ampliado com novos campos de status operacional da predicao:

```json
{
  "estadoPredicao": "SEM_DADOS",
  "fonteDecisao": "SEM_MODELO",
  "urgencia": "MEDIA",
  "motivo": "janela_temporal_insuficiente"
}
```

Campos novos principais:

- `estadoPredicao`: estado geral da predicao. Valores esperados incluem `PREVISAO_VALIDA`, `SEM_DADOS`, `MANUTENCAO_IMEDIATA`, `FALHA_JA_CRUZADA` e `MODELO_INVALIDO_COM_RISCO`.
- `fonteDecisao`: origem da decisao. Pode vir como `REGRESSAO_LINEAR`, `HEURISTICA_CRITICA` ou `SEM_MODELO`.
- `urgencia`: classificacao operacional, como `BAIXA`, `MEDIA`, `ALTA` ou `IMEDIATA`.
- `motivo`: codigo estavel explicando o estado, por exemplo `janela_temporal_insuficiente` ou `historico_insuficiente`.

Os campos antigos continuam existindo:

- `proximoAlerta`
- `ausenciaProximoAlerta`
- `instabilidade`
- `ausenciaInstabilidade`
- `modeloIntegridade`

Mudanca importante de comportamento: quando nao houver dados confiaveis, o backend nao inventa uma previsao. Nesses casos, `proximoAlerta` e `instabilidade` podem vir como `null`, com o motivo explicado nos campos `ausencia*` e no novo status operacional.

## Modelo de Integridade

O campo `modeloIntegridade` ganhou metadados para ajudar a explicar a qualidade da predicao:

```json
{
  "r2": 0,
  "slope": 0.7763,
  "intercept": 97.58,
  "pontosUsados": 30,
  "janelaHorasCoberta": 0.16,
  "ultimoPontoEm": "2026-06-04T17:54:37.146Z"
}
```

Para o front, `janelaHorasCoberta` e `pontosUsados` ajudam a explicar casos como `SEM_DADOS`: pode haver pontos suficientes numericamente, mas concentrados em poucos minutos.

## Sensores

Rotas afetadas:

- `POST /sensores`
- `PUT /sensores/:id`

As validacoes ficaram mais fortes:

- `idealTemperatura` deve ser menor que `limiteTemperatura`.
- `idealVibracao` deve ser menor que `limiteVibracao`.
- `desvioMaximoTemp`, quando enviado, deve ser maior que zero.
- `desvioMaximoVibra`, quando enviado, deve ser maior que zero.

Impacto esperado: telas de cadastro/edicao de sensor podem receber mais respostas `400` se enviarem configuracoes inconsistentes. O ideal e validar isso tambem no formulario.

## Dashboard IA

Rota afetada:

- `POST /dashboard/ia/perguntar`

O contrato principal foi preservado. A resposta pode continuar vindo com:

- `fallback`
- `motivoFallback`
- `requiresConfirmation`
- `confirmation`
- `requiresDisambiguation`
- `disambiguation`

Foi corrigido um caso em que a IA chamava uma tool sem argumentos e o backend caia em fallback por erro interno. Para o front, nao ha nova obrigatoriedade, mas continua importante tratar `fallback: true` e fluxos de confirmacao.

## Relatorios

Rotas afetadas:

- `POST /relatorios/preview`
- `POST /relatorios/enviar-agora`
- `GET /relatorios/agendamentos`
- `POST /relatorios/agendamentos`
- `GET /relatorios/agendamentos/:id`
- `PATCH /relatorios/agendamentos/:id`
- `PATCH /relatorios/agendamentos/:id/status`
- `POST /relatorios/agendamentos/:id/executar-agora`
- `GET /relatorios/agendamentos/:id/execucoes`

O shape publico foi preservado. A mudanca foi principalmente interna, centralizando presenters e validacoes.

Campos como `descricaoAgendamento`, `proximoEnvioEm`, `ultimoEnvioEm`, `criadoEm`, `atualizadoEm`, `iniciadoEm` e `finalizadoEm` continuam formatados pelo backend.

## Usuario Ativo

Rota relevante:

- `PUT /usuarios/alterar-ativo`

Essa rota altera o `ativo` do usuario autenticado:

```json
{
  "ativo": true
}
```

Observacao: a branch de integracao deve receber a `main` antes do merge final, porque a `main` ja ajustou essa rota para permitir tambem o uso por admin.

## Recomendacoes Para Teste No Front

- Verificar se a tela de predicao exibe bem `SEM_DADOS` e motivos como `janela_temporal_insuficiente`.
- Evitar tratar `proximoAlerta: null` como erro; pode ser uma resposta esperada.
- Validar limites de sensores no formulario antes de enviar.
- Confirmar que fluxos da IA com `fallback`, `requiresConfirmation` e `requiresDisambiguation` continuam tratados.
- Conferir se telas de relatorios seguem renderizando as datas e `descricaoAgendamento` normalmente.
