/* =====================================================================
   Kipaladar — camada de dados
   Mesma interface nos dois modos:
     - demonstração: localStorage (dados só neste navegador)
     - no ar: Supabase (tabelas + funções do db/schema.sql)
   Site e painel só falam com window.BD, nunca direto com o banco.
   ===================================================================== */

window.BD = (function () {
  var T = window.BN, demo = T.modoDemo;
  var SEED = 'k1';

  /* ---------- utilidades comuns ---------- */
  var U = {
    reais: function (c) {
      if (c == null) return 'a confirmar';
      return 'R$ ' + (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },
    digitos: function (s) { return String(s || '').replace(/\D/g, ''); },
    fone: function (s) {
      var d = U.digitos(s).replace(/^55(?=\d{10,11}$)/, '');
      if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
      if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return s || '';
    },
    wa: function (fone, texto) {
      var d = U.digitos(fone); if (d.length <= 11) d = '55' + d;
      return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
    },
    hoje: function (d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    codigo: function () {
      var a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = 'KP';
      for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
      return s;
    },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    min: function (hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; },

    /* Preço de uma linha do carrinho: meio a meio cobra o sabor mais caro.
       Qualquer sabor sem preço deixa a linha "a confirmar" (null). */
    precoLinha: function (itens, linha) {
      var a = itens.find(function (i) { return i.id === linha.id; });
      if (!a) return null;
      var pa = (a.precos.find(function (p) { return p.rotulo === linha.tamanho; }) || {}).centavos;
      if (pa == null) return null;
      if (linha.sabor2) {
        var b = itens.find(function (i) { return i.id === linha.sabor2; });
        var pb = b && (b.precos.find(function (p) { return p.rotulo === linha.tamanho; }) || {}).centavos;
        if (pb == null) return null;
        pa = Math.max(pa, pb);
      }
      return pa;
    },

    /* Aberto agora? Respeita o botão manual do painel. */
    status: function (horarios, cfg, agora) {
      agora = agora || new Date();
      if (cfg && cfg.status_manual === 'aberto') return { aberto: true, texto: 'Aberto agora' };
      if (cfg && cfg.status_manual === 'fechado') return { aberto: false, texto: 'Fechado no momento' };
      var h = horarios[agora.getDay()], m = agora.getHours() * 60 + agora.getMinutes();
      if (h && h.aberto && m >= U.min(h.abre) && m < U.min(h.fecha)) return { aberto: true, texto: 'Aberto agora · fecha às ' + h.fecha.replace(':00', 'h') };
      for (var i = 0; i < 8; i++) {
        var d = new Date(agora); d.setDate(d.getDate() + i);
        var hd = horarios[d.getDay()];
        if (!hd || !hd.aberto) continue;
        if (i === 0 && m >= U.min(hd.abre)) continue;
        var quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
        return { aberto: false, texto: 'Fechado · abre ' + quando + ' às ' + hd.abre.replace(':00', 'h') };
      }
      return { aberto: false, texto: 'Fechado no momento' };
    }
  };

  /* ---------- modo demonstração ---------- */
  var K = function (k) { return 'kip_' + k; };
  function ler(k, def) { try { var v = localStorage.getItem(K(k)); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function gravar(k, v) { try { localStorage.setItem(K(k), JSON.stringify(v)); } catch (e) {} }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  function semear() {
    if (ler('seed') === SEED) return;
    gravar('cardapio', copia(T.cardapioDemo));
    gravar('bairros', copia(T.bairrosDemo));
    gravar('config', copia(T.configDemo));
    gravar('horarios', copia(T.horarios));
    var ped = [], res = [];
    var nomes = ['Marcos', 'Jéssica', 'Rafael', 'Tainá', 'Edson', 'Luana', 'Carlos', 'Patrícia', 'Diego', 'Fernanda', 'Jorge', 'Camila', 'André', 'Vanessa', 'Wellington', 'Bruna'];
    var fones = nomes.map(function (_, i) { return '7198' + String(1000000 + i * 73519).slice(0, 7); });
    var bairros = T.bairrosDemo.map(function (b) { return b.nome; });
    var cardapio = T.cardapioDemo, pratos = cardapio.filter(function (i) { return i.categoria === 'pratos'; });
    var r = (function (s) { return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })(42);
    var pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var agora = new Date();
    // Clientes 0-3 são fiéis e somem há mais de 30 dias (aparecem em "reativar").
    for (var dia = 45; dia >= 0; dia--) {
      var n = dia === 0 ? 7 : 1 + Math.floor(r() * 4);
      for (var j = 0; j < n; j++) {
        var ci = dia > 32 ? (dia + j) % 4 : 4 + Math.floor(r() * (nomes.length - 4));
        var d = new Date(agora); d.setDate(d.getDate() - dia);
        d.setHours(dia === 0 ? Math.max(11, Math.min(agora.getHours(), 14) - Math.floor(r() * 2)) : 11 + Math.floor(r() * 3), Math.floor(r() * 60), 0, 0);
        if (d > agora) d = new Date(agora.getTime() - (j + 1) * 7 * 60000);
        var s1 = pick(pratos), q1 = r() < .3 ? 2 : 1;
        var itens = [{ id: s1.id, nome: s1.nome + ' (arroz, feijão, macarrão, salada)', tamanho: 'Unidade', sabor2: null, qtd: q1, unit: 2500, obs: '' }];
        if (r() < .5) itens.push({ id: 'refri-lata', nome: 'Refrigerante lata', tamanho: 'Unidade', sabor2: null, qtd: 1, unit: 600, obs: '' });
        var ent = r() < .75;
        var st = dia > 0 ? (r() < .06 ? 'cancelado' : 'entregue') : ['novo', 'novo', 'preparo', 'preparo', 'saiu', 'entregue', 'entregue'][j] || 'entregue';
        ped.push({
          id: 'p' + dia + '-' + j, codigo: U.codigo(), criado_em: d.toISOString(), status: st,
          cliente_nome: nomes[ci] + ' (exemplo)', cliente_telefone: fones[ci],
          tipo: ent ? 'entrega' : 'retirada', endereco: ent ? 'Rua ' + pick(['A', 'B', 'da Paz', 'São Jorge', 'do Sossego']) + ', ' + (10 + Math.floor(r() * 300)) : '',
          bairro: ent ? pick(bairros) : '', referencia: '', pagamento: pick(['Pix', 'Cartão na entrega', 'Dinheiro']), troco_para: null,
          observacao: '', agendado_para: r() < .3 ? pick(['12:00', '12:30', '13:00']) : '', itens: itens, subtotal_centavos: itens.reduce(function (t, i) { return t + i.unit * i.qtd; }, 0), taxa_centavos: ent ? 300 : 0, total_centavos: itens.reduce(function (t, i) { return t + i.unit * i.qtd; }, 0) + (ent ? 300 : 0)
        });
      }
      if (r() < .45 || dia <= 1) {
        var rd = new Date(agora); rd.setDate(rd.getDate() - dia);
        var ri = 4 + Math.floor(r() * (nomes.length - 4));
        res.push({ id: 'r' + dia, codigo: U.codigo(), data: U.hoje(rd), hora: pick(['11:30', '12:00', '12:30', '13:00']), pessoas: 2 + Math.floor(r() * 8),
          nome: nomes[ri] + ' (exemplo)', telefone: fones[ri], ocasiao: pick(['Almoço da firma', 'Aniversário', 'Almoço em família', '']), observacao: '',
          status: dia > 0 ? (r() < .15 ? 'faltou' : 'compareceu') : 'pendente', criado_em: new Date(rd.getTime() - 86400000 * 2).toISOString() });
      }
    }
    for (var f = 1; f <= 6; f++) {
      var fd = new Date(agora); fd.setDate(fd.getDate() + f);
      var fi = 4 + Math.floor(r() * (nomes.length - 4));
      if (r() < .6) res.push({ id: 'rf' + f, codigo: U.codigo(), data: U.hoje(fd), hora: pick(['11:30', '12:00', '12:30', '13:00']), pessoas: 4 + Math.floor(r() * 10),
        nome: nomes[fi] + ' (exemplo)', telefone: fones[fi], ocasiao: pick(['Aniversário', 'Almoço da firma', 'Almoço em família']), observacao: '',
        status: r() < .5 ? 'confirmada' : 'pendente', criado_em: agora.toISOString() });
    }
    gravar('pedidos', ped); gravar('reservas', res);
    gravar('seed', SEED);
  }

  function avisarMudanca() { try { localStorage.setItem(K('ping'), String(Date.now())); } catch (e) {} }

  var Demo = {
    cardapio: function () { semear(); return Promise.resolve(ler('cardapio', [])); },
    bairros: function () { semear(); return Promise.resolve(ler('bairros', [])); },
    config: function () { semear(); return Promise.resolve(ler('config', {})); },
    horarios: function () { semear(); return Promise.resolve(ler('horarios', T.horarios)); },

    criarPedido: function (p) {
      semear();
      var itens = ler('cardapio', []), bairros = ler('bairros', []), cfg = ler('config', {});
      if (cfg.aceitando_pedidos === false) return Promise.reject(new Error('A casa pausou os pedidos pelo site agora. Chame no WhatsApp.'));
      p.itens.forEach(function (l) { l.unit = U.precoLinha(itens, l); });
      var semPreco = p.itens.some(function (l) { return l.unit == null; });
      var sub = semPreco ? null : p.itens.reduce(function (s, l) { return s + l.unit * l.qtd; }, 0);
      var b = bairros.find(function (x) { return x.nome === p.bairro; });
      var taxa = p.tipo === 'retirada' ? 0 : (b ? b.taxa_centavos : null);
      var ped = Object.assign({}, p, { id: 'p' + Date.now(), codigo: U.codigo(), criado_em: new Date().toISOString(), status: 'novo',
        subtotal_centavos: sub, taxa_centavos: taxa, total_centavos: sub != null && taxa != null ? sub + taxa : null });
      var todos = ler('pedidos', []); todos.push(ped); gravar('pedidos', todos); avisarMudanca();
      return Promise.resolve(ped);
    },
    consultarPedido: function (codigo) {
      var p = ler('pedidos', []).find(function (x) { return x.codigo === codigo; });
      return Promise.resolve(p || null);
    },
    criarReserva: function (r) {
      semear();
      var res = Object.assign({}, r, { id: 'r' + Date.now(), codigo: U.codigo(), status: 'pendente', criado_em: new Date().toISOString() });
      var todos = ler('reservas', []); todos.push(res); gravar('reservas', todos); avisarMudanca();
      return Promise.resolve(res);
    },

    /* painel */
    entrar: function () { return Promise.resolve(true); },
    sessao: function () { return Promise.resolve(true); },
    sair: function () { return Promise.resolve(); },
    pedidos: function () { semear(); return Promise.resolve(ler('pedidos', [])); },
    reservas: function () { semear(); return Promise.resolve(ler('reservas', [])); },
    atualizarPedido: function (id, campos) { var t = ler('pedidos', []); t.forEach(function (p) { if (p.id === id) Object.assign(p, campos); }); gravar('pedidos', t); return Promise.resolve(); },
    atualizarReserva: function (id, campos) { var t = ler('reservas', []); t.forEach(function (p) { if (p.id === id) Object.assign(p, campos); }); gravar('reservas', t); return Promise.resolve(); },
    reservaBalcao: function (r) { var t = ler('reservas', []); t.push(Object.assign({ id: 'r' + Date.now(), codigo: U.codigo(), status: 'confirmada', criado_em: new Date().toISOString() }, r)); gravar('reservas', t); return Promise.resolve(); },
    salvarItem: function (it) {
      var t = ler('cardapio', []), i = t.findIndex(function (x) { return x.id === it.id; });
      if (!it.id) { it.id = 'i' + Date.now(); it.ordem = t.length; }
      if (i >= 0) t[i] = it; else t.push(it);
      gravar('cardapio', t); avisarMudanca(); return Promise.resolve(it);
    },
    excluirItem: function (id) { gravar('cardapio', ler('cardapio', []).filter(function (x) { return x.id !== id; })); avisarMudanca(); return Promise.resolve(); },
    salvarConfig: function (c) { gravar('config', c); avisarMudanca(); return Promise.resolve(); },
    salvarHorarios: function (h) { gravar('horarios', h); avisarMudanca(); return Promise.resolve(); },
    salvarBairros: function (b) { gravar('bairros', b); avisarMudanca(); return Promise.resolve(); },
    /* chama fn quando outra aba (o site) grava algo */
    aoMudar: function (fn) {
      window.addEventListener('storage', function (e) { if (e.key === K('ping') || e.key === K('pedidos') || e.key === K('reservas')) fn(); });
      setInterval(fn, 15000);
    },
    zerarDemo: function () { Object.keys(localStorage).filter(function (k) { return k.indexOf('kip_') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); }
  };

  /* ---------- modo no ar (Supabase) ---------- */
  var sb = null;
  function cliente() {
    if (sb) return Promise.resolve(sb);
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = function () { sb = window.supabase.createClient(T.supabaseUrl, T.supabaseKey); ok(sb); };
      s.onerror = function () { erro(new Error('Sem conexão com o banco.')); };
      document.head.appendChild(s);
    });
  }
  function q(fn) { return cliente().then(fn).then(function (r) { if (r && r.error) throw new Error(r.error.message); return r ? r.data : null; }); }
  function mapaHorarios(linhas) {
    var h = {}; (linhas || []).forEach(function (l) { h[l.dia_semana] = { aberto: l.aberto, abre: (l.abre || '').slice(0, 5), fecha: (l.fecha || '').slice(0, 5) }; });
    return Object.keys(h).length ? h : T.horarios;
  }

  var Nuvem = {
    cardapio: function () { return q(function (c) { return c.from('cardapio_itens').select('*').order('ordem'); }); },
    bairros: function () { return q(function (c) { return c.from('bairros').select('*').order('nome'); }); },
    config: function () { return q(function (c) { return c.from('config').select('dados').eq('id', 1).single(); }).then(function (r) { return r.dados; }); },
    horarios: function () { return q(function (c) { return c.from('horarios').select('*'); }).then(mapaHorarios); },
    criarPedido: function (p) { return q(function (c) { return c.rpc('criar_pedido', { p: p }); }); },
    consultarPedido: function (codigo, fone) { return q(function (c) { return c.rpc('consultar_pedido', { p_codigo: codigo, p_telefone: fone }); }).then(function (r) { return (r && r[0]) || null; }); },
    criarReserva: function (r) { return q(function (c) { return c.rpc('criar_reserva', { p: r }); }); },

    entrar: function (email, senha) { return cliente().then(function (c) { return c.auth.signInWithPassword({ email: email, password: senha }); }).then(function (r) { if (r.error) throw new Error('E-mail ou senha incorretos.'); return true; }); },
    sessao: function () { return cliente().then(function (c) { return c.auth.getSession(); }).then(function (r) { return !!(r.data && r.data.session); }); },
    sair: function () { return cliente().then(function (c) { return c.auth.signOut(); }); },
    pedidos: function () {
      var desde = new Date(); desde.setDate(desde.getDate() - 180);
      return q(function (c) { return c.from('pedidos').select('*').gte('criado_em', desde.toISOString()).order('criado_em'); });
    },
    reservas: function () {
      var desde = new Date(); desde.setDate(desde.getDate() - 180);
      return q(function (c) { return c.from('reservas').select('*').gte('data', U.hoje(desde)).order('data'); });
    },
    atualizarPedido: function (id, campos) { return q(function (c) { return c.from('pedidos').update(campos).eq('id', id); }); },
    atualizarReserva: function (id, campos) { return q(function (c) { return c.from('reservas').update(campos).eq('id', id); }); },
    reservaBalcao: function (r) { r.codigo = U.codigo(); r.status = 'confirmada'; return q(function (c) { return c.from('reservas').insert(r); }); },
    salvarItem: function (it) {
      var dados = Object.assign({}, it); if (!dados.id || !/^[0-9a-f-]{36}$/.test(dados.id)) delete dados.id;
      return q(function (c) { return c.from('cardapio_itens').upsert(dados).select().single(); });
    },
    excluirItem: function (id) { return q(function (c) { return c.from('cardapio_itens').delete().eq('id', id); }); },
    salvarConfig: function (cfg) { return q(function (c) { return c.from('config').update({ dados: cfg }).eq('id', 1); }); },
    salvarHorarios: function (h) {
      var linhas = Object.keys(h).map(function (d) { return { dia_semana: +d, aberto: h[d].aberto, abre: h[d].abre, fecha: h[d].fecha }; });
      return q(function (c) { return c.from('horarios').upsert(linhas); });
    },
    salvarBairros: function (lista) {
      return q(function (c) {
        var dados = lista.map(function (b) { var x = { nome: b.nome, taxa_centavos: b.taxa_centavos, ativo: b.ativo }; if (/^[0-9a-f-]{36}$/.test(b.id || '')) x.id = b.id; return x; });
        return c.from('bairros').upsert(dados);
      });
    },
    aoMudar: function (fn) {
      cliente().then(function (c) {
        c.channel('painel').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fn)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, fn).subscribe();
      });
      setInterval(fn, 60000);
    },
    zerarDemo: function () {}
  };

  var api = demo ? Demo : Nuvem;
  api.U = U;
  api.demo = demo;
  return api;
})();
