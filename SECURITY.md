# Segurança · Caffè D’oro

Projeto de portfólio da **SHINNARE**. A marca é fictícia, mas reservas, pedidos, Pix de demonstração e e-mails passam por um sistema real, então tratamos segurança e dados pessoais como numa empresa de verdade.

## Como reportar uma falha

Fale com a equipe pelo WhatsApp (11) 93391-4350 ou abra um aviso privado em **Security → Report a vulnerability** neste repositório. Respondemos em até 3 dias úteis. Por favor, não teste ataques de negação de serviço nem acesse dados de outras pessoas.

## Arquitetura

```
navegador ──HTTPS──> Vercel (site estático + cabeçalhos de segurança)
                       └─ /api/* (rewrite, mesma origem) ──> Supabase Edge Function "api"
                                                               └─ Postgres (RLS forçado, sem acesso público)
Edge Function ──> Google Apps Script (Gmail/Agenda do dono) · CallMeBot (alerta no WhatsApp da equipe)
```

## Controles

**Navegador**
- Content-Security-Policy estrita: `default-src 'none'`, `script-src 'self'`, sem `unsafe-inline` e sem `unsafe-eval`; nenhum script de terceiros. Estilos só do próprio site e do Google Fonts.
- Nenhum `style=""` nem `<script>` embutido no HTML; o código monta estilos pelo CSSOM.
- `frame-ancestors 'none'` + `X-Frame-Options: DENY` (clickjacking), HSTS com preload, `nosniff`, `Referrer-Policy`, `Permissions-Policy` fechando câmera, microfone, localização e pagamento, COOP e CORP `same-origin`.
- Textos vindos de fora são inseridos com `textContent` ou escapados antes de virar HTML.
- Links externos com `rel="noopener noreferrer"`.
- QR Code gerado por código próprio (`assets/qr.js`), sem biblioteca externa.

**API (Supabase Edge Function)**
- Só aceita a origem do site (bloqueio de CSRF por `Origin`), só `GET`/`POST`, só JSON, corpo de até 16 KB.
- Cada campo é validado no servidor (tamanho, formato, listas permitidas). Honeypot contra robôs.
- **Preços, descontos e frete são recalculados no servidor** a partir do catálogo; o valor enviado pela página é ignorado.
- Limite de tentativas por IP e global, gravado no banco. O IP nunca é salvo: vira um hash com sal secreto que muda todo dia.
- Mensagens de erro genéricas; nenhum dado pessoal nos logs.

**Pix de demonstração**
- Cada pedido recebe um id aleatório (UUID v4) e um token de 256 bits. O banco guarda só o **hash SHA-256** do token.
- O link do QR leva o token no `#fragmento`, que navegadores não enviam a servidores nem no Referer; a página de confirmação o retira da barra de endereço.
- A confirmação é atômica no banco (`update ... where status = 'awaiting_payment' and expira > now()`), expira em 15 minutos e não pode ser repetida.

**Banco de dados**
- RLS ligado e **forçado** em todas as tabelas, sem nenhuma política: o público (`anon`/`authenticated`) não lê nem escreve nada. Privilégios revogados.
- Restrições `check` em todos os campos e índice único que impede duas reservas da mesma mesa no mesmo horário.
- Retenção automática (pg_cron): reservas 7 dias depois da data, pedidos 30 dias, clube 180 dias, registros de segurança 2 dias.

**E-mails**
- O Apps Script do Gmail não recebe dados da página: recebe só um id de tarefa aleatório e busca os dados no servidor, que os entrega uma única vez em até 30 minutos. Quem descobrir a URL do script não consegue enviar nada.

**Segredos**
- Nenhuma chave no repositório. As chaves do CallMeBot ficam nos *secrets* da Edge Function; a chave de serviço do Supabase existe só dentro do servidor.

## LGPD

Política completa em [/privacidade](https://caffedoro-shinnare.vercel.app/privacidade): dados mínimos, finalidade informada em cada formulário, prazo de retenção, lista de operadores e canal para exercer direitos.
