/* =====================================================================
   Kipaladar Restaurante — configuração
   Único arquivo que precisa ser editado para o site sair do modo de
   demonstração e entrar no ar de verdade.
   ===================================================================== */

window.BN = {

  /* ---- Negócio ---------------------------------------------------- */
  nome:      'Kipaladar',
  tipo:      'Restaurante',
  instagram: '',                     // A CONFIRMAR: ainda não tem Instagram

  // A CONFIRMAR: o flyer não traz telefone. Número fictício só pra demo.
  whatsapp:        '5571900000000',
  whatsappVisivel: '(71) 9 0000-0000',
  telefone:        '5571900000000',
  telefoneVisivel: '(71) 9 0000-0000',

  // Endereço tirado do flyer (15/10/2026).
  endereco: {
    linha1: 'Avenida Cardeal da Silva, em frente ao nº 41',
    linha2: 'Ao lado do Edifício House Federação · Federação, Salvador · BA',
    maps:   'https://www.google.com/maps/search/?api=1&query=Avenida+Cardeal+da+Silva+41+Federa%C3%A7%C3%A3o+Salvador+BA',
    embed:  'https://www.google.com/maps?q=Avenida+Cardeal+da+Silva,+41,+Federa%C3%A7%C3%A3o,+Salvador+-+BA&output=embed'
  },

  /* ---- Supabase ---------------------------------------------------
     Enquanto estes dois campos estiverem vazios, o site roda em MODO
     DEMONSTRAÇÃO: pedido, reserva e painel funcionam de verdade na tela,
     mas os dados ficam guardados só no navegador de quem está olhando.
     Para ligar: rode db/schema.sql num projeto Supabase e cole URL + anon.
  ------------------------------------------------------------------ */
  supabaseUrl: '',
  supabaseKey: '',

  /* ---- Horário (0 = domingo) ---------------------------------------
     A CONFIRMAR: palpite de almoço comercial, seg a sáb, 11h às 15h.
  ------------------------------------------------------------------ */
  horarios: {
    0: { aberto: false, abre: '11:00', fecha: '15:00' },
    1: { aberto: true,  abre: '11:00', fecha: '15:00' },
    2: { aberto: true,  abre: '11:00', fecha: '15:00' },
    3: { aberto: true,  abre: '11:00', fecha: '15:00' },
    4: { aberto: true,  abre: '11:00', fecha: '15:00' },
    5: { aberto: true,  abre: '11:00', fecha: '15:00' },
    6: { aberto: true,  abre: '11:00', fecha: '15:00' }
  },

  // Acompanhamentos do flyer: vêm com todo prato comercial.
  acompanhamentos: [
    { id: 'arroz',    nome: 'Arroz',           foto: 'fotos/arroz.jpg' },
    { id: 'feijao',   nome: 'Feijão de caldo', foto: 'fotos/feijao.jpg' },
    { id: 'macarrao', nome: 'Macarrão',        foto: 'fotos/macarrao.jpg' },
    { id: 'salada',   nome: 'Salada',          foto: 'fotos/salada.jpg' }
  ],

  categorias: [
    { id: 'pratos',  nome: 'Pratos comerciais' },
    { id: 'bebidas', nome: 'Bebidas' }
  ],

  /* Os 4 pratos e o preço (R$ 25,00) estão no flyer.
     Bebidas e preços delas: A CONFIRMAR (palpite de mercado). */
  cardapioDemo: (function () {
    var R = function (c) { return [{ rotulo: 'Unidade', centavos: c }]; };
    return [
      { id: 'strogonoff', categoria: 'pratos', nome: 'Strogonoff',   descricao: 'Strogonoff cremoso com batata palha.',                  precos: R(2500), foto: 'fotos/strogonoff.jpg', destaque: true,  acomp: true },
      { id: 'bife',       categoria: 'pratos', nome: 'Bife de carne', descricao: 'Bife acebolado, com fritas.',                          precos: R(2500), foto: 'fotos/bife.jpg',       destaque: false, acomp: true },
      { id: 'quiabada',   categoria: 'pratos', nome: 'Quiabada',     descricao: 'Quiabo refogado com camarão, no tempero baiano.',       precos: R(2500), foto: 'fotos/quiabada.jpg',   destaque: true,  acomp: true },
      { id: 'frango',     categoria: 'pratos', nome: 'Frango assado', descricao: 'Coxa e sobrecoxa assadas, douradas, com fritas.',       precos: R(2500), foto: 'fotos/frango.jpg',     destaque: false, acomp: true },
      { id: 'refri-lata', categoria: 'bebidas', nome: 'Refrigerante lata', descricao: '350 ml. Diga o sabor na observação.', precos: R(600), foto: '', destaque: false },
      { id: 'refri-1l',   categoria: 'bebidas', nome: 'Refrigerante 1 litro', descricao: 'Diga o sabor na observação.',      precos: R(1000), foto: '', destaque: false },
      { id: 'suco',       categoria: 'bebidas', nome: 'Suco natural',  descricao: 'Copo de 400 ml. Pergunte a fruta do dia.', precos: R(700), foto: '', destaque: false },
      { id: 'agua',       categoria: 'bebidas', nome: 'Água mineral',  descricao: '500 ml, com ou sem gás.',                  precos: R(350), foto: '', destaque: false }
    ].map(function (it, i) { it.ordem = i; it.disponivel = true; it.meia = false; return it; });
  })(),

  // A CONFIRMAR: bairros e taxa. Palpite: Federação e vizinhos, R$ 3 a R$ 6.
  bairrosDemo: [
    ['Federação', 300], ['Garcia', 400], ['Ondina', 400], ['Rio Vermelho', 500], ['Engenho Velho da Federação', 400],
    ['Vasco da Gama', 500], ['Canela', 500], ['Barra', 600], ['Graça', 600], ['Campo Grande', 600]
  ].map(function (b, i) { return { id: 'b' + i, nome: b[0], taxa_centavos: b[1], ativo: true }; }),

  configDemo: {
    aceitando_pedidos: true,
    status_manual: 'auto',
    pedido_minimo_centavos: null,
    tempo_entrega: '30 a 45 min',     // A CONFIRMAR
    aviso: {
      ativo: true,
      titulo: 'Agende o seu almoço',
      texto: 'Escolha o prato agora e diga a hora: às 12h ele chega quentinho na sua mesa de trabalho.'
    }
  }
};

window.BN.modoDemo = !(window.BN.supabaseUrl && window.BN.supabaseKey);
