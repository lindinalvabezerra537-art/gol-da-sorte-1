---
name: Ranking exclusividade
description: Regra de exclusividade no ranking — cada jogador ocupa apenas 1 posição
---

# Ranking Exclusividade — Gol da Sorte

## Regra
Cada jogador pode aparecer em **apenas 1** pódio de ranking, seguindo a prioridade:

1. **Brasil** — top 3 do país
2. **Estado** — top 3 do estado (excluindo quem já está no Brasil)
3. **Cidade** — top 3 da cidade (excluindo quem já está no Brasil ou Estado)

## Implementação

A função `getExclusiveRanking()` em `artifacts/api-server/src/routes/users.ts` é usada por:
- Endpoints públicos: `/users/ranking/brasil`, `/estado/:estado`, `/cidade/:cidade`
- Endpoint admin: `/admin/ranking`
- Painel admin em `AdminPanel.tsx` (tab 🏆 Ranking)

## Ajuste de pontos pelo admin

Rota: `POST /admin/users/:id/points` com body `{ delta: number }`
- Aceita valores positivos ou negativos
- Pontos nunca ficam abaixo de 0
- Requer Bearer token admin

## Why
O usuário solicitou explicitamente que líderes não sejam duplicados entre camadas. Um líder do Brasil não deve aparecer também como líder do estado/cidade, para dar visibilidade a mais jogadores.
