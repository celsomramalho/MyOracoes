// ===================== ÁRVORE DE NÓS PARA RENDERIZAÇÃO =====================

function adicionarLinhas(nos, texto, estado){
  const linhas = (texto || '').split('\n').map(l => l.replace(/[\r\n]/g, '')).filter(l => l.trim().length > 0);

  for(let i = 0; i < linhas.length; i++){
    const linha = linhas[i].trim();

    // Diretiva de resposta automática para ladainhas: uma linha sozinha
    // entre chaves, ex: "{R. rogai por nós.}", liga o modo automático —
    // toda linha "V." seguinte ganha essa resposta sem precisar escrevê-la.
    // "{}" (vazio) desliga o modo automático.
    const diretiva = linha.match(/^\{(.*)\}$/);
    if(diretiva){
      estado.respostaAuto = diretiva[1].trim() || null;
      continue;
    }

    let classe = '';
    if(linha.startsWith('V.'))       classe = 'linha-v';
    else if(linha.startsWith('R.')) classe = 'linha-r';
    nos.push({ tipo: 'linha', texto: linha, classe });

    // Se o modo automático está ligado e a próxima linha não é uma
    // resposta explícita, insere a resposta automática depois da linha V.
    if(classe === 'linha-v' && estado.respostaAuto){
      const proxima = linhas[i + 1];
      const proximaEhResposta = proxima && proxima.startsWith('R.');
      if(!proximaEhResposta){
        const classeAuto = estado.respostaAuto.startsWith('V.') ? 'linha-v' : 'linha-r';
        nos.push({ tipo: 'linha', texto: estado.respostaAuto, classe: classeAuto });
      }
    }
  }
}

// Divide uma linha em partes para colorir só o prefixo ("V."/"R.") e a
// palavra "Oremos." (quando houver), deixando o restante do texto sem cor
// própria (herda o branco padrão do tema).
function criarPartesLinha(linha, classe){
  const partes = [];

  if(classe !== 'linha-v' && classe !== 'linha-r'){
    partes.push({ texto: linha, classe: null });
    return partes;
  }

  const prefixo = linha.slice(0, 2); // "V." ou "R."
  const resto = linha.slice(2);
  const classeSpan = classe === 'linha-v' ? 'rubrica' : 'resposta';
  partes.push({ texto: prefixo, classe: classeSpan });

  if(classe === 'linha-v'){
    const m = resto.match(/^(\s*)(Oremos\.?)/i);
    if(m){
      const [match, espacos, oremos] = m;
      if(espacos) partes.push({ texto: espacos, classe: null });
      partes.push({ texto: oremos, classe: 'rubrica' });
      const sobra = resto.slice(match.length);
      if(sobra) partes.push({ texto: sobra, classe: null });
      return partes;
    }
  }

  if(resto) partes.push({ texto: resto, classe: null });
  return partes;
}

function interpretarReferencia(rawRef){
  const partes = rawRef.split('|');
  if(partes.length < 2){
    return {
      titulo: rawRef.trim(),
      id: null
    };
  }

  const id = partes.pop().trim();
  const titulo = partes.join('|').trim();
  return { titulo, id: id || null };
}

function encontrarOracaoReferenciada(ref){
  if(ref.id){
    const porId =
      ORACOES.find(o => o.id === ref.id) ||
      ORACOES_OFICIAIS.find(o => o.id === ref.id);
    if(porId) return porId;
  }

  const nomeLower = ref.titulo.toLowerCase();
  return (
    ORACOES.find(o => o.titulo.trim().toLowerCase() === nomeLower) ||
    ORACOES_OFICIAIS.find(o => o.titulo.trim().toLowerCase() === nomeLower)
  );
}

function extrairUrlReferenciaLink(tituloRef){
  const match = tituloRef.match(/^link:(.+)$/i);
  if(!match) return null;
  const url = match[1].trim();
  if(!/^https?:\/\//i.test(url)) return null;
  return url;
}

function construirArvore(texto, titulosVisitados, estado){
  if(!estado) estado = { respostaAuto: null };
  const nos = [];
  // O modificador entre chaves aceita um número (repetição) ou a palavra
  // reservada "opcional" (leitura opcional, oculta por padrão).
  const regex = /\[([^[\]]+)\](?:\{(\d+|opcional)\})?(?:\{depende:([^}]+)\})?/gi;
  let ultimoIndice = 0;
  let match;

  while((match = regex.exec(texto || '')) !== null){
    const textoBefore = texto.slice(ultimoIndice, match.index);
    if(textoBefore) adicionarLinhas(nos, textoBefore, estado);

    const ref = interpretarReferencia(match[1].trim());
    const tituloRef = ref.titulo;
    const nomeLower = tituloRef.toLowerCase();
    const modificador = match[2] ? match[2].toLowerCase() : null;
    const depende = match[3] ? match[3].trim() : null;
    const ehOpcional = modificador === 'opcional';
    const quantidade = ehOpcional ? 1 : Math.min(Math.max(parseInt(modificador || '1', 10) || 1, 1), 200);

    const urlLink = extrairUrlReferenciaLink(tituloRef);
    if(urlLink){
      nos.push({ tipo: 'link', url: urlLink, depende });
      ultimoIndice = match.index + match[0].length;
      continue;
    }

    if(nomeLower === 'pausa'){
      // Palavra reservada: não é uma citação de oração, é uma pequena pausa.
      // Reaproveita a mesma sintaxe [Título]{n}, mas "n" aqui é em segundos.
      nos.push({ tipo: 'pausa', segundos: quantidade, depende });
      ultimoIndice = match.index + match[0].length;
      continue;
    }

    const encontrada = encontrarOracaoReferenciada(ref);

    if(!encontrada){
      nos.push({ tipo: 'erro', texto: `(oração "${tituloRef}" não encontrada)`, depende });
    }else{
      const chaveIdEncontrada = `id:${encontrada.id}`;
      const chaveTituloEncontrada = `titulo:${encontrada.titulo.trim().toLowerCase()}`;

      if(titulosVisitados.has(chaveIdEncontrada) || titulosVisitados.has(chaveTituloEncontrada)){
        nos.push({ tipo: 'erro', texto: `(referência circular: ${encontrada.titulo})`, depende });
      }else{
        const novosVisitados = new Set(titulosVisitados);
        novosVisitados.add(chaveIdEncontrada);
        novosVisitados.add(chaveTituloEncontrada);
        // Oração referenciada ganha seu próprio estado de resposta automática,
        // independente do que estiver ligado na oração que a referencia.
        if(ehOpcional){
          // Leitura opcional: começa sempre oculta e fora da fala; o usuário
          // decide, na hora, se quer abrir/ouvir (não é lembrado depois).
          const filhos = construirArvore(encontrada.texto, novosVisitados);
          nos.push({ tipo: 'opcional', rotulo: encontrada.titulo, refId: encontrada.id, filhos, depende });
        }else if(quantidade > 1){
          const filhos = construirArvore(encontrada.texto, novosVisitados);
          nos.push({ tipo: 'repetido', rotulo: encontrada.titulo, quantidade, filhos, colapsarNaFala: !!encontrada.colapsarNaFala, depende });
        }else{
          const filhos = construirArvore(encontrada.texto, novosVisitados);
          nos.push({ tipo: 'bloco', rotulo: encontrada.titulo, filhos, colapsarNaFala: !!encontrada.colapsarNaFala, depende });
        }
      }
    }

    ultimoIndice = match.index + match[0].length;
  }

  const textoFinal = texto ? texto.slice(ultimoIndice) : '';
  if(textoFinal) adicionarLinhas(nos, textoFinal, estado);

  return nos;
}

function criarBtnCheck(idx, ctx){
  const btn = document.createElement('button');
  btn.className = 'btn-check-secao';
  btn.dataset.idx = idx;
  btn.title = 'Marcar como rezada';
  btn.textContent = '✓';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const marcadas = progressoLeitura[ctx.oracaoId] || [];
    if(marcadas.includes(idx)){
      desmarcarSecao(ctx.oracaoId, idx);
    }else{
      marcarSecao(ctx.oracaoId, idx);
    }
  });
  return btn;
}

function continuacaoDeFrase(texto) {
  // Linha é continuação se começa com letra minúscula (ignorando prefixos V./R.)
  const s = texto.replace(/^[VR]\.\s*/, '').trimStart();
  const c = s.charAt(0);
  return c !== '' && c === c.toLowerCase() && c !== c.toUpperCase();
}

function agruparNos(nos){
  // Regras de agrupamento:
  // 1. V. + R. imediatamente seguinte → um grupo só (par inseparável)
  // 2. R. sozinho (sem V. antes, ex: "R. Amém" de fechamento) → grupo próprio
  // 3. Parágrafo livre (nem V. nem R.) → cada parágrafo é um grupo;
  //    linha que começa com minúscula cola com a linha anterior (continuação de frase)
  // 4. Blocos (bloco-ref, repetido) não são tocados — saem como estão

  const grupos = [];
  let linhasAtm = []; // acumula linhas do grupo atual

  function fecharGrupo() {
    if (linhasAtm.length > 0) {
      grupos.push({ tipo: 'grupo-linhas', linhas: linhasAtm });
      linhasAtm = [];
    }
  }

  for (let i = 0; i < nos.length; i++) {
    const no = nos[i];

    if (no.tipo !== 'linha') {
      // Bloco/repetido: fecha o grupo atual e emite o bloco
      fecharGrupo();
      grupos.push(no);
      continue;
    }

    const ehV = no.classe === 'linha-v';
    const ehR = no.classe === 'linha-r';
    const proximo = nos[i + 1];
    const proximoEhR = proximo && proximo.tipo === 'linha' && proximo.classe === 'linha-r';

    if (ehV) {
      // V. sempre inicia um grupo novo
      fecharGrupo();
      linhasAtm.push(no);
      // Absorve linhas de continuação (começam com minúscula) que fazem parte da mesma frase do V.
      while (i + 1 < nos.length && nos[i + 1].tipo === 'linha' &&
             nos[i + 1].classe !== 'linha-v' && nos[i + 1].classe !== 'linha-r' &&
             continuacaoDeFrase(nos[i + 1].texto)) {
        i++;
        linhasAtm.push(nos[i]);
      }
      // Se o próximo for R., puxa junto (par V.+R.)
      const proximoAgoraEhR = nos[i + 1] && nos[i + 1].tipo === 'linha' && nos[i + 1].classe === 'linha-r';
      if (proximoAgoraEhR) {
        i++;
        linhasAtm.push(nos[i]);
      }
      fecharGrupo();
      continue;
    }

    if (ehR) {
      // R. sozinho (não foi consumido pelo V. acima) → grupo próprio
      fecharGrupo();
      linhasAtm.push(no);
      fecharGrupo();
      continue;
    }

    // Parágrafo livre
    if (linhasAtm.length === 0) {
      // Inicia novo grupo de parágrafo
      linhasAtm.push(no);
    } else {
      const ultimaLinha = linhasAtm[linhasAtm.length - 1];
      const ultimaEhParagrafo = ultimaLinha.classe !== 'linha-v' && ultimaLinha.classe !== 'linha-r';
      // Só cola no grupo atual se a anterior também era parágrafo livre E a
      // linha atual é continuação de frase (começa com minúscula). Duas
      // linhas livres que não são continuação uma da outra são parágrafos
      // distintos e precisam de marcadores separados — sem essa checagem,
      // vários parágrafos ficavam "grudados" num único marcador.
      const ehContinuacao = ultimaEhParagrafo && continuacaoDeFrase(no.texto);
      if (ehContinuacao) {
        linhasAtm.push(no);
      } else {
        // Nova frase/parágrafo (ou a anterior era V./R.) → fecha o grupo e abre outro
        fecharGrupo();
        linhasAtm.push(no);
      }
    }
  }

  fecharGrupo();
  return grupos;
}

// Resolve o rótulo real a partir de uma chave {depende:} que pode ter
// o formato "Título" (legado/simples) ou "Título|id" (com id, preferível).
// Quando há |id, busca a oração pelo id para obter o título atual
// (imune a renomeações). Retorna o título que deve ser comparado com
// g.rotulo nos blocos opcionais (chave de leiturasOpcionaisPreferidas).
function resolverRotuloDepende(chave) {
  const partes = chave.split('|');
  if (partes.length >= 2) {
    const refId = partes[partes.length - 1].trim();
    const titulo = partes.slice(0, -1).join('|').trim();
    const encontrada = encontrarOracaoReferenciada({ titulo, id: refId });
    if (encontrada) return encontrada.titulo;
  }
  return chave.trim();
}

function verificarDependenciaAtiva(dependeStr, oracaoIdAtual){
  if(!dependeStr) return true;
  let negado = false;
  let chave = dependeStr.trim();
  if(chave.startsWith('!')){
    negado = true;
    chave = chave.slice(1).trim();
  }

  const rotulo = resolverRotuloDepende(chave);
  const chavePreferencia = oracaoIdAtual ? `${oracaoIdAtual}::${rotulo}` : null;
  const preferenciaSalva = (chavePreferencia && typeof leiturasOpcionaisPreferidas !== 'undefined')
    ? leiturasOpcionaisPreferidas[chavePreferencia]
    : undefined;

  const ativa = (preferenciaSalva === true);
  return negado ? !ativa : ativa;
}

function renderizarNos(nos, container, ctx, ctxRepetidoAninhado, oracaoIdAtual){
  // ctxRepetidoAninhado: o ctx de progresso "real" mais próximo, propagado por
  // baixo de qualquer nível de repetição — serve só para dar identidade
  // própria (idx e entrada em elementos) a um bloco REPETIDO aninhado dentro
  // de outro repetido, mesmo que `ctx` esteja null naquele nível (propósito
  // do null: linha solta ou bloco simples dentro de uma repetição não ganha
  // check individual — o progresso dele é só o contador de contas do nível
  // que o envolve). Sem isso, um repetido dentro de outro repetido caía
  // sempre em idx=-1 e ficava fora de ctx.elementos: a chave de progresso
  // dele no localStorage colava na do repetido pai (mesma chave "-1"/idx
  // herdado), o "zerar progresso" não atualizava visualmente as contas dele,
  // e a fala automática interpretava a repetição inteira do nível de cima
  // como concluída assim que saía do primeiro filho para o repetido aninhado.
  if(ctxRepetidoAninhado === undefined) ctxRepetidoAninhado = ctx;
 
  // oracaoIdAtual: o id da oração raiz sendo rezada, propagado para TODO
  // nível de recursão — inclusive dentro de blocos "opcional", onde `ctx`
  // vira null de propósito (para não ganharem check de progresso). Antes,
  // qualquer leitura opcional aninhada dentro de OUTRA leitura opcional (ex:
  // "1 mistério gozoso (meditado)" dentro de "Mistérios Dolorosos", no Santo
  // Rosário) perdia o acesso ao id da oração junto com o ctx nulado, e por
  // isso nunca conseguia olhar (nem gravar) sua preferência lembrada comum —
  // sempre voltava fechada, ignorando o que o usuário tinha salvo. Mantendo
  // oracaoIdAtual vivo independente do ctx de progresso, a preferência comum
  // volta a funcionar normalmente pra essas leituras aninhadas, e continua
  // sendo A MESMA preferência (uma só chave) não importa qual dos 4
  // mistérios do dia esteja envolvendo-a no momento.
  if(oracaoIdAtual === undefined) oracaoIdAtual = ctx && ctx.oracaoId;
 
  agruparNos(nos).forEach(g => {
    // Para nós com {depende:X}: sempre renderiza, mas guarda info para tagging
    // e controle de visibilidade dinâmica (o switch altera display ao ser alternado).
    let dependeRotulo = null;
    let dependeNegado = false;
    let dependeAtivo = true;
    if (g.depende) {
      let chaveDepende = g.depende.trim();
      if (chaveDepende.startsWith('!')) {
        dependeNegado = true;
        chaveDepende = chaveDepende.slice(1).trim();
      }
      dependeRotulo = resolverRotuloDepende(chaveDepende);
      const chavePreferenciaDepende = oracaoIdAtual ? `${oracaoIdAtual}::${dependeRotulo}` : null;
      const prefSalvaDepende = chavePreferenciaDepende ? leiturasOpcionaisPreferidas[chavePreferenciaDepende] : undefined;
      const baseAtivo = (prefSalvaDepende === true);
      dependeAtivo = dependeNegado ? !baseAtivo : baseAtivo;
    }
    if(g.tipo === 'grupo-linhas'){
      const idx = ctx ? ctx.n++ : -1;
      const wrapper = document.createElement('div');
      wrapper.className = 'grupo-texto-secao';
      if(idx >= 0) wrapper.dataset.secaoIdx = idx;

      const conteudo = document.createElement('div');
      conteudo.className = 'grupo-texto-conteudo';
      let pAtual = null;
      g.linhas.forEach((no, idxNo) => {
        // Se for a primeira linha ou começar com V. ou R., criamos um novo parágrafo.
        // Se for linha de texto comum e for continuação de frase (começa com minúscula),
        // colocamos no mesmo parágrafo da linha anterior com um espaço ou quebra suave.
        // Caso contrário (linha comum que NÃO é continuação, ex: nova frase/parágrafo
        // que só por acaso não é V./R.), também abre parágrafo novo — sem isso, toda
        // sequência de linhas "livres" (separadas por \n no texto original) virava um
        // parágrafo único colado, ignorando as quebras de linha do texto de origem.
        const ehNovoP = idxNo === 0 || no.classe === 'linha-v' || no.classe === 'linha-r' || !continuacaoDeFrase(no.texto);
        
        if (ehNovoP || !pAtual) {
          pAtual = document.createElement('p');
          if(no.classe) pAtual.className = no.classe;
          conteudo.appendChild(pAtual);
        } else {
          // É uma continuação de linha no mesmo bloco P
          pAtual.appendChild(document.createTextNode(' '));
        }

        criarPartesLinha(no.texto, no.classe).forEach(parte => {
          if(!parte.texto) return;
          if(parte.classe){
            const span = document.createElement('span');
            span.className = parte.classe;
            span.textContent = parte.texto;
            pAtual.appendChild(span);
          }else{
            pAtual.appendChild(document.createTextNode(parte.texto));
          }
        });
      });
      wrapper.appendChild(conteudo);

      if(ctx){
        const btn = criarBtnCheck(idx, ctx);
        wrapper.appendChild(btn);
        ctx.elementos.push({ idx, el: wrapper, btn });
      }
      container.appendChild(wrapper);

    }else if(g.tipo === 'bloco' || g.tipo === 'repetido'){
      const divBloco = document.createElement('div');
      divBloco.className = 'bloco-ref';

      const divTitulo = document.createElement('div');
      divTitulo.className = 'bloco-ref-titulo';

      const icone = document.createElement('span');
      icone.className = 'bloco-ref-icone';
      icone.textContent = '▸';
      divTitulo.appendChild(icone);

      const textoSpan = document.createElement('span');
      textoSpan.className = 'bloco-ref-texto';
      textoSpan.textContent = ' ' + g.rotulo + (g.tipo === 'repetido' ? ` x${g.quantidade}` : '');
      divTitulo.appendChild(textoSpan);

      const divConteudo = document.createElement('div');
      divConteudo.className = 'bloco-ref-conteudo';

      let idx;
      let fileira = null;
      let ctxProprio; // ctx efetivamente "dono" deste nó (usado pro check/idx dele)

      if(g.tipo === 'repetido'){
        // Repetido sempre precisa de identidade própria — usa o ctx local se
        // existir, senão cai para o ctx herdado do repetido mais próximo
        // acima (ctxRepetidoAninhado). Isso garante que um repetido aninhado
        // dentro de outro repetido tenha seu PRÓPRIO idx (e sua própria
        // chave de contas no localStorage), nunca -1 nem compartilhado com o
        // pai. O índice precisa existir ANTES das contas, pois o clique numa
        // conta usa "idx" pra marcar/desmarcar a seção imediatamente.
        // O conteúdo interno (a oração repetida) continua sem checks
        // próprios por linha — o progresso dele é o contador de contas
        // abaixo — mas se esse conteúdo tiver, por sua vez, outro repetido
        // dentro, aquele recebe sua própria identidade do mesmo jeito.
        ctxProprio = ctx || ctxRepetidoAninhado;
        idx = ctxProprio ? ctxProprio.n++ : -1;

        fileira = document.createElement('div');
        fileira.className = 'fileira-contas';
        fileira.addEventListener('click', (e) => e.stopPropagation());

        const chaveContas = `contas_${oracaoAtualId}_${idx}`;
        let contasConcluidas = parseInt(localStorage.getItem(chaveContas) || '0', 10);

        for(let i = 1; i <= g.quantidade; i++){
          const conta = document.createElement('button');
          conta.className = 'conta-terco';
          conta.dataset.contaIdx = i;
          if(i <= contasConcluidas) {
            conta.classList.add('concluida');
          }
          conta.addEventListener('click', (e) => {
            e.stopPropagation();
            const atual = parseInt(conta.dataset.contaIdx, 10);

            if(atual === contasConcluidas){
              contasConcluidas = atual - 1;
            } else {
              contasConcluidas = atual;
            }

            localStorage.setItem(chaveContas, contasConcluidas);

            fileira.querySelectorAll('.conta-terco').forEach(c => {
              const cIdx = parseInt(c.dataset.contaIdx, 10);
              c.classList.toggle('concluida', cIdx <= contasConcluidas);
            });

            if(ctxProprio){
              if(contasConcluidas === g.quantidade){
                marcarSecao(ctxProprio.oracaoId, idx);
              } else {
                desmarcarSecao(ctxProprio.oracaoId, idx);
              }
            }
          });
          fileira.appendChild(conta);
        }
        // Filhos diretos (linhas soltas) continuam sem checks próprios (null),
        // mas ctxProprio segue disponível como ctxRepetidoAninhado para caso
        // haja outro repetido mais interno ainda.
        renderizarNos(g.filhos, divConteudo, null, ctxProprio, oracaoIdAtual);

      }else{
        // Bloco simples (referência sem repetição): renderiza os filhos
        // PRIMEIRO, propagando o mesmo ctx — assim cada linha/sub-bloco
        // interno ganha seu próprio check individual. Só depois alocamos o
        // índice do cabeçalho deste bloco (numeração pós-fixa): como
        // marcarSecao() preenche tudo de 0 até o índice clicado, marcar o
        // cabeçalho do bloco passa a marcar automaticamente tudo que está
        // dentro dele também.
        //
        // ATENÇÃO: quando este bloco está dentro de um bloco REPETIDO, ctx é null
        // (o repetido pai passa ctx=null para seus filhos de propósito — linhas
        // soltas não ganham check próprio). Mas um bloco SIMPLES aninhado dentro
        // de um repetido ainda deve ganhar seu próprio check (ícone de círculo),
        // pois tem conteúdo independente. Nesse caso, usamos ctxRepetidoAninhado
        // como fallback para ctxProprio, garantindo idx e entrada em ctx.elementos.
        ctxProprio = ctx || ctxRepetidoAninhado;
        renderizarNos(g.filhos, divConteudo, ctxProprio, ctxRepetidoAninhado, oracaoIdAtual);
        idx = ctxProprio ? ctxProprio.n++ : -1;
      }

      if(idx >= 0) divBloco.dataset.secaoIdx = idx;
      if(g.colapsarNaFala) divBloco.dataset.colapsarNaFala = '1';

      if(ctxProprio){
        const btn = criarBtnCheck(idx, ctxProprio);
        divTitulo.appendChild(btn);
        ctxProprio.elementos.push({ idx, el: divBloco, btn });
      }

      const divCabecalho = document.createElement('div');
      divCabecalho.className = 'bloco-ref-cabecalho';
      if(fileira) divCabecalho.appendChild(fileira);
      divCabecalho.appendChild(divTitulo);

      divCabecalho.addEventListener('click', (e) => {
        if(e.target.closest('.btn-check-secao') || e.target.closest('.fileira-contas')) return;
        const aberto = divBloco.classList.toggle('aberto');
        icone.textContent = aberto ? '▾' : '▸';
      });

      divBloco.appendChild(divCabecalho);
      divBloco.appendChild(divConteudo);
      container.appendChild(divBloco);

    }else if(g.tipo === 'opcional'){
      // Leitura opcional: citação de outra oração, oculta e fora da fala por
      // padrão. O usuário liga um interruptor para mostrar/ouvir na hora.
      // Essa escolha é lembrada automaticamente (por oração + rótulo da
      // leitura) para a próxima vez que a oração for aberta — ver
      // leiturasOpcionaisPreferidas em state.js.
      //
      // EXCEÇÃO — mistério do dia: se esta oração é "Santo Rosário" e este
      // opcional é um dos 4 mistérios, ele não usa a preferência memorizada
      // comum. Em vez disso vem ativo por padrão só se for o mistério
      // tradicional do dia da semana; uma troca manual do usuário vale
      // apenas para o dia corrente (ver misterioDiaOverride em state.js).
      const tipoMisterio = oracaoIdAtual
        ? obterTipoMisterioDoDiaSeAplicavel(oracaoIdAtual, g.refId)
        : null;

      let chavePreferencia = null;
      let chaveOverrideMisterio = null;
      let preferenciaSalva;

      if(tipoMisterio){
        const hoje = obterDataLocalHoje();
        chaveOverrideMisterio = `${oracaoIdAtual}::${tipoMisterio}`;
        const overrideValidoHoje = misterioDiaOverride && misterioDiaOverride.data === hoje
          ? misterioDiaOverride.valores || {}
          : {};

        if(Object.prototype.hasOwnProperty.call(overrideValidoHoje, chaveOverrideMisterio)){
          preferenciaSalva = overrideValidoHoje[chaveOverrideMisterio];
        }else{
          const tipoDeHoje = MISTERIO_DO_DIA_POR_DIA_SEMANA[new Date().getDay()];
          preferenciaSalva = (tipoMisterio === tipoDeHoje);
        }
      }else{
        chavePreferencia = oracaoIdAtual ? `${oracaoIdAtual}::${g.rotulo}` : null;
        preferenciaSalva = chavePreferencia ? leiturasOpcionaisPreferidas[chavePreferencia] : undefined;
      }

      const divBloco = document.createElement('div');
      divBloco.className = 'bloco-opcional';
      if(preferenciaSalva === true) divBloco.classList.add('aberto');
      
      if(tipoMisterio){
        divBloco.dataset.misterioId = tipoMisterio;
        divBloco.dataset.grupoExclusivo = 'misterio';
      }

      const divTitulo = document.createElement('div');
      divTitulo.className = 'bloco-opcional-titulo';

      const icone = document.createElement('span');
      icone.className = 'bloco-opcional-icone';
      icone.textContent = '📖';
      divTitulo.appendChild(icone);

      const textoSpan = document.createElement('span');
      textoSpan.className = 'bloco-opcional-texto';
      textoSpan.textContent = `Leitura opcional: ${g.rotulo}`;
      divTitulo.appendChild(textoSpan);

      const switchEl = document.createElement('span');
      switchEl.className = 'bloco-opcional-switch';
      switchEl.setAttribute('role', 'switch');
      switchEl.setAttribute('aria-checked', String(preferenciaSalva === true));
      divTitulo.appendChild(switchEl);

      const divConteudo = document.createElement('div');
      divConteudo.className = 'bloco-opcional-conteudo';
      // Conteúdo opcional recebe o mesmo ctx do pai — assim as orações
      // dentro de um bloco opcional (ex: Pai Nosso, Ave Maria, Glória dentro
      // de um mistério do Rosário) ganham check buttons e têm o progresso
      // rastreado normalmente. O bloco opcional em si não ganha check próprio
      // (não é obrigatório para concluir a oração), mas seu conteúdo sim.
      // oracaoIdAtual continua propagado para que leituras opcionais aninhadas
      // (ex: meditação de mistério dentro de outro opcional) encontrem suas
      // preferências salvas corretamente.
      renderizarNos(g.filhos, divConteudo, ctx, ctxRepetidoAninhado, oracaoIdAtual);

      divTitulo.addEventListener('click', () => {
        const ativo = divBloco.classList.toggle('aberto');
        switchEl.setAttribute('aria-checked', String(ativo));

        if(chaveOverrideMisterio){
          // Mistério do dia: a troca vale só para hoje. Se o override salvo
          // for de um dia diferente, começa um objeto novo (descarta o
          // antigo) antes de gravar a escolha de hoje.
          const hoje = obterDataLocalHoje();
          if(!misterioDiaOverride || misterioDiaOverride.data !== hoje){
            misterioDiaOverride = { data: hoje, valores: {} };
          }

          if(ativo){
            // Comportamento exclusivo: se ativou este mistério, fecha os outros
            const containerRaiz = divBloco.closest('#rezar-texto') || document.body;
            containerRaiz.querySelectorAll('.bloco-opcional[data-grupo-exclusivo="misterio"]').forEach(outroBloco => {
              if(outroBloco !== divBloco && outroBloco.classList.contains('aberto')){
                outroBloco.classList.remove('aberto');
                const outroSwitch = outroBloco.querySelector('.bloco-opcional-switch');
                if(outroSwitch) outroSwitch.setAttribute('aria-checked', 'false');
                
                const outroMisterio = outroBloco.dataset.misterioId;
                if(outroMisterio){
                  misterioDiaOverride.valores[`${oracaoIdAtual}::${outroMisterio}`] = false;
                }
              }
            });
          }

          misterioDiaOverride.valores[chaveOverrideMisterio] = ativo;
          salvarMisterioDiaOverride();
        }else if(chavePreferencia){
          leiturasOpcionaisPreferidas[chavePreferencia] = ativo;
          salvarLeiturasOpcionaisPreferidas();

          // Atualiza visibilidade de todos os blocos condicionais {depende:} que
          // dependem deste opcional (mesmo nome de rótulo, mesma oração raiz).
          const containerRaizDepende = divBloco.closest('#rezar-texto') || divBloco.closest('.bloco-opcional-conteudo') || document.body;
          containerRaizDepende.querySelectorAll('[data-depende-rotulo]').forEach(elDep => {
            if (elDep.dataset.dependeRotulo === g.rotulo &&
                (!oracaoIdAtual || elDep.dataset.dependeOracaoId === String(oracaoIdAtual))) {
              const negado = elDep.dataset.dependeNegado === '1';
              const mostrar = negado ? !ativo : ativo;
              elDep.style.display = mostrar ? '' : 'none';
            }
          });

          if(localStorage.getItem(CHAVE_DICA_LEITURA_OPCIONAL_MOSTRADA) !== '1'){
            localStorage.setItem(CHAVE_DICA_LEITURA_OPCIONAL_MOSTRADA, '1');
            if(typeof mostrarToast === 'function'){
              mostrarToast('Preferência salva — essa leitura vai continuar assim da próxima vez.');
            }
          }
        }
      });

      divBloco.appendChild(divTitulo);
      divBloco.appendChild(divConteudo);
      container.appendChild(divBloco);

    }else if(g.tipo === 'link'){
      const divLink = document.createElement('div');
      divLink.className = 'link-marcador';

      const anchor = document.createElement('a');
      anchor.className = 'link-marcador-anchor';
      anchor.href = g.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.title = g.url;

      const icone = document.createElement('span');
      icone.className = 'link-marcador-icone';
      icone.textContent = '🔗';
      anchor.appendChild(icone);

      const texto = document.createElement('span');
      texto.className = 'link-marcador-texto';
      texto.textContent = g.url;
      anchor.appendChild(texto);

      divLink.appendChild(anchor);
      container.appendChild(divLink);

    }else if(g.tipo === 'pausa'){
      const divPausa = document.createElement('div');
      divPausa.className = 'pausa-marcador';
      divPausa.dataset.segundos = g.segundos;
      divPausa.title = `Pausa de ${g.segundos}s`;
      divPausa.textContent = '· · ·';
      container.appendChild(divPausa);

    }else if(g.tipo === 'erro'){
      const p = document.createElement('p');
      p.className = 'linha-ref';
      p.style.opacity = '0.6';
      p.textContent = g.texto;
      container.appendChild(p);
    }

    // Tagging de dependência: aplica ao último elemento adicionado ao container
    if (dependeRotulo && container.lastElementChild) {
      const elDep = container.lastElementChild;
      elDep.dataset.dependeRotulo = dependeRotulo;
      if (oracaoIdAtual) elDep.dataset.dependeOracaoId = oracaoIdAtual;
      if (dependeNegado) elDep.dataset.dependeNegado = '1';
      if (!dependeAtivo) elDep.style.display = 'none';
    }
  });
}

// renderizarTextoRezar (glue específica da tela do usuário: decide o ctx a
// partir de oracaoAtualId, atualiza secaoCtxAtual, chama atualizarVisuaisProgresso)
// → js/app.js. A parte pura e compartilhada com o preview do admin
// (montar a árvore + jogar no container) é renderizarTextoNaTela, em
// js/rezar-core.js (Etapa 2 do PLANO-UNIFICACAO-TELA-REZAR.md).

// ===================== MARCAÇÃO DE PROGRESSO POR SEÇÃO =====================

// Acha o índice do bloco-pai DIRETO de um elemento (o bloco-ref mais próximo
// que tenha seu próprio check, ou seja, dataset.secaoIdx definido). Usado
// para sincronizar o check do título do bloco com os checks das linhas
// internas (ex: "Pai Nosso", "Glória ao Pai").
function encontrarIdxPaiDireto(el){
  let pai = el.parentElement;
  while(pai && pai.id !== 'rezar-texto'){
    if(pai.classList.contains('bloco-ref') && pai.dataset.secaoIdx !== undefined && pai.dataset.secaoIdx !== ''){
      return parseInt(pai.dataset.secaoIdx, 10);
    }
    pai = pai.parentElement;
  }
  return null;
}

// Depois de marcar uma linha/bloco como concluído, verifica se isso
// completou TODOS os irmãos diretos de algum bloco-pai (ex: todas as linhas
// de "Pai Nosso") — se sim, marca o título do bloco-pai também, subindo
// recursivamente caso haja mais níveis aninhados.
function tentarMarcarBlocosPaiAutomaticamente(oracaoId, idxAlterado){
  if(!secaoCtxAtual || secaoCtxAtual.oracaoId !== oracaoId) return false;
  const elementos = secaoCtxAtual.elementos;
  let entradaAtual = elementos.find(e => e.idx === idxAlterado);
  if(!entradaAtual) return false;

  let mudou = false;

  while(entradaAtual){
    const idxPai = encontrarIdxPaiDireto(entradaAtual.el);
    if(idxPai == null) break;
    const entradaPai = elementos.find(e => e.idx === idxPai);
    if(!entradaPai) break;

    const concluidas = new Set(progressoLeitura[oracaoId] || []);
    if(concluidas.has(idxPai)){
      entradaAtual = entradaPai;
      continue; // pai já marcado, mas tenta subir mais um nível
    }

    const filhosDiretos = elementos.filter(e => e.idx !== idxPai && encontrarIdxPaiDireto(e.el) === idxPai);
    const todosConcluidos = filhosDiretos.length > 0 && filhosDiretos.every(f => concluidas.has(f.idx));
    if(!todosConcluidos) break;

    concluidas.add(idxPai);
    progressoLeitura[oracaoId] = [...concluidas].sort((a,b) => a-b);
    mudou = true;
    entradaAtual = entradaPai;
  }

  if(mudou) salvarProgressoLeitura();
  return mudou;
}

// Inverso da função acima: ao desmarcar uma linha, se o bloco-pai estava
// marcado como concluído, ele deixa de estar (já que nem todas as linhas
// internas estão mais concluídas), e isso sobe pelos níveis aninhados.
function tentarDesmarcarBlocosPaiAutomaticamente(oracaoId, idxAlterado){
  if(!secaoCtxAtual || secaoCtxAtual.oracaoId !== oracaoId) return false;
  const elementos = secaoCtxAtual.elementos;
  let entradaAtual = elementos.find(e => e.idx === idxAlterado);
  if(!entradaAtual) return false;

  let mudou = false;

  while(entradaAtual){
    const idxPai = encontrarIdxPaiDireto(entradaAtual.el);
    if(idxPai == null) break;
    const entradaPai = elementos.find(e => e.idx === idxPai);
    if(!entradaPai) break;

    const concluidas = new Set(progressoLeitura[oracaoId] || []);
    if(!concluidas.has(idxPai)) break; // pai já não estava marcado, nada a propagar

    concluidas.delete(idxPai);
    progressoLeitura[oracaoId] = [...concluidas].sort((a,b) => a-b);
    mudou = true;
    entradaAtual = entradaPai;
  }

  if(mudou) salvarProgressoLeitura();
  return mudou;
}

function marcarSecao(oracaoId, idx){
  if(!progressoLeitura[oracaoId]) progressoLeitura[oracaoId] = [];
  const set = new Set(progressoLeitura[oracaoId]);
  for(let i = 0; i <= idx; i++) set.add(i);
  progressoLeitura[oracaoId] = [...set].sort((a,b) => a-b);
  salvarProgressoLeitura();
  tentarMarcarBlocosPaiAutomaticamente(oracaoId, idx);
  if(secaoCtxAtual && secaoCtxAtual.oracaoId === oracaoId){
    atualizarVisuaisProgresso(oracaoId, secaoCtxAtual.elementos);
    
    // Auto-expande a PRÓXIMA seção ainda não rezada ao marcar manualmente —
    // mas NUNCA durante o modo de fala (quando falando=true), pois o motor
    // de fala já gerencia a abertura dos acordeões por conta própria e uma
    // segunda chamada a expandirParaElemento causaria conflito, fechando blocos
    // que a fala está tentando exibir e disparando progressos fora de ordem.
    const modoFalaAtivo = typeof falando !== 'undefined' && falando;
    if (!modoFalaAtivo) {
      const setAtualizado = new Set(progressoLeitura[oracaoId]);
      const proximoItem = secaoCtxAtual.elementos.find(e => !setAtualizado.has(e.idx));
      if (proximoItem && typeof expandirParaElemento === 'function') {
        // expandirParaElemento abre apenas os ANCESTRAIS de el (sobe pelo parentElement).
        // Se o próprio proximoItem.el é um bloco-ref (oração composta), ele não seria
        // incluído nos ancestrais — precisamos passar um filho interno para que
        // o bloco seja tratado como ancestral e aberto.
        const elAlvo = proximoItem.el;
        const elParaExpandir = elAlvo.classList && elAlvo.classList.contains('bloco-ref')
          ? (elAlvo.querySelector('.bloco-ref-conteudo') || elAlvo)
          : elAlvo;
        expandirParaElemento(elParaExpandir);
      }
    }
  }
  // Se essa marcação completou a oração inteira (mesmo critério usado pela
  // fala para saber que terminou), marca "rezada hoje" também — ver
  // verificarConclusaoTotalEMarcarRezada em js/speech.js.
  if(typeof verificarConclusaoTotalEMarcarRezada === 'function'){
    verificarConclusaoTotalEMarcarRezada(oracaoId);
  }
}


function desmarcarSecao(oracaoId, idx){
  if(!progressoLeitura[oracaoId]) return;
  const set = new Set(progressoLeitura[oracaoId]);
  set.delete(idx);
  progressoLeitura[oracaoId] = [...set].sort((a,b) => a-b);
  salvarProgressoLeitura();
  tentarDesmarcarBlocosPaiAutomaticamente(oracaoId, idx);
  if(secaoCtxAtual && secaoCtxAtual.oracaoId === oracaoId){
    atualizarVisuaisProgresso(oracaoId, secaoCtxAtual.elementos);
  }
}

function limparProgressoLeitura(){
  if(!oracaoAtualId) return;
  delete progressoLeitura[oracaoAtualId];
  salvarProgressoLeitura();

  limparContasDoId(oracaoAtualId); // js/rezar-core.js

  // Zera visualmente todas as contas (bolinhas) na DOM — limparContasDoId
  // apaga só o localStorage, mas os elementos .conta-terco já renderizados
  // precisam perder a classe 'concluida' para deixar de aparecer verdes.
  document.querySelectorAll('#rezar-texto .conta-terco').forEach(c => {
    c.classList.remove('concluida');
  });

  if(secaoCtxAtual && secaoCtxAtual.oracaoId === oracaoAtualId){
    atualizarVisuaisProgresso(oracaoAtualId, secaoCtxAtual.elementos);
  }
  mostrarToast('Progresso de leitura reiniciado.');
}

function atualizarVisuaisProgresso(oracaoId, elementos){
  if(!elementos) return;
  const concluidas = new Set(progressoLeitura[oracaoId] || []);
  elementos.forEach(({ idx, el, btn }) => {
    const marcada = concluidas.has(idx);
    el.classList.toggle('secao-concluida', marcada);
    btn.classList.toggle('ativo', marcada);
    btn.title = marcada ? 'Desmarcar' : 'Marcar como rezada';

    // Busca apenas a fileira de contas direta deste bloco (não de filhos aninhados)
    const fileira = el.querySelector(':scope > .bloco-ref-cabecalho > .fileira-contas');
    if(fileira) {
      const chaveContas = `contas_${oracaoId}_${idx}`;
      if (marcada) {
        fileira.querySelectorAll('.conta-terco').forEach(c => {
          c.classList.add('concluida');
        });
      } else {
        const contasConcluidas = parseInt(localStorage.getItem(chaveContas) || '0', 10);
        fileira.querySelectorAll('.conta-terco').forEach(c => {
          const cIdx = parseInt(c.dataset.contaIdx, 10);
          c.classList.toggle('concluida', cIdx <= contasConcluidas);
        });
      }
    }
  });
}

// Acha o bloco-ref ancestral mais próximo que está marcado como "não abrir
// na fala" E que esteja fechado no momento (se o usuário abriu manualmente
// pra acompanhar o texto, respeita e não redireciona o destaque).
function encontrarBlocoColapsadoNaFala(el){
  let pai = el.parentElement;
  while(pai && pai.id !== 'rezar-texto'){
    if(pai.classList.contains('bloco-ref') && pai.dataset.colapsarNaFala === '1' && !pai.classList.contains('aberto')){
      return pai;
    }
    pai = pai.parentElement;
  }
  return null;
}

function expandirParaElemento(el){
  const ancestrais = new Set();
  let pai = el.parentElement;
  while(pai && pai.id !== 'rezar-texto'){
    if(pai.classList.contains('bloco-ref') && pai.dataset.colapsarNaFala !== '1'){
      ancestrais.add(pai);
    }
    pai = pai.parentElement;
  }

  document.querySelectorAll('#rezar-texto .bloco-ref').forEach(bloco => {
    // Orações marcadas como "já conhecidas" (ex: Ave Maria) ficam fora do
    // controle automático da fala — o estado aberto/fechado é só manual.
    if(bloco.dataset.colapsarNaFala === '1') return;

    const deveAbrir = ancestrais.has(bloco);
    const estaAberto = bloco.classList.contains('aberto');

    if (deveAbrir && !estaAberto) {
      bloco.classList.add('aberto');
      const icone = bloco.querySelector(':scope > .bloco-ref-titulo > .bloco-ref-icone');
      if(icone) icone.textContent = '▾';
    } else if (!deveAbrir && estaAberto) {
      bloco.classList.remove('aberto');
      const icone = bloco.querySelector(':scope > .bloco-ref-titulo > .bloco-ref-icone');
      if(icone) icone.textContent = '▸';
    }
  });
}
