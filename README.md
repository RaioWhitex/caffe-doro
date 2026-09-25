# Caffè D’oro

Uma experiência digital conceitual da **SHINNARE**: o site de uma cafeteria e torrefação fictícia nos Jardins, em São Paulo.

**Site no ar:** https://caffedoro-shinnare.vercel.app

## O que tem no site

- **Abertura animada pela rolagem:** o grão dourado explode em pó de café e grãos de ouro, os ramos se abrem, os nove pacotes caem em fila e um filme do balcão roda atrás do convite final.
- **Um oceano de café:** ondas de café e ouro em WebGL que reagem ao mouse e ao dedo.
- **O ritual:** segure o botão e sirva um espresso. “Servir outra” leva a xícara e o café juntos.
- **Loja** com nove cafés, xícaras e canecas, e **checkout em quatro etapas** com pedido real no servidor.
- **Pix de demonstração:** o QR Code abre uma página no celular com “Confirmar pagamento”; a tela do pedido atualiza sozinha quando o celular confirma.
- **Reserva de mesa** na planta do salão, com disponibilidade real, e-mail de confirmação e convite no Google Agenda.
- **Avisos no WhatsApp** para a equipe a cada reserva, pedido e Pix.
- **Clube D’oro** com e-mail de boas-vindas, **entrega em até 10 km** com consulta de CEP, tema escuro e claro, português e inglês.
- **Camaleão da SHINNARE animado** no rodapé, com os contatos da equipe.

## Estrutura

| Pasta | O que é |
|---|---|
| `public/` | o site (HTML, CSS e JavaScript puros, sem build) |
| `supabase/functions/api/` | a API (Supabase Edge Function, Deno) |
| `apps-script/` | o remetente de e-mails pelo Gmail (Google Apps Script) |
| `vercel.json` | hospedagem, cabeçalhos de segurança e rota `/api` |

Segurança e privacidade: veja [SECURITY.md](SECURITY.md) e a [política de privacidade](https://caffedoro-shinnare.vercel.app/privacidade).

## Aviso

Caffè D’oro é uma marca fictícia, criada pela SHINNARE como projeto de portfólio. Reservas e pedidos passam por um sistema de verdade, mas nada é cobrado e nada é entregue.

## Equipe SHINNARE

- Gustavo Steferson de Souza Rocha · [WhatsApp](https://wa.me/5511933914350)
- Guilherme Silva de Oliveira · [WhatsApp](https://wa.me/5511968326459)
- Kevin Araujo Paiva de Souza · [WhatsApp](https://wa.me/5511934361722)
