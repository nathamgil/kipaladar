/* Kipaladar — painel da casa: hoje, pedidos, reservas, cardápio, clientes e configurações. */
(function () {
  var T = window.BN, U = BD.U, $ = function (s, r) { return (r || document).querySelector(s); };
  var ico = function (id, cls) { return '<svg class="ico ' + (cls || '') + '"><use href="#i-' + id + '"/></svg>'; };
  var esc = U.esc;
  var D = { pedidos: [], reservas: [], itens: [], bairros: [], cfg: {}, horarios: T.horarios };
  var aba = 'hoje', vistos = null, som = true;
  try { aba = localStorage.getItem('kip_admin_aba') || 'hoje'; som = localStorage.getItem('kip_admin_som') !== '0'; } catch (e) {}
  if (/^#(hoje|pedidos|reservas|cardapio|clientes|config)$/.test(location.hash)) aba = location.hash.slice(1);

  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function erro(e) { toast(e && e.message ? e.message : 'Não salvou. Tente de novo.'); }
  function hojeStr() { return U.hoje(); }
  function dataDe(iso) { return U.hoje(new Date(iso)); }
  function hhmm(iso) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function dataBR(s) { var p = s.split('-'); return p[2] + '/' + p[1]; }
  function diaNome(s) {
    var h = hojeStr(), a = new Date(); a.setDate(a.getDate() + 1);
    if (s === h) return 'Hoje'; if (s === U.hoje(a)) return 'Amanhã';
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(s + 'T12:00').getDay()] + ' ' + dataBR(s);
  }
  function minutosDesde(iso) { return Math.floor((Date.now() - new Date(iso)) / 60000); }
  function primeiroNome(n) { return String(n || '').replace(' (exemplo)', '').split(' ')[0]; }

  /* ---------- entrada ---------- */
  BD.sessao().then(function (ok) { ok ? iniciar() : telaLogin(); }).catch(telaLogin);

  function telaLogin() {
    $('#app').innerHTML = '<div class="login"><img src="fotos/icone.png" alt=""><h1 style="font:400 34px var(--display)">Painel Kipaladar</h1>' +
      '<form id="f-login"><div><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required></div>' +
      '<div><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-p" type="submit">Entrar</button></form></div>';
    $('#f-login').onsubmit = function (e) {
      e.preventDefault();
      BD.entrar($('#l-email').value, $('#l-senha').value).then(iniciar).catch(erro);
    };
  }

  function carregar() {
    return Promise.all([BD.pedidos(), BD.reservas(), BD.cardapio(), BD.bairros(), BD.config(), BD.horarios()]).then(function (r) {
      D.pedidos = r[0] || []; D.reservas = r[1] || []; D.itens = r[2] || []; D.bairros = r[3] || []; D.cfg = r[4] || {}; D.horarios = r[5] || T.horarios;
    });
  }

  function iniciar() {
    $('#app').innerHTML = '<header class="topo"><div class="in"><img src="fotos/icone.png" alt=""><div class="nome"><h1>Kipaladar</h1><small>Painel da casa</small></div>' +
      '<div class="dir"><button class="pill" id="loja"></button><button class="btn-topo" id="b-som" title="Som de novo pedido">' + ico('som') + '</button>' +
      '<a class="btn-topo" href="./" target="_blank" title="Ver o site">' + ico('olho') + '<span class="so-desk">Site</span></a>' +
      (BD.demo ? '' : '<button class="btn-topo" id="sair" title="Sair">' + ico('sair') + '</button>') + '</div></div></header>' +
      '<nav class="abas"><div class="in" id="abas"></div></nav><main id="main"></main>';
    $('#b-som').style.opacity = som ? 1 : .45;
    $('#b-som').onclick = function () { som = !som; this.style.opacity = som ? 1 : .45; try { localStorage.setItem('kip_admin_som', som ? '1' : '0'); } catch (e) {} if (som) bip(); toast(som ? 'Som ligado' : 'Som desligado'); };
    if ($('#sair')) $('#sair').onclick = function () { BD.sair().then(function () { location.reload(); }); };
    $('#loja').onclick = function () { aba = 'config'; pintar(); };
    carregar().then(function () {
      vistos = new Set(D.pedidos.map(function (p) { return p.id; }));
      pintar();
      BD.aoMudar(atualizar);
      setInterval(function () { if (aba === 'pedidos' || aba === 'hoje') pintar(true); }, 30000);
    }).catch(erro);
  }

  function atualizar() {
    carregar().then(function () {
      var novos = D.pedidos.filter(function (p) { return !vistos.has(p.id); });
      novos.forEach(function (p) { vistos.add(p.id); });
      if (novos.length) {
        bip(); toast(novos.length === 1 ? 'Pedido novo: ' + novos[0].codigo : novos.length + ' pedidos novos');
        document.title = '(' + novos.length + ') Novo pedido · Kipaladar';
        setTimeout(function () { document.title = 'Painel · Kipaladar'; }, 8000);
        atualizar.piscar = novos.map(function (p) { return p.id; });
      }
      pintar(true);
    }).catch(function () {});
  }

  var ctx = null;
  function bip() {
    if (!som) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      [0, .18, .36].forEach(function (t, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = i === 2 ? 1175 : 880; o.type = 'sine';
        g.gain.setValueAtTime(.001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.35, ctx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .16);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .17);
      });
    } catch (e) {}
  }

  /* ---------- casca ---------- */
  var ABAS = [['hoje', 'Hoje', 'casa'], ['pedidos', 'Pedidos', 'sacola'], ['reservas', 'Reservas', 'cal'], ['cardapio', 'Cardápio', 'lista'], ['clientes', 'Clientes', 'gente'], ['config', 'Configurações', 'eng']];
  function pintar(silencioso) {
    try { localStorage.setItem('kip_admin_aba', aba); } catch (e) {}
    var novos = D.pedidos.filter(function (p) { return p.status === 'novo'; }).length;
    var resPend = D.reservas.filter(function (r) { return r.status === 'pendente' && r.data >= hojeStr(); }).length;
    $('#abas').innerHTML = ABAS.map(function (a) {
      var b = a[0] === 'pedidos' && novos ? novos : a[0] === 'reservas' && resPend ? resPend : 0;
      return '<button data-aba="' + a[0] + '"' + (aba === a[0] ? ' class="on"' : '') + '>' + ico(a[2]) + a[1] + (b ? '<span class="badge">' + b + '</span>' : '') + '</button>';
    }).join('');
    var st = U.status(D.horarios, D.cfg), aceita = D.cfg.aceitando_pedidos !== false;
    var l = $('#loja'); l.className = 'pill ' + (st.aberto && aceita ? 'on' : 'off');
    l.innerHTML = '<i></i>' + (!aceita ? 'Pedidos pausados' : st.aberto ? 'Aberto' : 'Fechado');
    if (silencioso && document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; // não atrapalha quem está digitando
    var y = scrollY;
    var demo = BD.demo ? '<div class="demo"><span><b>Modo demonstração.</b> Os dados ficam só neste navegador e os clientes marcados "(exemplo)" são fictícios. Faça um pedido no site em outra aba e veja chegar aqui.</span><button class="btn btn-s btn-mini" id="zerar">Recomeçar demo</button></div>' : '';
    $('#main').innerHTML = demo + ({ hoje: vHoje, pedidos: vPedidos, reservas: vReservas, cardapio: vCardapio, clientes: vClientes, config: vConfig })[aba]();
    if ($('#zerar')) $('#zerar').onclick = function () { if (confirm('Apagar tudo da demonstração e recomeçar do zero?')) { BD.zerarDemo(); location.reload(); } };
    if (silencioso) window.scrollTo(0, y);
    (ligar[aba] || function () {})();
    if (atualizar.piscar) { atualizar.piscar.forEach(function (id) { var el = document.querySelector('[data-ped="' + id + '"]'); if (el) el.classList.add('pisca'); }); atualizar.piscar = null; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; pintar(); window.scrollTo(0, 0); }
  });

  /* ---------- helpers de pedido ---------- */
  function totalTxt(p) { return p.total_centavos != null ? U.reais(p.total_centavos) : 'a confirmar'; }
  function faturamento(lista) {
    var s = 0, sem = 0;
    lista.forEach(function (p) { if (p.status === 'cancelado') return; if (p.total_centavos != null) s += p.total_centavos; else sem++; });
    return { soma: s, sem: sem };
  }
  var PROX = { novo: ['preparo', 'Aceitar e preparar'], preparo: ['saiu', 'Saiu para entrega'], saiu: ['entregue', 'Entregue'] };
  var ROT = { novo: 'Novo', preparo: 'Em preparo', saiu: 'Saiu', entregue: 'Concluído', cancelado: 'Cancelado' };
  function msgCliente(p) {
    var n = primeiroNome(p.cliente_nome), ret = p.tipo === 'retirada';
    var m = {
      novo: 'Oi, ' + n + '! Recebemos seu pedido ' + p.codigo + ' aqui no Kipaladar.' + (p.total_centavos != null ? ' Total: ' + U.reais(p.total_centavos) + '.' : ''),
      preparo: 'Oi, ' + n + '! Seu pedido ' + p.codigo + ' já está sendo preparado.' + (p.total_centavos != null ? ' Total: ' + U.reais(p.total_centavos) + '.' : ''),
      saiu: ret ? 'Oi, ' + n + '! Seu pedido ' + p.codigo + ' está pronto pra retirar no balcão.' : 'Oi, ' + n + '! Seu pedido ' + p.codigo + ' saiu para entrega e já já chega aí.',
      entregue: 'Oi, ' + n + '! Obrigado pelo pedido. Se puder, deixa sua avaliação no Google pra gente.',
      cancelado: 'Oi, ' + n + '. Sobre o pedido ' + p.codigo + ':'
    };
    return m[p.status] || '';
  }
  function cardPedido(p) {
    var min = minutosDesde(p.criado_em), prox = PROX[p.status];
    if (prox && p.status === 'preparo' && p.tipo === 'retirada') prox = ['saiu', 'Pronto pra retirar'];
    var ativo = ['novo', 'preparo', 'saiu'].indexOf(p.status) >= 0;
    return '<article class="ped s-' + p.status + '" data-ped="' + p.id + '">' +
      '<div class="c1"><span class="cod">' + esc(p.codigo) + '</span><span class="tempo' + (ativo && min > 45 ? ' atrasado' : '') + '">' + hhmm(p.criado_em) + (ativo ? ' · há ' + (min < 60 ? min + ' min' : Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0')) : '') + '</span></div>' +
      '<div class="cli">' + esc(p.cliente_nome) + ' <span class="tag ' + (p.tipo === 'entrega' ? 'tag-ent">Entrega' : 'tag-ret">Retirada') + '</span>' + (p.agendado_para ? ' <span class="tag tag-ag">⏰ ' + esc(p.agendado_para) + '</span>' : '') + '</div>' +
      '<ul>' + p.itens.map(function (i) { return '<li><b>' + i.qtd + 'x</b> ' + esc(i.nome) + (i.obs ? ' <small>(' + esc(i.obs) + ')</small>' : '') + '</li>'; }).join('') + '</ul>' +
      '<div class="meta">' + (p.tipo === 'entrega' ? '<span>📍 ' + esc(p.endereco) + ' — ' + esc(p.bairro) + (p.referencia ? ' · ' + esc(p.referencia) : '') + '</span>' : '') +
      '<span>💳 ' + esc(p.pagamento) + (p.troco_para ? ' · troco p/ ' + U.reais(p.troco_para) : '') + '</span>' + (p.observacao ? '<span>📝 ' + esc(p.observacao) + '</span>' : '') + '</div>' +
      '<div class="tot"><span>Total</span><span>' + totalTxt(p) + (p.status !== 'cancelado' ? ' <button class="btn btn-s btn-mini" data-valor="' + p.id + '" title="Lançar ou corrigir o valor">' + ico('lapis') + '</button>' : '') + '</span></div>' +
      '<div class="acoes">' + (prox ? '<button class="btn ' + (p.status === 'novo' ? 'btn-v' : 'btn-p') + ' btn-grande" data-av="' + p.id + '" data-para="' + prox[0] + '">' + ico('check') + prox[1] + '</button>' : '') +
      '<a class="btn btn-wa btn-mini" target="_blank" rel="noopener" href="' + U.wa(p.cliente_telefone, msgCliente(p)) + '">' + ico('wa', 'cheio') + 'Cliente</a>' +
      '<button class="btn btn-s btn-mini" data-imp="' + p.id + '">' + ico('imp') + 'Imprimir</button>' +
      (ativo ? '<button class="btn btn-s btn-mini" data-canc="' + p.id + '">Cancelar</button>' : '') + '</div></article>';
  }
  function ligarPedidos() {
    $('#main').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var id = b.dataset.av || b.dataset.imp || b.dataset.canc || b.dataset.valor, p = D.pedidos.find(function (x) { return x.id === id; });
      if (b.dataset.av) { p.status = b.dataset.para; BD.atualizarPedido(p.id, { status: p.status }).then(function () { pintar(true); }).catch(erro); }
      else if (b.dataset.canc) { if (confirm('Cancelar o pedido ' + p.codigo + '?')) { p.status = 'cancelado'; BD.atualizarPedido(p.id, { status: 'cancelado' }).then(function () { pintar(true); }).catch(erro); } }
      else if (b.dataset.imp) imprimir(p);
      else if (b.dataset.valor) {
        var v = prompt('Valor total do pedido ' + p.codigo + ' (com entrega), em reais:', p.total_centavos != null ? (p.total_centavos / 100).toFixed(2).replace('.', ',') : '');
        if (v == null) return;
        var c = Math.round(parseFloat(v.replace(/\./g, '').replace(',', '.')) * 100);
        if (!(c >= 0)) { toast('Valor inválido'); return; }
        p.total_centavos = c; BD.atualizarPedido(p.id, { total_centavos: c }).then(function () { pintar(true); toast('Valor lançado'); }).catch(erro);
      }
    };
  }
  function imprimir(p) {
    var linhas = p.itens.map(function (i) { return i.qtd + 'x ' + esc(i.nome) + (i.obs ? '<br>&nbsp;&nbsp;* ' + esc(i.obs) : ''); }).join('<br>');
    $('#comanda').innerHTML = '<h4>KIPALADAR</h4><div style="text-align:center">Pedido ' + esc(p.codigo) + ' · ' + new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</div><hr>' +
      '<b>' + (p.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA') + (p.agendado_para ? ' · ' + esc(p.agendado_para) : '') + '</b><br>' + esc(p.cliente_nome) + '<br>' + U.fone(p.cliente_telefone) +
      (p.tipo === 'entrega' ? '<br>' + esc(p.endereco) + '<br>' + esc(p.bairro) + (p.referencia ? '<br>Ref.: ' + esc(p.referencia) : '') : '') + '<hr>' + linhas + '<hr>' +
      'Pagamento: ' + esc(p.pagamento) + (p.troco_para ? '<br>Troco p/ ' + U.reais(p.troco_para) : '') + '<br><b>Total: ' + totalTxt(p) + '</b>' + (p.observacao ? '<hr>Obs.: ' + esc(p.observacao) : '');
    window.print();
  }

  /* ---------- HOJE ---------- */
  function vHoje() {
    var h = hojeStr(), ph = D.pedidos.filter(function (p) { return dataDe(p.criado_em) === h; });
    var and = ph.filter(function (p) { return ['novo', 'preparo', 'saiu'].indexOf(p.status) >= 0; });
    var novos = ph.filter(function (p) { return p.status === 'novo'; });
    var fat = faturamento(ph);
    var rh = D.reservas.filter(function (r) { return r.data === h && ['pendente', 'confirmada', 'compareceu'].indexOf(r.status) >= 0; }).sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });
    var pessoas = rh.reduce(function (s, r) { return s + (+r.pessoas || 0); }, 0);
    var semPreco = D.itens.filter(function (i) { return i.precos.some(function (p) { return p.centavos == null; }); }).length;
    // últimos 14 dias
    var dias = [];
    for (var i = 13; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var ds = U.hoje(d); dias.push({ ds: ds, n: D.pedidos.filter(function (p) { return p.status !== 'cancelado' && dataDe(p.criado_em) === ds; }).length }); }
    var max = Math.max.apply(null, dias.map(function (x) { return x.n; }).concat([1]));
    // mais pedidos em 30 dias
    var lim = new Date(); lim.setDate(lim.getDate() - 30); var cont = {};
    D.pedidos.forEach(function (p) {
      if (p.status === 'cancelado' || new Date(p.criado_em) < lim) return;
      p.itens.forEach(function (it) {
        [it.id, it.sabor2].forEach(function (id, k) { if (!id) return; var a = D.itens.find(function (x) { return x.id === id; }); var n = a ? a.nome : it.nome; cont[n] = (cont[n] || 0) + (k || it.sabor2 ? it.qtd / 2 : it.qtd); });
      });
    });
    var top = Object.keys(cont).map(function (k) { return [k, cont[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    return (semPreco ? '<div class="aviso-in">⚠️ <span><b>' + semPreco + ' itens do cardápio estão sem preço.</b> Enquanto isso o site mostra "a confirmar" e o total do pedido fica em aberto. <button class="btn btn-s btn-mini" data-aba="cardapio">Preencher preços</button></span></div>' : '') +
      '<div class="kpis">' +
      '<div class="kpi' + (novos.length ? ' alerta' : '') + '"><span>Novos pedidos</span><b>' + novos.length + '</b><small>esperando aceite</small></div>' +
      '<div class="kpi"><span>Pedidos hoje</span><b>' + ph.filter(function (p) { return p.status !== 'cancelado'; }).length + '</b><small>' + and.length + ' em andamento</small></div>' +
      '<div class="kpi"><span>Vendido hoje</span><b>' + (fat.soma ? U.reais(fat.soma).replace('R$ ', 'R$') : '—') + '</b><small>' + (fat.sem ? fat.sem + ' pedido(s) sem valor lançado' : 'pedidos do site') + '</small></div>' +
      '<div class="kpi"><span>Reservas hoje</span><b>' + rh.length + '</b><small>' + pessoas + ' pessoas esperadas</small></div></div>' +
      '<div class="grade tres">' +
      '<section class="card"><h2>' + ico('sacola') + 'Precisam de você <small>' + novos.length + '</small></h2>' + (novos.length ? novos.map(cardPedido).join('') : '<p class="vazio">Nenhum pedido esperando. ✔</p>') +
      (and.length > novos.length ? '<button class="btn btn-s" data-aba="pedidos" style="width:100%">Ver todos em andamento (' + and.length + ')</button>' : '') + '</section>' +
      '<section class="card"><h2>' + ico('cal') + 'Reservas de hoje</h2>' + (rh.length ? '<div>' + rh.map(function (r) {
        return '<div class="linha"><span class="hora">' + r.hora + '</span><div class="t"><b>' + esc(r.nome) + '</b><small>' + r.pessoas + ' pessoas' + (r.ocasiao ? ' · ' + esc(r.ocasiao) : '') + '</small></div><span class="st st-' + r.status + '">' + r.status + '</span></div>';
      }).join('') + '</div>' : '<p class="vazio">Sem reservas pra hoje.</p>') + '</section>' +
      '<section class="card"><h2>Pedidos nos últimos 14 dias</h2><div class="barras">' + dias.map(function (x, i) {
        return '<div' + (i === 13 ? ' class="hj"' : '') + '><em>' + (x.n || '') + '</em><i style="height:' + Math.round(x.n / max * 100) + '%"></i><span>' + (i === 13 ? 'hoje' : x.ds.slice(8)) + '</span></div>';
      }).join('') + '</div><h2 style="margin-top:22px">Mais pedidos · 30 dias</h2><ul class="top5">' + (top.length ? top.map(function (t) { return '<li><span>' + esc(t[0]) + '</span><b>' + (Math.round(t[1] * 10) / 10).toString().replace('.', ',') + '</b></li>'; }).join('') : '<li>Sem pedidos ainda</li>') + '</ul></section></div>';
  }
  var ligar = { hoje: ligarPedidos, pedidos: ligarPedidos };

  /* ---------- PEDIDOS ---------- */
  function vPedidos() {
    var h = hojeStr();
    var col = function (st) { return D.pedidos.filter(function (p) { return p.status === st && (st !== 'entregue' || dataDe(p.criado_em) === h); }).sort(function (a, b) { return a.criado_em < b.criado_em ? (st === 'entregue' ? 1 : -1) : (st === 'entregue' ? -1 : 1); }); };
    var cols = [['novo', 'Novos'], ['preparo', 'Em preparo'], ['saiu', 'Saiu / pronto'], ['entregue', 'Concluídos hoje']];
    var canc = D.pedidos.filter(function (p) { return p.status === 'cancelado' && dataDe(p.criado_em) === h; }).length;
    return '<div class="sec-tit"><h2>Pedidos de hoje</h2><span style="color:var(--suave);font-weight:600">' + (canc ? canc + ' cancelado(s) hoje · ' : '') + 'Atualiza sozinho e apita quando chega pedido</span></div>' +
      '<div class="kanban">' + cols.map(function (c) {
        var l = col(c[0]);
        return '<section class="col"><h3>' + c[1] + '<span>' + l.length + '</span></h3>' + (l.length ? l.map(cardPedido).join('') : '<p class="vazio" style="padding:10px">—</p>') + '</section>';
      }).join('') + '</div>';
  }

  /* ---------- RESERVAS ---------- */
  var resFiltro = 'proximas';
  function vReservas() {
    var h = hojeStr(), lista;
    if (resFiltro === 'proximas') lista = D.reservas.filter(function (r) { return r.data >= h && ['cancelada'].indexOf(r.status) < 0; });
    else lista = D.reservas.filter(function (r) { return r.data < h; }).slice(-60);
    lista.sort(function (a, b) { return (a.data + a.hora) < (b.data + b.hora) ? -1 : 1; });
    if (resFiltro === 'passadas') lista.reverse();
    var grupos = {}; lista.forEach(function (r) { (grupos[r.data] = grupos[r.data] || []).push(r); });
    return '<div class="sec-tit"><h2>Reservas</h2><div style="display:flex;gap:10px;flex-wrap:wrap"><div class="seg" id="res-f"><button data-f="proximas"' + (resFiltro === 'proximas' ? ' class="on"' : '') + '>Próximas</button><button data-f="passadas"' + (resFiltro === 'passadas' ? ' class="on"' : '') + '>Passadas</button></div>' +
      '<button class="btn btn-p" id="nova-res">' + ico('mais') + 'Reserva por telefone</button></div></div>' +
      (Object.keys(grupos).length ? Object.keys(grupos).map(function (d) {
        var rs = grupos[d], pes = rs.reduce(function (s, r) { return s + (r.status !== 'cancelada' ? +r.pessoas : 0); }, 0);
        return '<section class="card" style="margin-bottom:14px"><h2>' + diaNome(d) + ' <small>' + rs.length + ' reserva(s) · ' + pes + ' pessoas</small></h2>' + rs.map(function (r) {
          var msg = 'Oi, ' + primeiroNome(r.nome) + '! Sua reserva no Kipaladar está confirmada: ' + dataBR(r.data) + ' às ' + r.hora + ', ' + r.pessoas + ' pessoas. Te esperamos!';
          return '<div class="linha" style="flex-wrap:wrap"><span class="hora">' + r.hora + '</span><div class="t"><b>' + esc(r.nome) + '</b> <span class="st st-' + r.status + '">' + r.status + '</span><small>' + r.pessoas + ' pessoas' + (r.ocasiao ? ' · ' + esc(r.ocasiao) : '') + ' · ' + U.fone(r.telefone) + (r.observacao ? ' · ' + esc(r.observacao) : '') + '</small></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            (r.status === 'pendente' ? '<a class="btn btn-ok btn-mini" data-rs="' + r.id + '" data-para="confirmada" target="_blank" rel="noopener" href="' + U.wa(r.telefone, msg) + '">' + ico('check') + 'Confirmar</a>' : '<a class="btn btn-wa btn-mini" target="_blank" rel="noopener" href="' + U.wa(r.telefone, 'Oi, ' + primeiroNome(r.nome) + '! Aqui é do Kipaladar, sobre sua reserva de ' + dataBR(r.data) + ' às ' + r.hora + '.') + '">' + ico('wa', 'cheio') + '</a>') +
            (r.data <= h && ['pendente', 'confirmada'].indexOf(r.status) >= 0 ? '<button class="btn btn-s btn-mini" data-rs="' + r.id + '" data-para="compareceu">Chegou</button><button class="btn btn-s btn-mini" data-rs="' + r.id + '" data-para="faltou">Faltou</button>' : '') +
            (['pendente', 'confirmada'].indexOf(r.status) >= 0 ? '<button class="btn btn-s btn-mini" data-rs="' + r.id + '" data-para="cancelada">Cancelar</button>' : '') + '</div></div>';
        }).join('') + '</section>';
      }).join('') : '<p class="card vazio">Nenhuma reserva aqui.</p>');
  }
  ligar.reservas = function () {
    $('#res-f').onclick = function (e) { var b = e.target.closest('[data-f]'); if (b) { resFiltro = b.dataset.f; pintar(); } };
    $('#main').onclick = function (e) {
      var b = e.target.closest('[data-rs]'); if (!b) return;
      var r = D.reservas.find(function (x) { return x.id === b.dataset.rs; });
      if (b.dataset.para === 'cancelada' && !confirm('Cancelar a reserva de ' + r.nome + '?')) { e.preventDefault(); return; }
      r.status = b.dataset.para; BD.atualizarReserva(r.id, { status: r.status }).then(function () { pintar(true); }).catch(erro);
    };
    $('#nova-res').onclick = function () {
      var dlg = $('#dlg');
      dlg.innerHTML = '<form id="f-nr"><div class="dlg-c"><h3>Reserva por telefone</h3><div class="campos">' +
        '<div><label>Dia</label><input type="date" id="nr-d" value="' + hojeStr() + '" required></div><div><label>Horário</label><input type="time" id="nr-h" value="19:30" step="1800" required></div>' +
        '<div><label>Pessoas</label><input type="number" id="nr-p" min="1" max="200" value="4" required></div><div><label>Ocasião</label><input id="nr-o" placeholder="Aniversário…"></div>' +
        '<div class="cheio"><label>Nome</label><input id="nr-n" required></div><div class="cheio"><label>Telefone</label><input id="nr-t" type="tel" required></div>' +
        '<div class="cheio"><label>Observação</label><input id="nr-obs"></div></div></div>' +
        '<div class="dlg-r"><button type="button" class="btn btn-s" id="nr-x">Cancelar</button><button class="btn btn-p">Salvar reserva</button></div></form>';
      dlg.showModal();
      $('#nr-x').onclick = function () { dlg.close(); };
      $('#f-nr').onsubmit = function (e) {
        e.preventDefault();
        var r = { data: $('#nr-d').value, hora: $('#nr-h').value, pessoas: +$('#nr-p').value, ocasiao: $('#nr-o').value, nome: $('#nr-n').value.trim(), telefone: U.digitos($('#nr-t').value), observacao: $('#nr-obs').value };
        BD.reservaBalcao(r).then(function () { dlg.close(); return carregar(); }).then(function () { pintar(); toast('Reserva salva'); }).catch(erro);
      };
    };
  };

  /* ---------- CARDÁPIO ---------- */
  function vCardapio() {
    var sem = D.itens.filter(function (i) { return i.precos.some(function (p) { return p.centavos == null; }); }).length;
    var cats = T.categorias.slice();
    D.itens.forEach(function (i) { if (!cats.some(function (c) { return c.id === i.categoria; })) cats.push({ id: i.categoria, nome: i.categoria }); });
    return '<div class="sec-tit"><h2>Cardápio</h2><button class="btn btn-p" id="novo-item">' + ico('mais') + 'Novo item</button></div>' +
      (sem ? '<div class="aviso-in">⚠️ <span><b>' + sem + ' itens sem preço</b> (em amarelo). Digite o valor e ele já aparece no site. ★ = destaque "Mais pedido".</span></div>' : '<div class="aviso-in" style="background:var(--verde-cl);border-color:#A9DDBC;color:var(--verde)">✔ Todos os itens têm preço. Mudou aqui, mudou no site na hora.</div>') +
      cats.map(function (c) {
        var its = D.itens.filter(function (i) { return i.categoria === c.id; }).sort(function (a, b) { return a.ordem - b.ordem; });
        if (!its.length) return '';
        return '<section class="cat"><h3>' + esc(c.nome) + '</h3>' + its.map(function (it) {
          return '<div class="it' + (it.disponivel === false ? ' off' : '') + '" data-it="' + esc(it.id) + '"><div class="it-top">' + (it.foto ? '<img src="' + esc(it.foto) + '" alt="">' : '<img src="fotos/icone.png" alt="">') +
            '<div class="t"><span class="it-nome">' + esc(it.nome) + '</span><small>' + esc(it.descricao || '') + '</small></div></div>' +
            '<div class="precos">' + it.precos.map(function (p, k) {
              return '<label>' + esc(p.rotulo) + '<span class="rs"><input inputmode="decimal" data-preco="' + k + '" class="' + (p.centavos == null ? 'falta' : '') + '" value="' + (p.centavos == null ? '' : (p.centavos / 100).toFixed(2).replace('.', ',')) + '" placeholder="0,00" aria-label="Preço ' + esc(it.nome) + ' ' + esc(p.rotulo) + '"></span></label>';
            }).join('') + '</div>' +
            '<div class="it-acoes"><label class="chave" title="Disponível no site"><input type="checkbox" data-disp' + (it.disponivel !== false ? ' checked' : '') + '><i></i>' + (it.disponivel !== false ? 'Tem' : 'Esgotado') + '</label>' +
            '<button class="estrela' + (it.destaque ? ' on' : '') + '" data-dest title="Destaque">' + ico('estrela', 'cheio') + '</button>' +
            '<button class="btn btn-s btn-mini" data-edit title="Editar">' + ico('lapis') + '</button></div></div>';
        }).join('') + '</section>';
      }).join('');
  }
  ligar.cardapio = function () {
    var item = function (el) { var id = el.closest('[data-it]').dataset.it; return D.itens.find(function (i) { return i.id === id; }); };
    $('#main').onchange = function (e) {
      var el = e.target, it;
      if (el.dataset.preco != null) {
        it = item(el); var v = el.value.trim();
        var c = v === '' ? null : Math.round(parseFloat(v.replace(/\./g, '').replace(',', '.')) * 100);
        if (v !== '' && !(c >= 0)) { toast('Preço inválido'); return; }
        it.precos[+el.dataset.preco].centavos = c;
        el.classList.toggle('falta', c == null);
        if (c != null) el.value = (c / 100).toFixed(2).replace('.', ',');
        BD.salvarItem(it).then(function () { toast('Preço salvo · ' + it.nome); }).catch(erro);
      } else if (el.hasAttribute('data-disp')) {
        it = item(el); it.disponivel = el.checked;
        BD.salvarItem(it).then(function () { pintar(true); toast(it.nome + (it.disponivel ? ' voltou pro site' : ' marcado como esgotado')); }).catch(erro);
      }
    };
    $('#main').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'novo-item') return editarItem(null);
      if (b.hasAttribute('data-dest')) { var it = item(b); it.destaque = !it.destaque; BD.salvarItem(it).then(function () { pintar(true); }).catch(erro); }
      if (b.hasAttribute('data-edit')) editarItem(item(b));
    };
    $('#main').onkeydown = function (e) { if (e.key === 'Enter' && e.target.dataset.preco != null) e.target.blur(); };
  };
  function editarItem(it) {
    var novo = !it; it = it ? JSON.parse(JSON.stringify(it)) : { id: '', categoria: 'pratos', nome: '', descricao: '', precos: [{ rotulo: 'Unidade', centavos: 2500 }], foto: '', destaque: false, meia: false, acomp: true, disponivel: true, ordem: 999 };
    var dlg = $('#dlg');
    dlg.innerHTML = '<form id="f-it"><div class="dlg-c"><h3>' + (novo ? 'Novo item' : 'Editar item') + '</h3><div class="campos">' +
      '<div class="cheio"><label>Nome</label><input id="e-nome" value="' + esc(it.nome) + '" required></div>' +
      '<div class="cheio"><label>Descrição</label><textarea id="e-desc">' + esc(it.descricao || '') + '</textarea></div>' +
      '<div><label>Categoria</label><select id="e-cat">' + T.categorias.map(function (c) { return '<option value="' + c.id + '"' + (c.id === it.categoria ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Tamanhos</label><input id="e-tam" value="' + esc(it.precos.map(function (p) { return p.rotulo; }).join(', ')) + '" placeholder="Média, Grande, Família"></div>' +
      '<div class="cheio"><label>Foto (endereço da imagem)</label><input id="e-foto" value="' + esc(it.foto || '') + '" placeholder="fotos/prato.jpg"></div>' +
      '<div class="cheio"><label class="chave"><input type="checkbox" id="e-meia"' + (it.meia ? ' checked' : '') + '><i></i>Aceita meio a meio</label></div></div>' +
      '<p style="color:var(--suave);font-size:15px">Os preços de cada tamanho você digita direto na lista.</p></div>' +
      '<div class="dlg-r">' + (novo ? '' : '<button type="button" class="btn btn-s" id="e-del" style="margin-right:auto;color:var(--verm)">' + ico('lixo') + 'Excluir</button>') +
      '<button type="button" class="btn btn-s" id="e-x">Cancelar</button><button class="btn btn-p">Salvar</button></div></form>';
    dlg.showModal();
    $('#e-x').onclick = function () { dlg.close(); };
    if ($('#e-del')) $('#e-del').onclick = function () {
      if (!confirm('Excluir "' + it.nome + '" do cardápio?')) return;
      BD.excluirItem(it.id).then(function () { dlg.close(); return carregar(); }).then(function () { pintar(); toast('Item excluído'); }).catch(erro);
    };
    $('#f-it').onsubmit = function (e) {
      e.preventDefault();
      var tams = $('#e-tam').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!tams.length) tams = ['Unidade'];
      it.nome = $('#e-nome').value.trim(); it.descricao = $('#e-desc').value.trim(); it.categoria = $('#e-cat').value; it.foto = $('#e-foto').value.trim(); it.meia = $('#e-meia').checked;
      it.precos = tams.map(function (t) { var a = it.precos.find(function (p) { return p.rotulo.toLowerCase() === t.toLowerCase(); }); return { rotulo: t, centavos: a ? a.centavos : null }; });
      if (!it.id) delete it.id;
      BD.salvarItem(it).then(function () { dlg.close(); return carregar(); }).then(function () { pintar(); toast('Salvo'); }).catch(erro);
    };
  }

  /* ---------- CLIENTES ---------- */
  var cliFiltro = 'reativar';
  function baseClientes() {
    var m = {};
    D.pedidos.forEach(function (p) {
      if (p.status === 'cancelado') return;
      var k = U.digitos(p.cliente_telefone), c = m[k] = m[k] || { nome: p.cliente_nome, tel: k, pedidos: 0, gasto: 0, ultimo: null, bairro: '', reservas: 0 };
      c.pedidos++; if (p.total_centavos != null) c.gasto += p.total_centavos;
      if (!c.ultimo || p.criado_em > c.ultimo) { c.ultimo = p.criado_em; c.nome = p.cliente_nome; c.bairro = p.bairro || c.bairro; }
    });
    D.reservas.forEach(function (r) {
      var k = U.digitos(r.telefone), c = m[k] = m[k] || { nome: r.nome, tel: k, pedidos: 0, gasto: 0, ultimo: null, bairro: '', reservas: 0 };
      c.reservas++; var iso = r.data + 'T' + r.hora; if (r.status !== 'cancelada' && r.data <= hojeStr() && (!c.ultimo || iso > c.ultimo)) c.ultimo = iso;
    });
    return Object.keys(m).map(function (k) { var c = m[k]; c.dias = c.ultimo ? Math.floor((Date.now() - new Date(c.ultimo)) / 86400000) : null; return c; });
  }
  function vClientes() {
    var base = baseClientes(), lista;
    var reat = base.filter(function (c) { return c.dias != null && c.dias >= 30 && (c.pedidos + c.reservas) >= 2; });
    if (cliFiltro === 'reativar') lista = reat.sort(function (a, b) { return (b.pedidos + b.reservas) - (a.pedidos + a.reservas); });
    else if (cliFiltro === 'fieis') lista = base.slice().sort(function (a, b) { return (b.pedidos + b.reservas) - (a.pedidos + a.reservas); }).slice(0, 30);
    else lista = base.slice().sort(function (a, b) { return (b.ultimo || '') < (a.ultimo || '') ? -1 : 1; });
    return '<div class="sec-tit"><h2>Clientes</h2><button class="btn btn-s" id="csv">' + ico('baixar') + 'Baixar lista</button></div>' +
      '<div class="aviso-in" style="background:var(--azul-cl);border-color:#C4D1F0;color:var(--azul)">📣 <span><b>' + base.length + ' clientes</b> na sua base, montada sozinha a cada pedido e reserva. <b>' + reat.length + '</b> pediram mais de uma vez e sumiram há 30 dias ou mais: um "oi" no WhatsApp traz muita gente de volta.</span></div>' +
      '<div class="filtros"><div class="seg" id="cli-f"><button data-f="reativar"' + (cliFiltro === 'reativar' ? ' class="on"' : '') + '>Pra chamar de volta (' + reat.length + ')</button><button data-f="fieis"' + (cliFiltro === 'fieis' ? ' class="on"' : '') + '>Mais fiéis</button><button data-f="todos"' + (cliFiltro === 'todos' ? ' class="on"' : '') + '>Todos</button></div></div>' +
      '<div class="card rolar"><table class="tabela"><thead><tr><th>Cliente</th><th>Pedidos</th><th>Reservas</th><th>Gasto</th><th>Última vez</th><th></th></tr></thead><tbody>' +
      (lista.length ? lista.map(function (c) {
        var msg = 'Oi, ' + primeiroNome(c.nome) + '! Aqui é do Kipaladar. Faz tempo que você não aparece por aqui! O prato comercial de hoje tá saindo quentinho. Quer que eu já separe o seu?';
        return '<tr><td><b>' + esc(c.nome) + '</b><br><small style="color:var(--suave)">' + U.fone(c.tel) + (c.bairro ? ' · ' + esc(c.bairro) : '') + '</small></td><td>' + c.pedidos + '</td><td>' + c.reservas + '</td><td>' + (c.gasto ? U.reais(c.gasto) : '—') + '</td>' +
          '<td>' + (c.dias == null ? '—' : c.dias === 0 ? 'hoje' : 'há ' + c.dias + ' dia' + (c.dias > 1 ? 's' : '')) + (c.dias >= 30 ? ' <span class="st st-novo">sumiu</span>' : '') + '</td>' +
          '<td><a class="btn btn-wa btn-mini" target="_blank" rel="noopener" href="' + U.wa(c.tel, msg) + '">' + ico('wa', 'cheio') + 'Chamar</a></td></tr>';
      }).join('') : '<tr><td colspan="6" class="vazio">Ninguém aqui por enquanto.</td></tr>') + '</tbody></table></div>';
  }
  ligar.clientes = function () {
    $('#cli-f').onclick = function (e) { var b = e.target.closest('[data-f]'); if (b) { cliFiltro = b.dataset.f; pintar(); } };
    $('#csv').onclick = function () {
      var linhas = [['nome', 'telefone', 'bairro', 'pedidos', 'reservas', 'gasto', 'ultima_vez']].concat(baseClientes().map(function (c) { return [c.nome, c.tel, c.bairro, c.pedidos, c.reservas, (c.gasto / 100).toFixed(2), c.ultimo ? c.ultimo.slice(0, 10) : '']; }));
      var csv = linhas.map(function (l) { return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'clientes-kipaladar.csv'; a.click();
    };
  };

  /* ---------- CONFIGURAÇÕES ---------- */
  function vConfig() {
    var c = D.cfg, a = c.aviso || {}, nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return '<div class="sec-tit"><h2>Configurações</h2></div><div class="grade duas">' +
      '<section class="card"><h2>Loja agora</h2>' +
      '<label class="chave" style="margin-bottom:16px"><input type="checkbox" id="c-aceita"' + (c.aceitando_pedidos !== false ? ' checked' : '') + '><i></i>Recebendo pedidos pelo site</label>' +
      '<label>Aberto / fechado</label><div class="seg" id="c-status">' + [['auto', 'Pelo horário'], ['aberto', 'Forçar aberto'], ['fechado', 'Forçar fechado']].map(function (o) { return '<button data-v="' + o[0] + '"' + ((c.status_manual || 'auto') === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>' +
      '<p style="color:var(--suave);font-size:15px">Use "Forçar fechado" em feriado ou imprevisto. Volte pra "Pelo horário" depois.</p>' +
      '<div class="campos" style="margin-top:8px"><div><label>Tempo de entrega</label><input id="c-tempo" value="' + esc(c.tempo_entrega || '') + '" placeholder="40 a 60 min"></div>' +
      '<div><label>Pedido mínimo (R$)</label><input id="c-min" inputmode="decimal" value="' + (c.pedido_minimo_centavos ? (c.pedido_minimo_centavos / 100).toFixed(2).replace('.', ',') : '') + '" placeholder="sem mínimo"></div></div></section>' +
      '<section class="card"><h2>Aviso no topo do site</h2><label class="chave" style="margin-bottom:14px"><input type="checkbox" id="a-on"' + (a.ativo ? ' checked' : '') + '><i></i>Mostrar aviso</label>' +
      '<div style="display:grid;gap:12px"><div><label>Título</label><input id="a-t" value="' + esc(a.titulo || '') + '" placeholder="Sexta da Comida Baiana"></div><div><label>Texto</label><textarea id="a-x">' + esc(a.texto || '') + '</textarea></div></div>' +
      '<p style="color:var(--suave);font-size:15px">Bom pra promoção do dia, sorteio, feriado ou prato especial.</p></section>' +
      '<section class="card"><h2>Horário de funcionamento</h2>' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        var h = D.horarios[d] || { aberto: false, abre: '11:00', fecha: '22:00' };
        return '<div class="hor-l" data-dia="' + d + '"><b>' + nomes[d] + '</b><label class="chave"><input type="checkbox" data-h="aberto"' + (h.aberto ? ' checked' : '') + '><i></i></label><input type="time" data-h="abre" value="' + h.abre + '"><input type="time" data-h="fecha" value="' + h.fecha + '"></div>';
      }).join('') + '<button class="btn btn-p" id="salvar-h" style="margin-top:14px">Salvar horário</button></section>' +
      '<section class="card"><h2>Bairros e taxa de entrega</h2><p style="color:var(--suave);font-size:15px;margin-top:0">Taxa em branco = "a combinar" no site.</p><div id="bairros">' + D.bairros.map(linhaBairro).join('') + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-s" id="add-b">' + ico('mais') + 'Bairro</button><button class="btn btn-p" id="salvar-b">Salvar bairros</button></div></section></div>';
  }
  function linhaBairro(b) {
    return '<div class="bai-l" data-b="' + esc(b.id || '') + '"><input data-k="nome" value="' + esc(b.nome) + '" aria-label="Bairro"><span class="rs" style="position:relative"><input data-k="taxa" inputmode="decimal" placeholder="a combinar" value="' + (b.taxa_centavos != null ? (b.taxa_centavos / 100).toFixed(2).replace('.', ',') : '') + '" aria-label="Taxa"></span>' +
      '<label class="chave" title="Atende"><input type="checkbox" data-k="ativo"' + (b.ativo !== false ? ' checked' : '') + '><i></i></label></div>';
  }
  ligar.config = function () {
    function salvarCfg(msg) { return BD.salvarConfig(D.cfg).then(function () { pintar(true); toast(msg || 'Salvo'); }).catch(erro); }
    $('#c-aceita').onchange = function () { D.cfg.aceitando_pedidos = this.checked; salvarCfg(this.checked ? 'Pedidos pelo site ligados' : 'Pedidos pelo site pausados'); };
    $('#c-status').onclick = function (e) { var b = e.target.closest('[data-v]'); if (b) { D.cfg.status_manual = b.dataset.v; salvarCfg(); } };
    $('#c-tempo').onchange = function () { D.cfg.tempo_entrega = this.value.trim(); salvarCfg(); };
    $('#c-min').onchange = function () { var v = this.value.trim(); D.cfg.pedido_minimo_centavos = v ? Math.round(parseFloat(v.replace(',', '.')) * 100) || null : null; salvarCfg(); };
    ['#a-on', '#a-t', '#a-x'].forEach(function (s) { $(s).onchange = function () { D.cfg.aviso = { ativo: $('#a-on').checked, titulo: $('#a-t').value.trim(), texto: $('#a-x').value.trim() }; salvarCfg('Aviso atualizado'); }; });
    $('#salvar-h').onclick = function () {
      var h = {};
      document.querySelectorAll('.hor-l').forEach(function (l) { h[l.dataset.dia] = { aberto: l.querySelector('[data-h=aberto]').checked, abre: l.querySelector('[data-h=abre]').value, fecha: l.querySelector('[data-h=fecha]').value }; });
      D.horarios = h; BD.salvarHorarios(h).then(function () { pintar(true); toast('Horário salvo'); }).catch(erro);
    };
    $('#add-b').onclick = function () { $('#bairros').insertAdjacentHTML('beforeend', linhaBairro({ id: '', nome: '', taxa_centavos: null, ativo: true })); $('#bairros').lastElementChild.querySelector('input').focus(); };
    $('#salvar-b').onclick = function () {
      var lista = [];
      document.querySelectorAll('.bai-l').forEach(function (l, i) {
        var nome = l.querySelector('[data-k=nome]').value.trim(); if (!nome) return;
        var t = l.querySelector('[data-k=taxa]').value.trim();
        lista.push({ id: l.dataset.b || 'b' + Date.now() + i, nome: nome, taxa_centavos: t ? Math.round(parseFloat(t.replace(',', '.')) * 100) : null, ativo: l.querySelector('[data-k=ativo]').checked });
      });
      BD.salvarBairros(lista).then(function () { return carregar(); }).then(function () { pintar(true); toast('Bairros salvos'); }).catch(erro);
    };
  };
})();
