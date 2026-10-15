/* Kipaladar — site público: cardápio, carrinho, pedido, acompanhamento e reserva. */
(function () {
  var T = window.BN, U = BD.U, $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { itens: [], bairros: [], cfg: {}, horarios: T.horarios, cat: null, passo: 'carrinho' };
  var ico = function (id, cls) { return '<svg class="ico ' + (cls || '') + '"><use href="#i-' + id + '"/></svg>'; };

  /* ---------- carrinho (persistido neste aparelho) ---------- */
  var CAR_KEY = 'kip_carrinho', CLI_KEY = 'kip_cliente', ULT_KEY = 'kip_ultimo_pedido';
  function lerLS(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var car = lerLS(CAR_KEY, []);
  function salvarCar() { gravarLS(CAR_KEY, car); pintarBarra(); }
  function subtotal() {
    var sem = false, s = car.reduce(function (t, l) { var p = U.precoLinha(S.itens, l); if (p == null) sem = true; return t + (p || 0) * l.qtd; }, 0);
    return sem ? null : s;
  }
  function qtdTotal() { return car.reduce(function (t, l) { return t + l.qtd; }, 0); }

  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  /* ---------- carga ---------- */
  Promise.all([BD.cardapio(), BD.bairros(), BD.config(), BD.horarios()]).then(function (r) {
    S.itens = r[0] || []; S.bairros = (r[1] || []).filter(function (b) { return b.ativo !== false; }); S.cfg = r[2] || {}; S.horarios = r[3] || T.horarios;
    car = car.filter(function (l) { return S.itens.some(function (i) { return i.id === l.id; }); });
    pintarTudo();
    var cod = new URLSearchParams(location.search).get('pedido');
    if (cod) acompanhar(cod.toUpperCase());
  }).catch(function () {
    $('#lista').innerHTML = '<p class="vazio">Não deu pra carregar o cardápio agora. Peça pelo <a href="' + U.wa(T.whatsapp, 'Olá, desejo fazer um pedido.') + '">WhatsApp</a>.</p>';
  });

  function pintarTudo() {
    if (BD.demo) $('#demo-aviso').hidden = false;
    var st = U.status(S.horarios, S.cfg);
    $('#st').classList.toggle('on', st.aberto); $('#st-txt').textContent = st.texto;
    if (S.cfg.aviso && S.cfg.aviso.ativo && S.cfg.aviso.titulo) {
      $('#aviso').hidden = false; $('#aviso-t').textContent = S.cfg.aviso.titulo; $('#aviso-x').textContent = S.cfg.aviso.texto || '';
    }
    var info = [ico('relogio') + (st.aberto ? 'Aberto agora' : 'Fechado agora')];
    if (S.cfg.tempo_entrega) info.push(ico('moto') + 'Entrega em ' + S.cfg.tempo_entrega);
    info.push(ico('sacola') + 'Retirada no balcão');
    $('#info-entrega').innerHTML = info.map(function (x) { return '<span>' + x + '</span>'; }).join('');
    pintarCardapio(); pintarOnde(); pintarBarra(); prepararReserva();
    var waGeral = U.wa(T.whatsapp, 'Olá! Vim pelo site do Kipaladar.');
    ['#btn-wa', '#wa-flut', '#rod-wa', '#faixa-wa'].forEach(function (s) { $(s).href = waGeral; });
    $('#rod-wa').textContent = 'WhatsApp ' + T.whatsappVisivel;
    $('#btn-firma').href = U.wa(T.whatsapp, 'Olá! Quero combinar o almoço da minha equipe com o Kipaladar.');
  }

  /* ---------- cardápio ---------- */
  function precoTexto(it) {
    var ps = it.precos.filter(function (p) { return p.centavos != null; }).map(function (p) { return p.centavos; });
    if (!ps.length) return '<span class="preco conf">Preço a confirmar</span>';
    var m = Math.min.apply(null, ps);
    return '<span class="preco">' + (it.precos.length > 1 ? 'a partir de ' : '') + U.reais(m) + '</span>';
  }
  function pintarCardapio() {
    var cats = T.categorias.filter(function (c) { return S.itens.some(function (i) { return i.categoria === c.id; }); });
    $('#abas').innerHTML = cats.map(function (c, i) { return '<button role="tab" data-cat="' + c.id + '"' + (i === 0 ? ' class="on"' : '') + '>' + U.esc(c.nome) + '</button>'; }).join('');
    $('#lista').innerHTML = cats.map(function (c) {
      var its = S.itens.filter(function (i) { return i.categoria === c.id; }).sort(function (a, b) { return (b.destaque - a.destaque) || (a.ordem - b.ordem); });
      var tam = its[0] && its[0].precos.length > 1 ? its[0].precos.map(function (p) { return p.rotulo; }).join(' · ') : '';
      return '<h3 class="cat-titulo" id="cat-' + c.id + '">' + U.esc(c.nome) + (tam ? '<small>' + U.esc(tam) + '</small>' : '') + '</h3><div class="itens">' +
        its.map(function (it) {
          var off = it.disponivel === false;
          var foto = it.foto ? '<img class="foto" src="' + U.esc(it.foto) + '" alt="" loading="lazy">' : '<span class="foto vazia"><img src="fotos/icone.png" alt=""></span>';
          return '<button class="item' + (off ? ' off' : '') + '" data-id="' + U.esc(it.id) + '"' + (off ? ' aria-disabled="true"' : '') + '>' + foto +
            '<span class="txt"><h4>' + U.esc(it.nome) + (off ? ' <span class="tag esg">Esgotado</span>' : it.destaque ? ' <span class="tag">Mais pedido</span>' : '') + '</h4>' +
            '<p>' + U.esc(it.descricao || '') + '</p><span class="rod">' + precoTexto(it) + (off ? '' : '<span class="mais">' + ico('mais') + '</span>') + '</span></span></button>';
        }).join('') + '</div>';
    }).join('');
  }
  $('#abas').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var alvo = $('#cat-' + b.dataset.cat);
    window.scrollTo({ top: alvo.getBoundingClientRect().top + scrollY - 150, behavior: 'smooth' });
  });
  window.addEventListener('scroll', function () {
    var atual = null;
    document.querySelectorAll('.cat-titulo').forEach(function (h) { if (h.getBoundingClientRect().top < 200) atual = h.id.slice(4); });
    if (!atual) return;
    document.querySelectorAll('#abas button').forEach(function (b) { b.classList.toggle('on', b.dataset.cat === atual); });
  }, { passive: true });
  $('#lista').addEventListener('click', function (e) {
    var b = e.target.closest('.item'); if (!b || b.classList.contains('off')) return;
    abrirItem(S.itens.find(function (i) { return i.id === b.dataset.id; }));
  });

  /* ---------- modal do item ---------- */
  function abrirItem(it) {
    var m = $('#m-item'), multi = it.precos.length > 1;
    var outros = S.itens.filter(function (o) { return o.categoria === it.categoria && o.id !== it.id && o.meia && o.disponivel !== false; });
    m.innerHTML = (it.foto ? '<img class="m-foto" src="' + U.esc(it.foto) + '" alt="">' : '') +
      '<button class="fechar m-x" data-x aria-label="Fechar">' + ico('x') + '</button>' +
      '<form method="dialog" id="f-item"><div class="m-corpo"><h3>' + U.esc(it.nome) + '</h3><p>' + U.esc(it.descricao || '') + '</p>' +
      (multi ? '<label>Tamanho</label><div class="opcs">' + it.precos.map(function (p, i) {
        return '<label class="opc"><span><input type="radio" name="tam" value="' + U.esc(p.rotulo) + '"' + (i === (it.precos.length > 2 ? 1 : 0) ? ' checked' : '') + '>' + U.esc(p.rotulo) + '</span><span>' + (p.centavos == null ? '<small style="color:var(--suave)">a confirmar</small>' : U.reais(p.centavos)) + '</span></label>';
      }).join('') + '</div>' : '') +
      (it.acomp ? '<label>Acompanhamentos <span style="font-weight:500;color:var(--suave)">(já vêm no prato)</span></label><div class="acomps">' + T.acompanhamentos.map(function (a) {
        return '<label class="acomp"><input type="checkbox" name="acomp" value="' + U.esc(a.nome) + '" checked><img src="' + U.esc(a.foto) + '" alt=""><span>' + U.esc(a.nome) + '</span></label>'; }).join('') + '</div>' : '') +
      (it.meia && outros.length ? '<label class="opc" style="margin-bottom:10px"><span><input type="checkbox" id="meia">Meio a meio</span><small style="color:var(--suave)">cobra o sabor mais caro</small></label>' +
        '<div id="meia-box" hidden style="margin-bottom:18px"><label for="sabor2">Segunda metade</label><select id="sabor2" style="margin-top:6px">' +
        outros.map(function (o) { return '<option value="' + U.esc(o.id) + '">' + U.esc(o.nome) + '</option>'; }).join('') + '</select></div>' : '') +
      '<label for="obs-item">Observação <span style="font-weight:500;color:var(--suave)">(opcional)</span></label><textarea id="obs-item" style="margin-top:6px" placeholder="' + (it.categoria === 'bebidas' ? 'Ex.: Guaraná' : 'Ex.: sem cebola, mais feijão') + '"></textarea></div>' +
      '<div class="m-rod"><div class="qtd"><button type="button" data-q="-1" aria-label="Menos">' + ico('menos') + '</button><span id="q">1</span><button type="button" data-q="1" aria-label="Mais">' + ico('mais') + '</button></div>' +
      '<button class="btn btn-verm" type="submit" id="add">Adicionar</button></div></form>';
    var q = 1;
    function linhaAtual() {
      var tam = multi ? m.querySelector('input[name=tam]:checked').value : it.precos[0].rotulo;
      var meia = m.querySelector('#meia'), s2 = meia && meia.checked ? m.querySelector('#sabor2').value : null;
      var ac = it.acomp ? [].map.call(m.querySelectorAll('input[name=acomp]:checked'), function (x) { return x.value; }) : null;
      return { id: it.id, tamanho: tam, sabor2: s2, acomp: ac, qtd: q, obs: m.querySelector('#obs-item').value.trim() };
    }
    function atualizar() {
      var l = linhaAtual(), p = U.precoLinha(S.itens, l);
      m.querySelector('#q').textContent = q;
      m.querySelector('#add').textContent = 'Adicionar' + (p != null ? ' · ' + U.reais(p * q) : '');
      var box = m.querySelector('#meia-box'); if (box) box.hidden = !m.querySelector('#meia').checked;
    }
    m.addEventListener('change', atualizar);
    m.onclick = function (e) {
      var b = e.target.closest('[data-q]'); if (b) { q = Math.max(1, Math.min(20, q + +b.dataset.q)); atualizar(); }
      if (e.target.closest('[data-x]') || e.target === m) m.close();
    };
    m.querySelector('#f-item').onsubmit = function (e) {
      e.preventDefault();
      var l = linhaAtual();
      var igual = car.find(function (c) { return c.id === l.id && c.tamanho === l.tamanho && c.sabor2 === l.sabor2 && c.obs === l.obs && String(c.acomp) === String(l.acomp); });
      if (igual) igual.qtd += l.qtd; else car.push(l);
      salvarCar(); m.close(); toast(it.nome + ' no pedido');
    };
    atualizar(); m.showModal();
  }

  function nomeLinha(l) {
    var a = S.itens.find(function (i) { return i.id === l.id; }) || { nome: '?' };
    var ac = l.acomp ? (l.acomp.length ? ' (' + l.acomp.join(', ').toLowerCase() + ')' : ' (sem acompanhamentos)') : '';
    return a.nome + ac;
  }

  /* ---------- barra + gaveta ---------- */
  function pintarBarra() {
    var n = qtdTotal(), s = subtotal();
    $('#barra').classList.toggle('on', n > 0); document.body.classList.toggle('tem-carrinho', n > 0);
    $('#barra-qt').textContent = n; $('#barra-tot').textContent = n ? (s == null ? 'valores a confirmar' : U.reais(s)) : '';
  }
  function abrirGaveta(passo) { S.passo = passo || 'carrinho'; pintarGaveta(); $('#gaveta').classList.add('on'); $('#veu').classList.add('on'); $('#gaveta').setAttribute('aria-hidden', 'false'); }
  function fecharGaveta() { $('#gaveta').classList.remove('on'); $('#veu').classList.remove('on'); $('#gaveta').setAttribute('aria-hidden', 'true'); }
  $('#barra').onclick = function () { abrirGaveta('carrinho'); };
  $('#veu').onclick = fecharGaveta;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharGaveta(); });

  function totaisHTML(taxa) {
    var s = subtotal(), semPreco = s == null;
    var h = '<div class="totais"><div><span>Subtotal</span><b>' + U.reais(s) + '</b></div>';
    if (taxa !== undefined) h += '<div><span>Entrega</span><b>' + (taxa === 0 ? 'grátis' : taxa == null ? 'a combinar' : U.reais(taxa)) + '</b></div>';
    var tot = s != null && (taxa === undefined || taxa != null) ? s + (taxa || 0) : null;
    h += '<div class="tot"><span>Total</span><span>' + (tot == null ? 'a confirmar' : U.reais(tot)) + '</span></div></div>';
    if (semPreco) h += '<div class="alerta">Alguns valores são confirmados pela casa no WhatsApp, junto com o seu pedido.</div>';
    return h;
  }

  function pintarGaveta() {
    var corpo = $('#g-corpo'), rod = $('#g-rod');
    if (!car.length) {
      $('#g-titulo').textContent = 'Seu pedido';
      corpo.innerHTML = '<div class="vazio"><img src="fotos/logo.jpg" alt=""><p>Seu pedido está vazio.<br>Escolha no cardápio.</p></div>';
      rod.innerHTML = '<button class="btn btn-azul btn-bloco" data-fechar>Ver cardápio</button>'; return;
    }
    if (S.passo === 'carrinho') {
      $('#g-titulo').textContent = 'Seu pedido';
      corpo.innerHTML = car.map(function (l, i) {
        var p = U.precoLinha(S.itens, l);
        return '<div class="linha-car"><div class="n"><b>' + U.esc(nomeLinha(l)) + '</b><small>' + (p == null ? 'valor a confirmar' : U.reais(p * l.qtd)) + (l.obs ? ' · ' + U.esc(l.obs) : '') + '</small></div>' +
          '<div class="qtd"><button data-l="' + i + '" data-d="-1" aria-label="Menos">' + ico(l.qtd === 1 ? 'x' : 'menos') + '</button><span>' + l.qtd + '</span><button data-l="' + i + '" data-d="1" aria-label="Mais">' + ico('mais') + '</button></div></div>';
      }).join('') + totaisHTML();
      rod.innerHTML = '<button class="btn btn-verm btn-bloco" data-passo="dados">Continuar</button>';
      return;
    }
    // passo dados
    $('#g-titulo').textContent = 'Entrega e pagamento';
    var c = lerLS(CLI_KEY, {});
    var bairrosOpts = '<option value="">Escolha o bairro</option>' + S.bairros.map(function (b) {
      return '<option' + (c.bairro === b.nome ? ' selected' : '') + '>' + U.esc(b.nome) + '</option>'; }).join('') + '<option value="__outro">Outro bairro</option>';
    corpo.innerHTML = '<form id="f-ped" novalidate>' +
      '<div class="seg"><label><input type="radio" name="tipo" value="entrega"' + (c.tipo !== 'retirada' ? ' checked' : '') + '><span>' + ico('moto') + 'Entrega</span></label>' +
      '<label><input type="radio" name="tipo" value="retirada"' + (c.tipo === 'retirada' ? ' checked' : '') + '><span>' + ico('sacola') + 'Retirar</span></label></div>' +
      '<label style="display:block;margin:4px 0 8px">Para quando?</label>' +
      '<div class="seg"><label><input type="radio" name="quando" value="agora"' + (c.quando !== 'agendar' ? ' checked' : '') + '><span>' + ico('fogo') + 'Agora</span></label>' +
      '<label><input type="radio" name="quando" value="agendar"' + (c.quando === 'agendar' ? ' checked' : '') + '><span>' + ico('relogio') + 'Agendar</span></label></div>' +
      '<div class="campo" id="hora-box" hidden style="margin-bottom:14px"><label for="p-hora">Horário</label><select id="p-hora">' + horariosPedido() + '</select></div>' +
      '<div class="campos">' +
      '<div class="campo cheio"><label for="p-nome">Nome</label><input id="p-nome" autocomplete="name" value="' + U.esc(c.nome || '') + '" required></div>' +
      '<div class="campo cheio"><label for="p-fone">WhatsApp</label><input id="p-fone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(71) 9 0000-0000" value="' + U.esc(c.fone || '') + '" required></div>' +
      '<div class="campo cheio ent"><label for="p-end">Rua e número</label><input id="p-end" autocomplete="street-address" value="' + U.esc(c.endereco || '') + '"></div>' +
      '<div class="campo cheio ent"><label for="p-bairro">Bairro</label><select id="p-bairro">' + bairrosOpts + '</select></div>' +
      '<div class="campo cheio ent" id="outro-box" hidden><label for="p-bairro2">Qual bairro?</label><input id="p-bairro2"></div>' +
      '<div class="campo cheio ent"><label for="p-ref">Ponto de referência</label><input id="p-ref" value="' + U.esc(c.referencia || '') + '" placeholder="Ex.: perto do mercado"></div>' +
      '</div><label style="display:block;margin:14px 0 8px">Pagamento</label>' +
      '<div class="seg tres">' + ['Pix', 'Cartão', 'Dinheiro'].map(function (f, i) {
        return '<label><input type="radio" name="pag" value="' + f + '"' + ((c.pag || 'Pix') === f ? ' checked' : '') + '><span>' + f + '</span></label>'; }).join('') + '</div>' +
      '<div class="campo" id="troco-box" hidden><label for="p-troco">Troco para quanto?</label><input id="p-troco" inputmode="decimal" placeholder="Ex.: 100"></div>' +
      '<div class="campo" style="margin-top:12px"><label for="p-obs">Observação <span style="font-weight:500;color:var(--suave)">(opcional)</span></label><textarea id="p-obs"></textarea></div>' +
      '<div id="tot-box"></div></form>';
    rod.innerHTML = '<div style="display:flex;gap:10px"><button class="btn btn-branco" style="box-shadow:inset 0 0 0 2px var(--linha)" data-passo="carrinho">Voltar</button><button class="btn btn-verm" style="flex:1" id="enviar">' + ico('check') + 'Fazer pedido</button></div>';
    var f = $('#f-ped');
    function sinc() {
      var ent = f.querySelector('input[name=tipo]:checked').value === 'entrega';
      f.querySelectorAll('.ent').forEach(function (el) { el.hidden = !ent; });
      $('#outro-box').hidden = !ent || $('#p-bairro').value !== '__outro';
      $('#troco-box').hidden = f.querySelector('input[name=pag]:checked').value !== 'Dinheiro';
      $('#hora-box').hidden = f.querySelector('input[name=quando]:checked').value !== 'agendar';
      var taxa = 0;
      if (ent) { var b = S.bairros.find(function (x) { return x.nome === $('#p-bairro').value; }); taxa = b ? b.taxa_centavos : null; }
      $('#tot-box').innerHTML = totaisHTML(taxa);
    }
    f.addEventListener('change', sinc); sinc();
    $('#enviar').onclick = enviarPedido;
  }

  /* horários de agendamento: de 15 em 15 min dentro do expediente, hoje (com 30 min de folga) e amanhã */
  function horariosPedido() {
    var ops = [], agora = new Date();
    for (var dd = 0; dd < 3 && ops.length < 30; dd++) {
      var d = new Date(agora); d.setDate(d.getDate() + dd);
      var h = S.horarios[d.getDay()]; if (!h || !h.aberto) continue;
      var lim = dd === 0 ? agora.getHours() * 60 + agora.getMinutes() + 30 : 0;
      var rot = dd === 0 ? 'Hoje' : dd === 1 ? 'Amanhã' : ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()];
      for (var m = U.min(h.abre) + 30; m <= U.min(h.fecha) - 30; m += 15) if (m >= lim) {
        var t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'), v = rot + ' às ' + t.replace(':', 'h');
        ops.push('<option>' + v + '</option>');
      }
    }
    return ops.join('') || '<option value="">Sem horário disponível</option>';
  }

  $('#gaveta').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-fechar')) { fecharGaveta(); return; }
    if (b.dataset.passo) { S.passo = b.dataset.passo; pintarGaveta(); $('#g-corpo').scrollTop = 0; return; }
    if (b.dataset.l != null) {
      var l = car[+b.dataset.l]; l.qtd += +b.dataset.d;
      if (l.qtd <= 0) car.splice(+b.dataset.l, 1);
      salvarCar(); pintarGaveta();
    }
  });

  /* ---------- enviar pedido ---------- */
  function enviarPedido() {
    var f = $('#f-ped'), ent = f.querySelector('input[name=tipo]:checked').value === 'entrega';
    var nome = $('#p-nome').value.trim(), fone = U.digitos($('#p-fone').value);
    var bairro = $('#p-bairro').value === '__outro' ? $('#p-bairro2').value.trim() : $('#p-bairro').value;
    var erro = !nome ? 'Diga seu nome.' : fone.length < 10 ? 'Confira o WhatsApp com DDD.' : ent && !$('#p-end').value.trim() ? 'Falta o endereço.' : ent && !bairro ? 'Escolha o bairro.' : '';
    if (erro) { toast(erro); return; }
    var sub = subtotal(), min = S.cfg.pedido_minimo_centavos;
    if (min && sub != null && sub < min) { toast('Pedido mínimo de ' + U.reais(min) + '.'); return; }
    var pag = f.querySelector('input[name=pag]:checked').value;
    var agendar = f.querySelector('input[name=quando]:checked').value === 'agendar';
    if (agendar && !$('#p-hora').value) { toast('Escolha o horário.'); return; }
    var troco = pag === 'Dinheiro' ? Math.round(parseFloat(($('#p-troco').value || '').replace(',', '.')) * 100) || null : null;
    gravarLS(CLI_KEY, { nome: nome, fone: fone, endereco: $('#p-end').value.trim(), bairro: bairro, referencia: $('#p-ref').value.trim(), tipo: ent ? 'entrega' : 'retirada', pag: pag, quando: agendar ? 'agendar' : 'agora' });
    var payload = {
      cliente_nome: nome, cliente_telefone: fone, tipo: ent ? 'entrega' : 'retirada',
      endereco: ent ? $('#p-end').value.trim() : '', bairro: ent ? bairro : '', referencia: ent ? $('#p-ref').value.trim() : '',
      pagamento: pag === 'Cartão' ? 'Cartão na entrega' : pag, troco_para: troco, observacao: $('#p-obs').value.trim(),
      agendado_para: agendar ? $('#p-hora').value : '',
      itens: car.map(function (l) { return { id: l.id, nome: nomeLinha(l), tamanho: l.tamanho, sabor2: l.sabor2, acomp: l.acomp, qtd: l.qtd, obs: l.obs }; })
    };
    var btn = $('#enviar'); btn.disabled = true; btn.textContent = 'Enviando…';
    BD.criarPedido(payload).then(function (ped) {
      if (typeof ped === 'string') ped = Object.assign({ codigo: ped }, payload);
      gravarLS(ULT_KEY, { codigo: ped.codigo, fone: fone });
      car = []; salvarCar(); fecharGaveta();
      pedidoFeito(ped, payload);
    }).catch(function (e) { btn.disabled = false; btn.textContent = 'Fazer pedido'; toast(e.message || 'Não foi. Tente de novo ou chame no WhatsApp.'); });
  }

  function linkAcompanhar(cod) { return location.origin + location.pathname + '?pedido=' + cod; }
  function msgPedido(ped, p) {
    var L = ['*Pedido ' + ped.codigo + '* — Kipaladar', ''];
    p.itens.forEach(function (i) { L.push(i.qtd + 'x ' + i.nome + (i.obs ? ' (' + i.obs + ')' : '')); });
    L.push('');
    if (ped.total_centavos != null) L.push('Total: ' + U.reais(ped.total_centavos));
    else L.push('Valores: confirmar comigo, por favor');
    if (p.agendado_para) L.push('*Agendado: ' + p.agendado_para + '*');
    L.push(p.tipo === 'entrega' ? 'Entrega: ' + p.endereco + ' — ' + p.bairro + (p.referencia ? ' (ref.: ' + p.referencia + ')' : '') : 'Vou retirar no balcão');
    L.push('Pagamento: ' + p.pagamento + (p.troco_para ? ' (troco p/ ' + U.reais(p.troco_para) + ')' : ''));
    if (p.observacao) L.push('Obs.: ' + p.observacao);
    L.push('Nome: ' + p.cliente_nome, '', 'Acompanhar: ' + linkAcompanhar(ped.codigo));
    return L.join('\n');
  }
  function pedidoFeito(ped, p) {
    var m = $('#m-ok');
    m.innerHTML = '<div class="m-corpo" style="max-height:none;text-align:center"><div class="ok-ico">' + ico('check') + '</div><h3>Pedido recebido!</h3>' +
      '<p style="margin:0 0 8px;color:var(--suave)">O número do seu pedido é</p><div class="codigo">' + ped.codigo + '</div>' +
      (p.agendado_para ? '<p style="margin:10px 0 0"><b>Agendado: ' + U.esc(p.agendado_para) + '</b></p>' : '') + '<p style="color:var(--suave);margin:10px 0 22px">A cozinha já está com ele. Mande a confirmação no WhatsApp pra agilizar' + (ped.total_centavos == null ? ' e receber o valor final' : '') + '.</p>' +
      '<a class="btn btn-wa btn-bloco" target="_blank" rel="noopener" href="' + U.wa(T.whatsapp, msgPedido(ped, p)) + '">' + ico('wa', 'cheio') + 'Enviar no WhatsApp</a>' +
      '<button class="btn btn-branco btn-bloco" style="margin-top:10px;box-shadow:inset 0 0 0 2px var(--linha)" data-acomp="' + ped.codigo + '">Acompanhar pedido</button></div>';
    m.onclick = function (e) { var b = e.target.closest('[data-acomp]'); if (b) { m.close(); acompanhar(b.dataset.acomp); } else if (e.target === m) m.close(); };
    m.showModal();
  }

  /* ---------- acompanhar pedido ---------- */
  var ETAPAS = [['novo', 'Pedido recebido'], ['preparo', 'Em preparo'], ['saiu', 'Saiu para entrega'], ['entregue', 'Entregue']];
  function acompanhar(cod) {
    var ult = lerLS(ULT_KEY, {}), fone = ult.codigo === cod ? ult.fone : lerLS(CLI_KEY, {}).fone;
    var m = $('#m-ok');
    function pinta(p) {
      if (!p) {
        m.innerHTML = '<div class="m-corpo" style="max-height:none"><h3>Pedido ' + U.esc(cod) + '</h3><p>Não achamos esse pedido' + (BD.demo ? ' neste aparelho' : '') + '. Confira pelo WhatsApp.</p>' +
          '<a class="btn btn-wa btn-bloco" target="_blank" rel="noopener" href="' + U.wa(T.whatsapp, 'Oi! Quero saber do meu pedido ' + cod) + '">' + ico('wa', 'cheio') + 'Falar no WhatsApp</a></div>';
        return;
      }
      var etapas = p.tipo === 'retirada' ? [['novo', 'Pedido recebido'], ['preparo', 'Em preparo'], ['saiu', 'Pronto pra retirar'], ['entregue', 'Retirado']] : ETAPAS;
      var idx = etapas.findIndex(function (e) { return e[0] === p.status; });
      var cancel = p.status === 'cancelado';
      m.innerHTML = '<button class="fechar m-x" data-x aria-label="Fechar">' + ico('x') + '</button><div class="m-corpo" style="max-height:none"><p style="margin:0;color:var(--suave)">Pedido</p><div class="codigo" style="text-align:left">' + U.esc(p.codigo) + '</div>' +
        (cancel ? '<div class="alerta">Este pedido foi cancelado. Qualquer dúvida, chame no WhatsApp.</div>' :
        '<ol class="etapas">' + etapas.map(function (e, i) {
          return '<li class="' + (i < idx || (i === idx && i === etapas.length - 1) ? 'feito' : i === idx ? 'atual' : '') + '"><i>' + (i <= idx ? ico('check') : '') + '</i>' + e[1] + '</li>'; }).join('') + '</ol>') +
        '<p class="miudo" style="margin-bottom:16px">Atualiza sozinho. Feito às ' + new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.</p>' +
        '<a class="btn btn-wa btn-bloco" target="_blank" rel="noopener" href="' + U.wa(T.whatsapp, 'Oi! Sobre o meu pedido ' + p.codigo) + '">' + ico('wa', 'cheio') + 'Falar com a casa</a></div>';
    }
    function busca() { return BD.consultarPedido(cod, fone).then(pinta).catch(function () { pinta(null); }); }
    m.onclick = function (e) { if (e.target.closest('[data-x]') || e.target === m) m.close(); };
    m.addEventListener('close', function () { clearInterval(acompanhar.t); history.replaceState(null, '', location.pathname); }, { once: true });
    m.innerHTML = '<div class="m-corpo"><p>Carregando…</p></div>'; if (!m.open) m.showModal();
    busca(); clearInterval(acompanhar.t); acompanhar.t = setInterval(busca, 20000);
  }

  /* ---------- onde fica ---------- */
  function pintarOnde() {
    $('#endereco').innerHTML = U.esc(T.endereco.linha1) + '<small>' + U.esc(T.endereco.linha2) + '</small>';
    $('#btn-rota').href = T.endereco.maps;
    $('#mapa').src = T.endereco.embed;
    var nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'], hoje = new Date().getDay();
    $('#horas').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var h = S.horarios[d];
      return '<tr' + (d === hoje ? ' class="hoje"' : '') + '><td>' + nomes[d] + (d === hoje ? ' (hoje)' : '') + '</td><td>' + (h && h.aberto ? h.abre.replace(':00', 'h') + ' às ' + h.fecha.replace(':00', 'h') : 'Fechado') + '</td></tr>';
    }).join('');
  }

  /* ---------- reserva ---------- */
  function prepararReserva() {
    var d = $('#r-data'), hoje = U.hoje(), max = new Date(); max.setDate(max.getDate() + 60);
    d.min = hoje; d.max = U.hoje(max); if (!d.value) d.value = hoje;
    function horas() {
      var dt = new Date(d.value + 'T12:00'), h = S.horarios[dt.getDay()], sel = $('#r-hora'), atual = sel.value;
      if (!h || !h.aberto) { sel.innerHTML = '<option value="">Fechado neste dia</option>'; return; }
      var ini = U.min(h.abre), fim = U.min(h.fecha) - 60, agora = new Date(), lim = d.value === hoje ? agora.getHours() * 60 + agora.getMinutes() + 60 : 0, ops = [];
      for (var m = ini; m <= fim; m += 30) if (m >= lim) { var t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); ops.push('<option' + (t === atual ? ' selected' : '') + '>' + t + '</option>'); }
      sel.innerHTML = ops.length ? ops.join('') : '<option value="">Sem horário hoje, escolha outro dia</option>';
    }
    d.onchange = horas; horas();
    var c = lerLS(CLI_KEY, {}); if (c.nome && !$('#r-nome').value) $('#r-nome').value = c.nome; if (c.fone && !$('#r-fone').value) $('#r-fone').value = U.fone(c.fone);
  }
  $('#form-reserva').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = { data: $('#r-data').value, hora: $('#r-hora').value, pessoas: parseInt($('#r-pessoas').value, 10), ocasiao: $('#r-ocasiao').value,
      nome: $('#r-nome').value.trim(), telefone: U.digitos($('#r-fone').value), observacao: $('#r-obs').value.trim() };
    var erro = !r.data || !r.hora ? 'Escolha dia e horário.' : !(r.pessoas >= 1 && r.pessoas <= 80) ? 'Quantas pessoas?' : !r.nome ? 'Diga seu nome.' : r.telefone.length < 10 ? 'Confira o WhatsApp com DDD.' : '';
    if (erro) { toast(erro); return; }
    var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    BD.criarReserva(r).then(function (res) {
      var cod = typeof res === 'string' ? res : res.codigo;
      var dataBR = r.data.split('-').reverse().join('/');
      var msg = '*Reserva ' + cod + '* — Kipaladar\n' + dataBR + ' às ' + r.hora + ' · ' + r.pessoas + ' pessoas' + (r.ocasiao ? ' · ' + r.ocasiao : '') + '\nNome: ' + r.nome + (r.observacao ? '\nObs.: ' + r.observacao : '');
      var m = $('#m-ok');
      m.innerHTML = '<div class="m-corpo" style="max-height:none;text-align:center"><div class="ok-ico">' + ico('check') + '</div><h3>Pedido de reserva enviado</h3>' +
        '<p style="color:var(--suave);margin:8px 0 18px">' + dataBR + ' às ' + r.hora + ' · ' + r.pessoas + ' pessoas.<br>A casa confirma pelo WhatsApp.</p>' +
        '<a class="btn btn-wa btn-bloco" target="_blank" rel="noopener" href="' + U.wa(T.whatsapp, msg) + '">' + ico('wa', 'cheio') + 'Avisar no WhatsApp</a></div>';
      m.onclick = function (ev) { if (ev.target === m) m.close(); };
      m.showModal(); e.target.reset(); prepararReserva(); btn.disabled = false;
    }).catch(function (er) { btn.disabled = false; toast(er.message || 'Não foi. Tente pelo WhatsApp.'); });
  });
})();
