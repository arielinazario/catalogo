/* NAZA Camisas · loja online (conta do cliente, checkout, Pix e Mercado Pago)
   Carregado depois do script principal do index.html. Usa as funções globais de lá
   (cart, acha, nomeItem, adicTam, PERS, cupom, aplicaCupom, openSheet, closeSheet, toast, render...).
   Segurança: o navegador só usa a chave PÚBLICA do Supabase. Preço, estoque e total
   são recalculados no servidor (função "loja"); o token do Mercado Pago fica só lá. */
(function(){
"use strict";
const SB_URL = "https://woltxsjfktntwdxlolrp.supabase.co";
const SB_KEY = "sb_publishable_WdqvGyQJQ8taq_kS6TIgKw_QbGNCUVe";
const SITE = location.origin + location.pathname;
// identificação da loja (Decreto 7.962/2013)
const LOJA_ID = "Ariéli Nazário · CPF 113.881.769-47 · Criciúma/SC · WhatsApp (48) 99124-5814 · Instagram @arielinazario";
if(!window.supabase || !window.supabase.createClient){
  console.warn("Supabase não carregou; loja online desativada.");
  const ta = document.getElementById("topActs");
  if(ta){ ta.innerHTML = `<button type="button" class="tbtn" id="ljOff">Entrar</button>`;
    document.getElementById("ljOff").addEventListener("click", () => alert("Não foi possível carregar a loja agora. Recarregue a página ou fale com a gente no WhatsApp.")); }
  return;
}
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

let user = null, cli = null, CFG = { loja: {}, pix: {} }, depoisLogin = null, pagamento = "mercadopago";
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const TAMS = ["PP","P","M","G","GG","XGG","XXGG"];
const ST = {
  aguardando_pagamento: ["Aguardando pagamento","warn"], pagamento_em_analise: ["Pagamento em análise","warn"],
  pago: ["Pago","good"], em_producao: ["Em produção","good"], a_caminho: ["A caminho do Brasil","good"],
  aguardando_imposto: ["Na alfândega","warn"], postado: ["Postado","good"], entregue: ["Entregue","good"],
  cancelado: ["Cancelado","bad"], reembolsado: ["Reembolsado","bad"]
};
const AS_ST = { aguardando_pagamento: ["Aguardando pagamento","warn"], ativo: ["Ativa","good"], pausado: ["Pausada","warn"], cancelado: ["Cancelada","bad"] };
const dBR = s => s ? new Date(s).toLocaleDateString("pt-BR") : "";
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
const temPatchOnline = () => CFG.loja.patchPreco !== null && CFG.loja.patchPreco !== undefined;
const semAc = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const contaPatches = t => String(t || "").split(/\s*(?:,|\+|;|\/|\s+e\s+)\s*/i).map(x => x.trim()).filter(Boolean).length;
const valorPatch = t => t && temPatchOnline() ? Number(CFG.loja.patchPreco) * contaPatches(t) : 0;
const naRegiao = c => !!(c && semAc(c.uf) === semAc(CFG.loja.freteGratisUF || "SC") && (CFG.loja.freteGratisCidades || []).map(semAc).includes(semAc(c.cidade)));
// mesmo cálculo do servidor; null = ainda sem endereço
const frete = base => { if(!user || !perfilOk(cli)) return null; if(naRegiao(cli)) return 0; if(CFG.loja.freteGratisAcima != null && base >= Number(CFG.loja.freteGratisAcima)) return 0; return Number(CFG.loja.freteFixo || 0); };
const regraFrete = () => `Grátis para Criciúma e região${CFG.loja.freteGratisAcima != null ? ` e para pedidos a partir de ${brl(CFG.loja.freteGratisAcima)}` : ""}${CFG.loja.freteFixo ? `; demais: ${brl(CFG.loja.freteFixo)}` : ""}.`;
const perfilOk = c => !!(c && c.nome && c.whatsapp && c.cep && c.endereco && c.numero && c.bairro && c.cidade && c.uf);

/* ---------- estilos ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.acct{color:#FFFFFF;font-size:13px;font-weight:700;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12);border-radius:999px;padding:6px 12px;white-space:nowrap;cursor:pointer;margin-right:6px}
.lj-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--surface2);border-radius:12px;padding:4px;margin:4px 0 10px}
.lj-tabs button{border:0;background:none;border-radius:9px;padding:9px;font-weight:700;color:var(--muted);cursor:pointer}
.lj-tabs button[aria-pressed="true"]{background:var(--wine);color:var(--on-wine)}
.lj-g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lj-g3{display:grid;grid-template-columns:2fr 1fr;gap:8px}
.lj-pay{display:grid;gap:8px;margin-top:4px}
.lj-pay label{display:flex;gap:10px;align-items:flex-start;border:1.5px solid var(--line);border-radius:12px;padding:11px 12px;cursor:pointer;background:var(--surface)}
.lj-pay label:has(input:checked){border-color:var(--wine);background:var(--wine-soft)}
.lj-pay b{display:block;font-size:14.5px}.lj-pay small{color:var(--muted);font-size:12.5px}
.lj-box{border:1px solid var(--line);border-radius:12px;padding:11px 12px;margin-top:8px;background:var(--surface)}
.lj-box .r{display:flex;justify-content:space-between;gap:8px;align-items:center}
.lj-chip{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:3px 8px;background:var(--surface2);color:var(--muted)}
.lj-chip.good{background:#E3F1E4;color:#1F6B2A}.lj-chip.warn{background:#FBEFD8;color:#8A5A00}.lj-chip.bad{background:#F6DADA;color:#9B1C1C}
.lj-ped{border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;background:var(--surface)}
.lj-ped .t{font-weight:800}.lj-ped .d{font-size:13px;color:var(--muted);margin-top:3px}
.lj-tl{margin:8px 0 0;padding:0;list-style:none;font-size:12.5px;color:var(--muted)}
.lj-tl li{padding:3px 0 3px 14px;position:relative}.lj-tl li:before{content:"";position:absolute;left:2px;top:9px;width:6px;height:6px;border-radius:50%;background:var(--wine)}
.lj-pix{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;background:var(--surface2);border-radius:10px;padding:10px;margin-top:6px}
.lj-chk{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:var(--muted);margin-top:12px}.lj-chk input{margin-top:3px}
.lj-err{color:#9B1C1C;font-size:13px;font-weight:600;margin-top:8px}
.pgconta{padding:10px 0 24px}
.pgtop{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.pgconta h2{font-family:var(--display);font-weight:800;font-size:clamp(26px,6vw,34px);text-transform:uppercase;letter-spacing:.02em;margin:2px 0 12px}
.pgvolta{background:none;border:0;color:var(--wine);font-weight:700;cursor:pointer;padding:8px 0;font-size:14.5px}
.pgconta .lbl{margin-top:22px}
@media(min-width:760px){.pgconta .lj-ped,.pgconta .lj-box{max-width:760px}}
.lj-sp{height:10px}.lj-link{background:none;border:0;color:var(--wine);font-weight:700;cursor:pointer;padding:0;text-decoration:underline}
</style>`);

/* ---------- utilidades ---------- */
async function api(acao, body){
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(SB_URL + "/functions/v1/loja", { method: "POST",
    headers: { "Content-Type": "application/json", apikey: SB_KEY, Authorization: "Bearer " + (session ? session.access_token : "") },
    body: JSON.stringify({ acao, ...body }) });
  const d = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(d.erro || "Não foi possível concluir. Tente de novo.");
  return d;
}
function ocupado(btn, on, txt){ if(!btn) return; if(on){ btn.dataset.t = btn.textContent; btn.textContent = txt || "Aguarde…"; btn.disabled = true; } else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; } }
function erro(msg){ const b = document.querySelector("#sheetBody .lj-err"); if(b) b.textContent = msg; else toast(msg); }

async function carregarConfig(){
  const { data } = await sb.from("config").select("chave,valor");
  (data || []).forEach(c => CFG[c.chave] = c.valor || {});
}
async function carregarCliente(){
  if(!user){ cli = null; return; }
  const { data } = await sb.from("clientes").select("*").eq("id", user.id).maybeSingle();
  cli = data;
}
function atualizarBotao(){
  const b = document.getElementById("ljAcct"); if(!b) return;
  b.textContent = user ? "Minha conta" : "Entrar";
  const c = document.getElementById("ljCriar"); if(c) c.hidden = !!user;
}

/* ---------- Pix copia e cola (BR Code estático com valor) ---------- */
function crc16(s){ let c = 0xFFFF; for(let i = 0; i < s.length; i++){ c ^= s.charCodeAt(i) << 8; for(let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, "0"); }
const tlv = (id, v) => id + String(v.length).padStart(2, "0") + v;
const semAcento = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase();
function pixCopiaCola(valor, txid){
  const P = CFG.pix || {}; let chave = String(P.chave || "").trim();
  if(P.tipo === "telefone"){ const d = chave.replace(/\D/g, ""); chave = "+" + (d.startsWith("55") ? d : "55" + d); }
  if(P.tipo === "cpf" || P.tipo === "cnpj") chave = chave.replace(/\D/g, "");
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", chave);
  let p = tlv("00", "01") + tlv("26", mai) + tlv("52", "0000") + tlv("53", "986") + tlv("54", Number(valor).toFixed(2)) + tlv("58", "BR")
        + tlv("59", semAcento(P.titular || "NAZA CAMISAS").slice(0, 25)) + tlv("60", semAcento(P.cidade || "FLORIANOPOLIS").slice(0, 15))
        + tlv("62", tlv("05", semAcento(txid).replace(/ /g, "").slice(0, 25) || "***"));
  p += "6304"; return p + crc16(p);
}

/* ---------- conta: entrar / criar conta / senha ---------- */
function abrirLogin(modo, depois){
  if(depois) depoisLogin = depois;
  modo = modo || "entrar";
  openSheet(modo === "senha" ? "Recuperar senha" : "Sua conta NAZA", `
    ${modo === "senha" ? "" : `<div class="lj-tabs"><button type="button" data-lj-modo="entrar" aria-pressed="${modo==="entrar"}">Entrar</button><button type="button" data-lj-modo="criar" aria-pressed="${modo==="criar"}">Criar conta</button></div>
    <div class="note" style="margin-top:0">${modo === "criar" ? "Com a conta você compra direto pelo site e acompanha todos os seus pedidos." : "Entre para finalizar a compra e acompanhar seus pedidos."}</div>`}
    <span class="lbl">E-mail</span><input class="in" id="ljEmail" type="email" autocomplete="email" inputmode="email" placeholder="seuemail@exemplo.com" style="text-transform:none">
    ${modo === "senha" ? `<div class="note">Enviaremos um link para você criar uma senha nova.</div>` : `<span class="lbl">Senha</span><input class="in" id="ljSenha" type="password" autocomplete="${modo==="criar"?"new-password":"current-password"}" placeholder="${modo==="criar"?"Mínimo de 8 caracteres":"Sua senha"}" style="text-transform:none">`}
    ${modo === "criar" ? `<label class="lj-chk"><input type="checkbox" id="ljTermos"><span>Concordo que a NAZA guarde meus dados (nome, contato e endereço) para entregar meus pedidos e falar comigo sobre eles.</span></label>` : ""}
    <div class="lj-err"></div><div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljGo">${modo === "criar" ? "Criar minha conta" : modo === "senha" ? "Enviar link" : "Entrar"}</button>
    ${modo === "entrar" ? `<div style="text-align:center;margin-top:12px"><button type="button" class="lj-link" data-lj-modo="senha">Esqueci minha senha</button></div>` : ""}
    ${modo === "senha" ? `<div style="text-align:center;margin-top:12px"><button type="button" class="lj-link" data-lj-modo="entrar">Voltar</button></div>` : ""}`);
  document.getElementById("ljGo").addEventListener("click", async e => {
    const email = val("ljEmail").toLowerCase(), senha = (document.getElementById("ljSenha") || {}).value || "";
    if(!/^\S+@\S+\.\S+$/.test(email)) return erro("Digite um e-mail válido.");
    ocupado(e.currentTarget, true);
    try {
      if(modo === "senha"){
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE + "#nova-senha" });
        if(error) throw error; erro(""); toast("Se o e-mail tiver conta, o link chega em instantes."); closeSheet(); return;
      }
      if(senha.length < (modo === "criar" ? 8 : 1)) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if(modo === "criar"){
        if(!document.getElementById("ljTermos").checked) throw new Error("Marque a concordância para criar a conta.");
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: SITE + "#minha-conta" } });
        if(error) throw error;
        if(!data.session){ closeSheet(); openSheet("Confirme seu e-mail", `<p>Enviamos um link de confirmação para <b>${esc(email)}</b>. Abra o e-mail, toque no link e depois volte aqui para entrar.</p><div class="note">Não chegou? Confira a caixa de spam.</div><div class="lj-sp"></div><button type="button" class="btn ghost" data-close>Ok</button>`); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if(error) throw new Error(/confirm/i.test(error.message) ? "Confirme seu e-mail pelo link que enviamos antes de entrar." : "E-mail ou senha incorretos.");
      }
    } catch(err){ erro(traduz(err)); ocupado(e.currentTarget, false); return; }
  });
}
function traduz(err){
  const m = String(err && err.message || err || "");
  if(/already registered|already been registered/i.test(m)) return "Esse e-mail já tem conta. Use a aba Entrar.";
  if(/rate limit/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if(/password/i.test(m) && /weak|short|least/i.test(m)) return "Escolha uma senha mais forte (8+ caracteres).";
  return m || "Algo deu errado. Tente de novo.";
}
function abrirNovaSenha(){
  openSheet("Criar nova senha", `<span class="lbl">Nova senha</span><input class="in" id="ljNova" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres" style="text-transform:none">
    <div class="lj-err"></div><div class="lj-sp"></div><button type="button" class="btn pri" id="ljSalvaSenha">Salvar senha</button>`);
  document.getElementById("ljSalvaSenha").addEventListener("click", async e => {
    const s = val("ljNova"); if(s.length < 8) return erro("A senha precisa ter pelo menos 8 caracteres.");
    ocupado(e.currentTarget, true);
    const { error } = await sb.auth.updateUser({ password: s });
    if(error){ ocupado(e.currentTarget, false); return erro(traduz(error)); }
    history.replaceState(null, "", location.pathname); toast("Senha alterada."); abrirConta();
  });
}

/* ---------- meus dados (endereço de entrega) ---------- */
function abrirDados(depois){
  const c = cli || {};
  openSheet("Meus dados de entrega", `
    <span class="lbl">Nome completo</span><input class="in" id="ljNome" autocomplete="name" value="${esc(c.nome)}" style="text-transform:none">
    <div class="lj-g2"><div><span class="lbl">WhatsApp</span><input class="in" id="ljWa" inputmode="tel" autocomplete="tel" value="${esc(c.whatsapp)}" placeholder="(48) 99999-9999"></div>
    <div><span class="lbl">CEP</span><input class="in" id="ljCep" inputmode="numeric" autocomplete="postal-code" value="${esc(c.cep)}" placeholder="00000-000"></div></div>
    <span class="lbl">Rua / avenida</span><input class="in" id="ljEnd" autocomplete="address-line1" value="${esc(c.endereco)}" style="text-transform:none">
    <div class="lj-g2"><div><span class="lbl">Número</span><input class="in" id="ljNum" value="${esc(c.numero)}"></div>
    <div><span class="lbl">Complemento</span><input class="in" id="ljComp" autocomplete="address-line2" value="${esc(c.complemento)}" placeholder="Apto, bloco…" style="text-transform:none"></div></div>
    <span class="lbl">Bairro</span><input class="in" id="ljBairro" value="${esc(c.bairro)}" style="text-transform:none">
    <div class="lj-g3"><div><span class="lbl">Cidade</span><input class="in" id="ljCid" autocomplete="address-level2" value="${esc(c.cidade)}" style="text-transform:none"></div>
    <div><span class="lbl">UF</span><select class="in" id="ljUf"><option value=""></option>${UFS.map(u => `<option ${c.uf===u?"selected":""}>${u}</option>`).join("")}</select></div></div>
    <div class="lj-g2"><div><span class="lbl">Tamanho que veste</span><select class="in" id="ljTam"><option value="">—</option>${TAMS.map(t => `<option ${c.tamanho===t?"selected":""}>${t}</option>`).join("")}</select></div>
    <div><span class="lbl">Time do coração</span><input class="in" id="ljTime" value="${esc(c.time_coracao)}" style="text-transform:none"></div></div>
    <div class="lj-err"></div><div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljSalvar">${depois ? "Salvar e continuar" : "Salvar"}</button>`);
  const cep = document.getElementById("ljCep");
  cep.addEventListener("input", async () => {
    const d = cep.value.replace(/\D/g, "").slice(0, 8); cep.value = d.length > 5 ? d.slice(0,5) + "-" + d.slice(5) : d;
    if(d.length !== 8) return;
    try { const r = await fetch("https://viacep.com.br/ws/" + d + "/json/"); const j = await r.json(); if(j.erro) return;
      if(!val("ljEnd")) document.getElementById("ljEnd").value = j.logradouro || "";
      if(!val("ljBairro")) document.getElementById("ljBairro").value = j.bairro || "";
      document.getElementById("ljCid").value = j.localidade || ""; document.getElementById("ljUf").value = j.uf || "";
      document.getElementById(val("ljEnd") ? "ljNum" : "ljEnd").focus();
    } catch(e){}
  });
  document.getElementById("ljSalvar").addEventListener("click", async e => {
    const d = { id: user.id, nome: val("ljNome"), whatsapp: val("ljWa"), cep: val("ljCep"), endereco: val("ljEnd"), numero: val("ljNum"),
      complemento: val("ljComp"), bairro: val("ljBairro"), cidade: val("ljCid"), uf: val("ljUf"), tamanho: val("ljTam"), time_coracao: val("ljTime"),
      atualizado_em: new Date().toISOString() };
    if(!cli) d.aceite_termos_em = new Date().toISOString();
    if(d.nome.split(" ").filter(Boolean).length < 2) return erro("Informe nome e sobrenome.");
    if(d.whatsapp.replace(/\D/g, "").length < 10) return erro("Informe o WhatsApp com DDD.");
    if(d.cep.replace(/\D/g, "").length !== 8) return erro("CEP inválido.");
    if(!d.endereco || !d.numero || !d.bairro || !d.cidade || !d.uf) return erro("Preencha o endereço completo.");
    ocupado(e.currentTarget, true);
    const { error } = await sb.from("clientes").upsert(d);
    if(error){ ocupado(e.currentTarget, false); return erro("Não foi possível salvar. Tente de novo."); }
    await carregarCliente(); toast("Dados salvos.");
    if(depois) depois(); else abrirConta();
  });
}

/* ---------- checkout ---------- */
const linhaTotal = c => (Number((acha(c.id) || {}).preco) || 0) + adicTam(c.tamanho) + ((c.persNome || c.persNum) ? PERS : 0) + valorPatch(c.patch);
function abrirCheckout(){
  if(!cart.length){ closeSheet(); return; }
  const encomenda = tipoCarrinho() !== "estoque";
  const sub = cart.reduce((a, c) => a + linhaTotal(c), 0);
  const desc = cupomOk() ? Math.round(sub * cupomPct(cupom)) / 100 : 0;
  const fr = frete(sub - desc); const tot = sub - desc + (fr || 0);
  const pixOn = !!(CFG.pix && CFG.pix.ativo && CFG.pix.chave);
  if(!pixOn) pagamento = "mercadopago";
  openSheet("Finalizar compra", `
    <div>${cart.map((c, k) => { const i = acha(c.id) || {}; return `<div class="line">${i.foto ? `<img src="${esc(i.foto)}" alt="">` : `<span class="noimg"></span>`}
      <div><div class="t">${esc(nomeItem(i))}</div><div class="d">${esc(c.tamanho ? "Tam. " + c.tamanho : "")}${encomenda ? " · sob encomenda" : " · pronta entrega"}</div>${adicTam(c.tamanho) ? `<div class="d">+ Adicional de tamanho · ${brl(adicTam(c.tamanho))}</div>` : ""}${(c.persNome||c.persNum) ? `<div class="d">+ Personalização ${esc([c.persNome, c.persNum].filter(Boolean).join(" "))} · ${brl(PERS)}</div>` : ""}${c.patch ? `<div class="d">+ Patch ${esc(c.patch)}${temPatchOnline() ? " · " + brl(valorPatch(c.patch)) : ""}</div>` : ""}</div>
      <div class="r"><span class="pr">${brl(linhaTotal(c))}</span><button type="button" class="rm" data-rm="${k}">Remover</button></div></div>`; }).join("")}</div>
    ${encomenda ? `<span class="lbl">Indicação (opcional)</span><input class="in" id="cInd" autocomplete="off" value="${esc(perfil.indicacao||"")}" placeholder="Nome de quem te indicou">` : ""}
    <span class="lbl">Cupom de desconto</span>
    <div class="cup"><input class="in" id="cCup" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Digite seu cupom" value="${esc(cupom)}"><button type="button" id="aplicaCup">Aplicar</button></div>
    ${cupomMsg ? `<div class="cupmsg ${cupomOk() ? "ok" : "no"}">${esc(cupomMsg)}</div>` : ""}
    <div class="tot"><span>Subtotal</span><span class="desc">${brl(sub)}</span></div>
    ${desc ? `<div class="tot" style="border:0;padding-top:0;margin-top:4px"><span class="desc">Desconto do cupom (${cupomPct(cupom)}%)</span><span class="desc">− ${brl(desc)}</span></div>` : ""}
    <div class="tot" style="border:0;padding-top:0;margin-top:4px"><span class="desc">Frete</span><span class="desc">${fr === null ? "calculado no endereço" : fr ? brl(fr) : "Grátis"}</span></div>${fr === null || fr ? `<div class="note" style="margin-top:2px">${regraFrete()}</div>` : ""}
    <div class="tot" style="border:0;padding-top:0;margin-top:4px"><span>Total</span><b>${brl(tot)}</b></div>
    <span class="lbl">Entrega</span>
    <div class="lj-box">${user && perfilOk(cli) ? `<div class="r"><div><b>${esc(cli.nome)}</b><div class="note" style="margin-top:2px">${esc(cli.endereco)}, ${esc(cli.numero)}${cli.complemento ? " · " + esc(cli.complemento) : ""} · ${esc(cli.bairro)} · ${esc(cli.cidade)}/${esc(cli.uf)} · ${esc(cli.cep)}</div></div><button type="button" class="lj-link" id="ljEditEnd">Alterar</button></div>`
      : `<div class="note" style="margin:0">${user ? "Falta preencher seu endereço de entrega." : "Entre ou crie sua conta para informar o endereço e acompanhar o pedido."}</div>`}</div>
    <div class="note">${encomenda ? `Camisas sob encomenda: entrega em até ${Number(CFG.loja.prazoEncomendaDias || 30)} dias após a confirmação do pagamento. Você acompanha cada etapa em Minha conta.` : "Pronta entrega: enviamos após a confirmação do pagamento."}</div>
    <span class="lbl">Pagamento</span>
    <div class="lj-pay">
      <label><input type="radio" name="ljPag" value="mercadopago" ${pagamento==="mercadopago"?"checked":""}><span><b>Cartão de crédito ou Pix</b><small>Pelo Mercado Pago · crédito à vista ou em até ${Number(CFG.loja.parcelasMax || 2)}x sem juros · confirmação automática</small></span></label>
      ${pixOn ? `<label><input type="radio" name="ljPag" value="pix_chave" ${pagamento==="pix_chave"?"checked":""}><span><b>Pix direto para a loja</b><small>Você paga com a chave Pix e envia o comprovante · confirmamos em até 1 dia útil</small></span></label>` : ""}
    </div>
    <div class="lj-err"></div><div style="height:14px"></div>
    <button type="button" class="btn pri" id="ljFinal">${!user ? "Entrar para finalizar" : !perfilOk(cli) ? "Informar endereço" : "Finalizar compra · " + brl(tot)}</button>
    <div style="height:8px"></div>
    <button type="button" class="btn ghost" data-close>Continuar comprando</button>
    <button type="button" class="rm" id="clearCart" style="display:block;margin:12px auto 0">Esvaziar carrinho</button>`);
  document.querySelectorAll('input[name="ljPag"]').forEach(r => r.addEventListener("change", () => { pagamento = r.value; }));
  document.getElementById("aplicaCup").addEventListener("click", () => {
    const res = aplicaCupom(val("cCup")); if(res === "vencido") toast("Cupom expirado."); if(res === "invalido") toast("Cupom não existe."); guardaInd(); abrirCheckout();
  });
  document.getElementById("clearCart").addEventListener("click", () => { cart = []; cupom = ""; cupomMsg = ""; saveCart(); closeSheet(); render(); toast("Carrinho esvaziado."); });
  const ed = document.getElementById("ljEditEnd"); if(ed) ed.addEventListener("click", () => { guardaInd(); abrirDados(abrirCheckout); });
  document.getElementById("ljFinal").addEventListener("click", finalizar);
}
function guardaInd(){ const el = document.getElementById("cInd"); if(el){ perfil.indicacao = el.value.trim(); try { localStorage.setItem("naza.perfil", JSON.stringify(perfil)); } catch(e){} } }
async function finalizar(e){
  guardaInd();
  if(!user) return abrirLogin("entrar", abrirCheckout);
  if(!perfilOk(cli)) return abrirDados(abrirCheckout);
  const btn = e.currentTarget; ocupado(btn, true, "Registrando pedido…");
  try {
    const obs = perfil.indicacao && tipoCarrinho() !== "estoque" ? "Indicação: " + perfil.indicacao : "";
    const r = await api("criar-pedido", { forma: pagamento, cupom: cupomOk() ? cupom : "", obs,
      itens: cart.map(c => ({ produto_id: c.id, tamanho: c.tamanho, qtd: 1, pers_nome: c.persNome || "", pers_num: c.persNum || "", patch: c.patch || "" })) });
    cart = []; cupom = ""; cupomMsg = ""; saveCart(); render();
    if(r.pagar_url){ ocupado(btn, true, "Abrindo o Mercado Pago…"); location.href = r.pagar_url; return; }
    if(r.pix){ abrirPix({ id: r.id, codigo: r.pedido, total: r.total }); return; }
    toast(r.aviso || "Pedido registrado."); abrirConta();
  } catch(err){ ocupado(btn, false); erro(err.message); }
}

/* ---------- Pix direto ---------- */
function abrirPix(p){
  const cc = pixCopiaCola(p.total, p.codigo);
  openSheet("Pague com Pix · " + p.codigo, `
    <div class="pbig" style="margin-top:0">${brl(p.total)}</div>
    <div class="note" style="margin-top:0">Seu pedido está reservado. Pague pelo app do seu banco e envie o comprovante aqui.</div>
    <span class="lbl">Pix copia e cola</span><div class="lj-pix" id="ljCC">${esc(cc)}</div>
    <div class="lj-sp"></div><button type="button" class="btn ghost" id="ljCopia">Copiar código Pix</button>
    <span class="lbl">Ou use a chave</span><div class="lj-box"><b>${esc(CFG.pix.chave)}</b><div class="note" style="margin-top:2px">${esc(CFG.pix.tipo || "")}${CFG.pix.titular ? " · " + esc(CFG.pix.titular) : ""}</div></div>
    <span class="lbl">Comprovante</span><input class="in" type="file" id="ljArq" accept="image/*,application/pdf">
    <div class="lj-err"></div><div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljEnviaComp">Enviar comprovante</button>
    <div style="height:8px"></div><button type="button" class="btn ghost" id="ljDepois">Envio depois (fica em Minha conta)</button>`);
  document.getElementById("ljCopia").addEventListener("click", async () => { try { await navigator.clipboard.writeText(cc); toast("Código Pix copiado."); } catch(e){ toast("Toque e segure o código para copiar."); } });
  document.getElementById("ljDepois").addEventListener("click", abrirConta);
  document.getElementById("ljEnviaComp").addEventListener("click", async e => {
    const f = document.getElementById("ljArq").files[0];
    if(!f) return erro("Escolha a foto ou o PDF do comprovante.");
    if(f.size > 6 * 1024 * 1024) return erro("Arquivo muito grande (máx. 6 MB).");
    ocupado(e.currentTarget, true, "Enviando…");
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const caminho = `${user.id}/${p.codigo}-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("comprovantes").upload(caminho, f, { contentType: f.type || undefined });
      if(error) throw new Error("Não foi possível enviar o arquivo.");
      await api("comprovante-pix", { id: p.id, caminho });
      toast("Comprovante enviado! Confirmamos em breve."); abrirConta();
    } catch(err){ ocupado(e.currentTarget, false); erro(err.message); }
  });
}

/* ---------- minha conta ---------- */
/* ---------- minha conta: página própria ---------- */
let pgConta = null, contaAberta = false;
const PARTES_LOJA = ["header.hero", ".boxretro", ".tabs", ".layout", ".medidas", ".sobre", ".cartbar"];
function criarPagina(){
  if(pgConta) return pgConta;
  const wrap = document.querySelector(".wrap"); if(!wrap) return null;
  pgConta = document.createElement("section");
  pgConta.className = "pgconta"; pgConta.id = "pgConta"; pgConta.hidden = true;
  const antes = document.querySelector(".sobre") || document.querySelector(".foot");
  antes ? wrap.insertBefore(pgConta, antes) : wrap.appendChild(pgConta);
  return pgConta;
}
function mostrarLoja(ver){
  PARTES_LOJA.forEach(sel => { const el = document.querySelector(sel); if(el) el.style.display = ver ? "" : "none"; });
}
function fecharConta(){
  contaAberta = false;
  if(pgConta) pgConta.hidden = true;
  mostrarLoja(true); render();
  if(location.hash) history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo(0, 0);
}
function abrirPagina(titulo, html){
  const pg = criarPagina(); if(!pg) return null;
  contaAberta = true; closeSheet();
  pg.hidden = false; mostrarLoja(false);
  pg.innerHTML = `<div class="pgtop"><button type="button" class="pgvolta" id="pgVolta">‹ Voltar à loja</button></div><h2>${esc(titulo)}</h2>${html}`;
  document.getElementById("pgVolta").addEventListener("click", fecharConta);
  return pg;
}
async function abrirConta(destaque){
  if(!user) return abrirLogin("entrar", () => abrirConta(destaque));
  if(!criarPagina()) return;
  abrirPagina("Minha conta", `<div class="note">Carregando seus dados…</div>`);
  window.scrollTo(0, 0);
  if(location.hash !== "#minha-conta" && !destaque) history.replaceState(null, "", "#minha-conta");
  await carregarCliente();
  const [{ data: peds }, { data: ass }] = await Promise.all([
    sb.from("pedidos").select("id,codigo,status,tipo,forma_pagamento,total,criado_em,rastreio,pix_comprovante,pedido_itens(descricao,tamanho,qtd,pers_nome,pers_num,patch,total),pedido_eventos(status,criado_em)").order("criado_em", { ascending: false }).limit(50),
    sb.from("assinaturas").select("id,status,tamanho,time_coracao,valor,inicio,criado_em").neq("status", "cancelado").order("criado_em", { ascending: false })
  ]);
  if(!contaAberta) return;
  const c = cli || {};
  abrirPagina("Minha conta", `
    <div class="lj-box"><div class="r"><div><b>${esc(c.nome || user.email)}</b><div class="note" style="margin-top:2px">${esc(user.email)}${perfilOk(c) ? "<br>" + esc(c.endereco) + ", " + esc(c.numero) + (c.complemento ? " · " + esc(c.complemento) : "") + " · " + esc(c.bairro) + " · " + esc(c.cidade) + "/" + esc(c.uf) + " · " + esc(c.cep) : ""}</div></div><button type="button" class="lj-link" id="ljMeusDados">${perfilOk(c) ? "Alterar" : "Completar dados"}</button></div></div>
    ${(ass || []).map(a => `<div class="lj-ped"><div class="r" style="display:flex;justify-content:space-between;gap:8px"><span class="t">Box Retrô · assinatura</span><span class="lj-chip ${AS_ST[a.status][1]}">${AS_ST[a.status][0]}</span></div>
      <div class="d">Tam. ${esc(a.tamanho)}${a.time_coracao ? " · " + esc(a.time_coracao) : ""} · ${brl(a.valor)}/mês${a.inicio ? " · desde " + dBR(a.inicio + "T12:00") : ""}</div>
      ${a.status === "aguardando_pagamento" ? `<div class="note">Ainda não recebemos a confirmação do Mercado Pago. Se você não concluiu, assine de novo pelo banner do Box Retrô.</div>` : `<div class="note">Para pausar ou cancelar, use a área de assinaturas do seu Mercado Pago ou fale com a loja.</div>`}</div>`).join("")}
    <span class="lbl">Meus pedidos</span>
    ${(peds || []).length ? peds.map(p => cartaoPedido(p, destaque)).join("") : `<div class="note">Você ainda não fez pedidos pelo site.</div>`}
    <div class="lj-sp"></div><div class="lj-sp"></div>
    <button type="button" class="btn ghost" id="ljSair" style="max-width:320px">Sair da conta</button>`);
  document.getElementById("ljMeusDados").addEventListener("click", () => abrirDados(() => abrirConta()));
  document.getElementById("ljSair").addEventListener("click", async () => { await sb.auth.signOut(); fecharConta(); toast("Você saiu da conta."); });
  document.querySelectorAll("[data-lj-pagar]").forEach(b => b.addEventListener("click", async e => {
    ocupado(e.currentTarget, true, "Abrindo o Mercado Pago…");
    try { const r = await api("pagar", { id: b.dataset.ljPagar }); location.href = r.pagar_url; } catch(err){ ocupado(e.currentTarget, false); toast(err.message); }
  }));
  document.querySelectorAll("[data-lj-pix]").forEach(b => b.addEventListener("click", () => { const p = peds.find(x => x.id === b.dataset.ljPix); abrirPix({ id: p.id, codigo: p.codigo, total: p.total }); }));
  document.querySelectorAll("[data-lj-cancelar]").forEach(b => b.addEventListener("click", async e => {
    if(e.currentTarget.dataset.confirma !== "1"){ e.currentTarget.dataset.confirma = "1"; e.currentTarget.textContent = "Toque de novo para cancelar"; return; }
    try { await api("cancelar-pedido", { id: b.dataset.ljCancelar }); toast("Pedido cancelado."); abrirConta(); } catch(err){ toast(err.message); }
  }));
  if(destaque){ const el = document.getElementById("ped-" + destaque); if(el) el.scrollIntoView({ block: "center" }); }
}
function cartaoPedido(p, destaque){
  const st = ST[p.status] || [p.status, ""];
  const ev = (p.pedido_eventos || []).slice().sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const aguard = p.status === "aguardando_pagamento";
  const pixOn = !!(CFG.pix && CFG.pix.ativo && CFG.pix.chave);
  return `<div class="lj-ped" id="ped-${esc(p.codigo)}" ${destaque === p.codigo ? 'style="border-color:var(--wine)"' : ""}>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="t">Pedido ${esc(p.codigo)}</span><span class="lj-chip ${st[1]}">${st[0]}</span></div>
    <div class="d">${dBR(p.criado_em)} · ${brl(p.total)} · ${p.tipo === "pronta" ? "pronta entrega" : p.tipo === "encomenda" ? "sob encomenda" : "pronta entrega + encomenda"}</div>
    ${(p.pedido_itens || []).map(i => `<div class="d">• ${esc(i.descricao)} · tam. ${esc(i.tamanho)}${i.pers_nome || i.pers_num ? " · " + esc([i.pers_nome, i.pers_num].filter(Boolean).join(" ")) : ""}${i.patch ? " · patch " + esc(i.patch) : ""}</div>`).join("")}
    ${p.rastreio ? `<div class="d" style="color:var(--ink)"><b>Rastreio:</b> ${esc(p.rastreio)} · <a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" rel="noopener">acompanhar</a></div>` : ""}
    ${ev.length > 1 ? `<ul class="lj-tl">${ev.map(x => `<li>${dBR(x.criado_em)} · ${esc((ST[x.status] || [x.status])[0])}</li>`).join("")}</ul>` : ""}
    ${aguard ? `<div class="lj-sp"></div>${p.forma_pagamento === "pix_chave" && pixOn ? `<button type="button" class="btn pri" data-lj-pix="${esc(p.id)}">Pagar com Pix / enviar comprovante</button><div style="height:6px"></div>` : ""}
      <button type="button" class="btn ${p.forma_pagamento === "pix_chave" && pixOn ? "ghost" : "pri"}" data-lj-pagar="${esc(p.id)}">Pagar com cartão ou Pix (Mercado Pago)</button>
      <button type="button" class="rm" data-lj-cancelar="${esc(p.id)}" style="display:block;margin:10px auto 0">Cancelar pedido</button>` : ""}
    ${p.status === "pagamento_em_analise" && p.pix_comprovante ? `<div class="note">Comprovante recebido. Assim que confirmarmos, o status muda para Pago.</div>` : ""}
  </div>`;
}

/* ---------- Box Retrô ---------- */
function abrirBox(){
  if(!user) return abrirLogin("criar", abrirBox);
  if(!perfilOk(cli)) return abrirDados(abrirBox);
  const preco = Number(CFG.loja.boxPreco || 199);
  openSheet("Box Retrô · assinatura", `
    <div class="pbig" style="margin-top:0">${brl(preco)}<small style="font-size:15px">/mês</small></div>
    <div class="note" style="margin-top:0">Todo mês uma camisa retrô de manga curta, personalizada com nome e número de um craque. É surpresa: você só descobre quando abrir.</div>
    <span class="lbl">Tamanho</span><select class="in" id="ljBxTam"><option value="">Escolha</option>${["P","M","G","GG","XGG","XXGG"].map(t => `<option ${cli.tamanho===t?"selected":""}>${t}</option>`).join("")}</select>
    <span class="lbl">Time do coração</span><input class="in" id="ljBxTime" value="${esc(cli.time_coracao)}" placeholder="Ex.: Flamengo, Real Madrid…" style="text-transform:none">
    <div class="lj-box"><b>Entrega</b><div class="note" style="margin-top:2px">${esc(cli.endereco)}, ${esc(cli.numero)} · ${esc(cli.cidade)}/${esc(cli.uf)} · <button type="button" class="lj-link" id="ljBxEnd">alterar</button></div></div>
    <label class="lj-chk"><input type="checkbox" id="ljBxOk"><span>Entendi que a box é <b>surpresa e personalizada</b> e que a cobrança é <b>mensal de ${brl(preco)} no cartão</b>, renovada automaticamente até eu cancelar.</span></label>
    <div class="note">No Mercado Pago, use o mesmo e-mail da sua conta aqui (<b>${esc(user.email)}</b>), senão o pagamento é recusado.</div>
    <div class="lj-err"></div><div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljBxGo">Assinar pelo Mercado Pago</button>`);
  document.getElementById("ljBxEnd").addEventListener("click", () => abrirDados(abrirBox));
  document.getElementById("ljBxGo").addEventListener("click", async e => {
    const tamanho = val("ljBxTam"); if(!tamanho) return erro("Escolha o tamanho.");
    if(!document.getElementById("ljBxOk").checked) return erro("Marque que você entendeu como funciona a box.");
    ocupado(e.currentTarget, true, "Abrindo o Mercado Pago…");
    try { const r = await api("assinar-box", { tamanho, time_coracao: val("ljBxTime") }); location.href = r.pagar_url; }
    catch(err){ ocupado(e.currentTarget, false); erro(err.message); }
  });
}

/* ---------- integração com o site existente ---------- */
// carrinho → checkout
window.openCart = abrirCheckout; try { openCart = abrirCheckout; } catch(e){}
// barra do carrinho
const _render = render;
try { render = function(){ _render(); const t = document.getElementById("cartTxt"); if(t) t.textContent = "Meu carrinho · finalizar compra"; }; } catch(e){}
// detalhe da camisa: textos de compra e patch
const _openItem = openItem;
document.addEventListener("click", e => { if(contaAberta && (e.target.closest(".card") || e.target.closest("[data-aba]"))) fecharConta(); }, true);
try { openItem = function(id){
  _openItem(id);
  const disp = document.getElementById("dispBtn"), add = document.getElementById("addBtn");
  if(disp) disp.textContent = "Comprar agora"; if(add) add.textContent = "Adicionar ao carrinho";
  const i = acha(id) || {};
  document.querySelectorAll("#sheetBody > .note").forEach(n => { if(/WhatsApp/.test(n.textContent)) n.textContent = i.tipo === "estoque" ? "Camisa já no Brasil. Enviamos depois da confirmação do pagamento." : `Sob encomenda: entrega em até ${Number(CFG.loja.prazoEncomendaDias || 30)} dias após o pagamento.`; });
  const patch = document.getElementById("pPatch");
  if(patch && !temPatchOnline()){ const lbl = patch.previousElementSibling; patch.value = ""; patch.hidden = true; patch.style.display = "none"; if(lbl && lbl.classList.contains("lbl")) lbl.style.display = "none"; }
  else if(patch){ patch.placeholder = "Ex.: Libertadores, Campeão do Mundo"; patch.insertAdjacentHTML("afterend", `<div class="note" style="margin-top:4px">${brl(CFG.loja.patchPreco)} por patch. Mais de um? Separe por vírgula.</div>`); }
}; } catch(e){}
// Box Retrô: troca o formulário antigo (WhatsApp) pelo de assinatura com conta
document.addEventListener("click", e => { if(e.target.closest("#bxOpen")){ e.preventDefault(); e.stopImmediatePropagation(); abrirBox(); } }, true);
// botão de conta no topo
const topActs = document.getElementById("topActs"), ig = document.querySelector(".ig");
if(topActs) topActs.innerHTML = `<button type="button" class="tbtn" id="ljAcct">Entrar</button><button type="button" class="tbtn pri" id="ljCriar">Criar conta</button>`;
else if(ig) ig.insertAdjacentHTML("beforebegin", `<button type="button" class="acct" id="ljAcct">Entrar</button>`);
document.addEventListener("click", e => {
  if(e.target.closest("#ljAcct")){ user ? abrirConta() : abrirLogin("entrar"); return; }
  if(e.target.closest("#ljCriar")){ abrirLogin("criar"); return; }
  const m = e.target.closest("[data-lj-modo]"); if(m){ abrirLogin(m.dataset.ljModo); }
});
// textos de WhatsApp no rodapé
const foot = document.querySelector(".foot div"); if(foot) foot.textContent = "NAZA Camisas Importadas · compre pelo site · dúvidas pelo WhatsApp";
const footEl = document.querySelector(".foot");
function rodape(){ if(!footEl) return; const old = document.getElementById("ljFoot"); if(old) old.remove(); footEl.insertAdjacentHTML("beforeend", `<div id="ljFoot" style="display:grid;gap:4px;font-size:12px;opacity:.9"><div>${esc(LOJA_ID)}</div><div>Frete: ${esc(regraFrete())} Pagamento: cartão em até ${Number(CFG.loja.parcelasMax || 2)}x sem juros ou Pix.</div></div>`); }
rodape();

/* ---------- sessão e rotas por # ---------- */
function rota(){
  const h = location.hash;
  if(h === "#nova-senha") return; // tratado no evento PASSWORD_RECOVERY
  if(h === "#minha-conta"){ if(!contaAberta) abrirConta(); return; }
  const m = h.match(/^#pedido-(NZ\d+)$/); if(m) return abrirConta(m[1]);
  if(contaAberta) fecharConta();
}
sb.auth.onAuthStateChange(async (ev, session) => {
  const antes = user;
  user = session ? session.user : null;
  if(ev === "PASSWORD_RECOVERY"){ abrirNovaSenha(); return; }
  if(user && (!antes || antes.id !== user.id)) await carregarCliente();
  if(!user) cli = null;
  atualizarBotao();
  if(ev === "SIGNED_IN" && depoisLogin){ const f = depoisLogin; depoisLogin = null; if(!perfilOk(cli)) abrirDados(f); else f(); }
  else if(ev === "SIGNED_IN" && !antes && !document.getElementById("sheet").hidden && document.getElementById("ljGo")){ perfilOk(cli) ? abrirConta() : abrirDados(); }
});
(async () => {
  try { await carregarConfig(); } catch(e){}
  rodape();
  const { data: { session } } = await sb.auth.getSession();
  user = session ? session.user : null; if(user) await carregarCliente();
  atualizarBotao(); render(); rota();
})();
window.addEventListener("hashchange", rota);
})();
