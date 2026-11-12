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
// Depois de confirmar o e-mail, o Supabase devolve a pessoa com #...&type=signup no endereço.
// É preciso ler isso ANTES de criar o cliente, que limpa o endereço.
const HASH0 = location.hash;
const TIPO_RETORNO = (HASH0.match(/[#&]type=([a-z_]+)/) || [])[1] || "";
const ERRO_LINK = /[#&]error/.test(HASH0)
  ? decodeURIComponent(((HASH0.match(/error_description=([^&]*)/) || [])[1] || "").replace(/\+/g, " ")) || "Link inválido"
  : "";
// Os links de e-mail chegavam com DOIS "#" (ex.: #nova-senha#access_token=...), porque o redirectTo
// já levava um fragmento. Assim a biblioteca não achava o token e a sessão nunca era criada.
// Aqui a parte antiga é descartada antes de o cliente ler o endereço.
const iTok = HASH0.search(/#(access_token|error|code)=/);
if(iTok > 0) try { history.replaceState(null, "", location.pathname + location.search + HASH0.slice(iTok)); } catch(e){}
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
  aguardando_disponibilidade: ["Conferindo disponibilidade","warn"],
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
.acct{color:#FFFFFF;font-size:13px;font-weight:700;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12);border-radius:8px;padding:6px 12px;white-space:nowrap;cursor:pointer;margin-right:6px}
.lj-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--surface2);border-radius:8px;padding:4px;margin:4px 0 10px}
.lj-tabs button{border:0;background:none;border-radius:6px;padding:9px;font-weight:700;color:var(--muted);cursor:pointer}
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
@media(min-width:760px){.pgconta .lj-ped,.pgconta .lj-box,.pgconta .lj-ficha{max-width:760px}}
.lj-ficha{display:flex;gap:14px;align-items:stretch;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:13px 14px;margin-top:8px}
.lj-ficha-dados{flex:1;min-width:0}
.lj-ficha.tem-time{border-color:var(--tc);border-left:6px solid var(--tc);background:
  linear-gradient(100deg, color-mix(in srgb, var(--tc) 9%, var(--surface)) 0%, var(--surface) 62%)}
.lj-ficha.tem-time b{color:var(--tc)}
.lj-ficha-escudo{display:grid;place-items:center;gap:5px;flex:none;padding-left:6px;border-left:1px dashed var(--line)}
.lj-ficha-escudo small{font-family:var(--display);font-weight:700;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--tc);text-align:center;max-width:116px;line-height:1.15}
.lj-escudo{display:block;filter:drop-shadow(0 2px 4px rgba(46,6,12,.22))}
.lj-tag{display:inline-block;margin:8px 6px 0 0;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  background:var(--surface2);color:var(--muted);border-radius:7px;padding:4px 9px}
.lj-ficha.tem-time .lj-tag.time{background:var(--tc);color:#FFFFFF}
@media(max-width:560px){.lj-ficha{flex-direction:column-reverse;align-items:center;text-align:center}
  .lj-ficha-dados{width:100%}
  .lj-ficha-escudo{border-left:0;border-bottom:1px dashed var(--line);padding:0 0 10px;width:100%}
  .lj-ficha .r{flex-direction:column;gap:6px;align-items:center}}
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
  const x = document.getElementById("ljSairTop"); if(x) x.hidden = !user;
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

/* ---------- times do coração (Séries A e B de 2026) ---------- */
// Escudos oficiais são marcas registradas dos clubes: aqui usamos um brasão próprio,
// desenhado com as cores e o padrão de cada time, nunca o escudo do clube.
const TIMES = [
  ["América Mineiro","listras",["#0A6B3B","#FFFFFF"]],
  ["Athletic","listras",["#111111","#FFFFFF"]],
  ["Athletico Paranaense","listras",["#C8102E","#111111"]],
  ["Atlético Goianiense","listras",["#D32027","#111111"]],
  ["Atlético Mineiro","listras",["#111111","#FFFFFF"]],
  ["Avaí","listras",["#0B3C8C","#FFFFFF"]],
  ["Bahia","faixas",["#0B3C8C","#FFFFFF","#D7262F"]],
  ["Botafogo","listras",["#111111","#FFFFFF"]],
  ["Botafogo-SP","listras",["#111111","#FFFFFF"]],
  ["Ceará","listras",["#111111","#FFFFFF"]],
  ["Chapecoense","faixa",["#0A5D2E","#FFFFFF"]],
  ["Corinthians","listras",["#111111","#FFFFFF"]],
  ["Coritiba","listras",["#0B5B33","#FFFFFF"]],
  ["CRB","faixas",["#D32027","#FFFFFF","#111111"]],
  ["Criciúma","listras",["#F2C200","#111111"]],
  ["Cruzeiro","liso",["#1C3F94","#FFFFFF"]],
  ["Cuiabá","faixa",["#006B3F","#D4A017"]],
  ["Flamengo","faixas",["#C52613","#111111","#C52613"]],
  ["Fluminense","listras",["#7A1128","#0C7A4B","#FFFFFF"]],
  ["Fortaleza","faixas",["#0B3C8C","#FFFFFF","#D7262F"]],
  ["Goiás","faixa",["#0A7A3C","#FFFFFF"]],
  ["Grêmio","listras",["#2E7DBA","#111111","#FFFFFF"]],
  ["Internacional","liso",["#D2232A","#FFFFFF"]],
  ["Juventude","listras",["#0B6B3A","#FFFFFF"]],
  ["Londrina","faixa",["#0B3C8C","#FFFFFF"]],
  ["Mirassol","faixa",["#F4C300","#0E6E3A"]],
  ["Náutico","listras",["#D32027","#FFFFFF"]],
  ["Novorizontino","faixa",["#0E6E3A","#F2C200"]],
  ["Operário Ferroviário","listras",["#111111","#FFFFFF"]],
  ["Palmeiras","liso",["#006437","#FFFFFF"]],
  ["Ponte Preta","listras",["#111111","#FFFFFF"]],
  ["Red Bull Bragantino","faixa",["#FFFFFF","#E2232E"]],
  ["Remo","faixa",["#0A2C6B","#FFFFFF"]],
  ["Santos","faixa",["#FFFFFF","#111111"]],
  ["São Bernardo","faixa",["#F2C200","#0B3C8C"]],
  ["São Paulo","faixas",["#FFFFFF","#D7262F","#111111"]],
  ["Sport","listras",["#D32027","#111111"]],
  ["Vasco da Gama","diagonal",["#111111","#FFFFFF"]],
  ["Vila Nova","listras",["#D32027","#FFFFFF"]],
  ["Vitória","listras",["#D32027","#111111"]],
].map(([n, p, c]) => ({ n, p, c })).sort((a, b) => a.n.localeCompare(b.n, "pt-BR"));
// aceita o que já estava escrito à mão ("Santos Futebol Clube", "Vasco", "Inter"…)
const achaTime = nome => {
  const q = semAc(nome); if(!q) return null;
  const exato = TIMES.find(t => semAc(t.n) === q); if(exato) return exato;
  return TIMES.filter(t => { const n = semAc(t.n); return q.includes(n) || n.includes(q); })
              .sort((a, b) => semAc(b.n).length - semAc(a.n).length)[0] || null;
};
const claro = hex => { const n = parseInt(String(hex).slice(1), 16); return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 190; };
// cor que funciona como destaque (evita branco puro)
const corTime = t => t ? (claro(t.c[0]) ? (t.c[1] && !claro(t.c[1]) ? t.c[1] : "#5E0810") : t.c[0]) : "";
function escudoSVG(t, tam){
  if(!t) return "";
  const [a, b, c] = [t.c[0], t.c[1] || t.c[0], t.c[2] || t.c[0]];
  let dentro = "";
  if(t.p === "listras"){ const n = 6, w = 100 / n;
    for(let i = 0; i < n; i++) dentro += `<rect x="${i*w}" y="0" width="${w}" height="112" fill="${i%2?b:a}"/>`;
    if(t.c[2]) dentro += `<rect x="0" y="0" width="100" height="112" fill="none"/>`;
  } else if(t.p === "faixas"){
    dentro = `<rect width="100" height="112" fill="${a}"/><rect y="37" width="100" height="38" fill="${b}"/>` + (t.c[2] ? `<rect y="75" width="100" height="37" fill="${c}"/>` : "");
  } else if(t.p === "faixa"){
    dentro = `<rect width="100" height="112" fill="${a}"/><rect y="42" width="100" height="26" fill="${b}"/>`;
  } else if(t.p === "diagonal"){
    dentro = `<rect width="100" height="112" fill="${a}"/><path d="M-10 86 L74 -10 L100 10 L16 112 Z" fill="${b}"/>`;
  } else {
    dentro = `<rect width="100" height="112" fill="${a}"/>`;
  }
  const id = "esc" + Math.random().toString(36).slice(2, 8);
  const forma = "M6 6h88v50c0 27-27 42-44 50C33 98 6 83 6 56z";
  return `<svg class="lj-escudo" viewBox="0 0 100 112" width="${tam||86}" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${forma}"/></clipPath></defs>
    <g clip-path="url(#${id})">${dentro}</g>
    <path d="${forma}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="5"/>
    <path d="${forma}" fill="none" stroke="#FFFFFF" stroke-width="2"/></svg>`;
}
function selectTime(id, valor){
  const t = achaTime(valor), outro = !t && !!String(valor || "").trim();
  return `<select class="in" id="${id}" data-time-sel>
      <option value="">—</option>
      ${TIMES.map(x => `<option ${t && t.n === x.n ? "selected" : ""}>${esc(x.n)}</option>`).join("")}
      <option value="__outro" ${outro ? "selected" : ""}>Outro (escrever)</option>
    </select>
    <input class="in" id="${id}Outro" placeholder="Qual é o seu time?" value="${outro ? esc(valor) : ""}" style="text-transform:none;margin-top:6px" ${outro ? "" : "hidden"}>`;
}
function ligaTime(id){
  const s = document.getElementById(id), o = document.getElementById(id + "Outro");
  if(!s || !o) return;
  s.addEventListener("change", () => { o.hidden = s.value !== "__outro"; if(!o.hidden) o.focus(); });
}
const lerTime = id => { const s = document.getElementById(id); if(!s) return ""; return s.value === "__outro" ? val(id + "Outro") : s.value; };

/* ---------- conta: entrar / criar conta / senha ---------- */
function abrirLogin(modo, depois){
  if(depois) depoisLogin = depois;
  modo = modo || "entrar";
  openSheet(modo === "senha" ? "Recuperar senha" : "Sua conta NAZA", `
    ${modo === "senha" ? "" : `<div class="lj-tabs"><button type="button" data-lj-modo="entrar" aria-pressed="${modo==="entrar"}">Entrar</button><button type="button" data-lj-modo="criar" aria-pressed="${modo==="criar"}">Criar conta</button></div>
    <div class="note" style="margin-top:0">${modo === "criar" ? "Com a conta você compra direto pelo site e acompanha todos os seus pedidos." : "Entre para finalizar a compra e acompanhar seus pedidos."}</div>`}
    <span class="lbl">E-mail</span><input class="in" id="ljEmail" type="email" autocomplete="email" inputmode="email" placeholder="seuemail@exemplo.com" style="text-transform:none">
    ${modo === "senha" ? `<div class="note">Enviaremos um link para você criar uma senha nova.</div>` : `<span class="lbl">Senha</span><input class="in" id="ljSenha" type="password" autocomplete="${modo==="criar"?"new-password":"current-password"}" placeholder="${modo==="criar"?"Mínimo de 8 caracteres":"Sua senha"}" style="text-transform:none">`}
    ${modo === "criar" ? `<span class="lbl">Repita a senha</span><input class="in" id="ljSenha2" type="password" autocomplete="new-password" placeholder="Digite a senha de novo" style="text-transform:none">` : ""}
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
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
        if(error) throw error; erro(""); toast("Se o e-mail tiver conta, o link chega em instantes."); closeSheet(); return;
      }
      if(senha.length < (modo === "criar" ? 8 : 1)) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if(modo === "criar"){
        if(senha !== ((document.getElementById("ljSenha2") || {}).value || "")) throw new Error("As duas senhas não são iguais. Confira e tente de novo.");
        if(!document.getElementById("ljTermos").checked) throw new Error("Marque a concordância para criar a conta.");
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: SITE } });
        if(error) throw error;
        // Conta já existente: o Supabase devolve um usuário sem "identities" e NÃO envia e-mail nenhum.
        if(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
          throw new Error("Esse e-mail já tem conta aqui. Use a aba Entrar — se não lembra a senha, toque em Esqueci minha senha.");
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
function avisoConfirmado(tipo){
  if(location.hash) history.replaceState(null, "", location.pathname + location.search);
  const novo = tipo === "email_change", completo = perfilOk(cli);
  openSheet(novo ? "Novo e-mail confirmado" : "E-mail confirmado", `
    <div style="text-align:center;font-size:46px;line-height:1;margin-top:4px">&#9989;</div>
    <p style="font-size:16.5px;line-height:1.5;margin:12px 0 0;text-align:center;font-weight:600">${novo ? "Pronto! Seu novo e-mail está confirmado." : "Seu e-mail foi confirmado!"}</p>
    <p class="note" style="text-align:center;margin-top:8px">${!user ? "Entre na sua conta para completar seu cadastro."
      : completo ? "Sua conta está pronta. É só escolher suas camisas." : "Acesse sua conta para completar seu cadastro com endereço e WhatsApp."}</p>
    <div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljOkConf">${!user ? "Entrar na minha conta" : completo ? "Ir para minha conta" : "Completar meu cadastro"}</button>
    <div style="height:8px"></div>
    <button type="button" class="btn ghost" data-close>Continuar comprando</button>`);
  document.getElementById("ljOkConf").addEventListener("click", () => {
    if(!user) return abrirLogin("entrar", () => abrirConta());
    perfilOk(cli) ? abrirConta() : abrirDados(() => abrirConta());
  });
}
let telaNovaSenha = false;
function abrirNovaSenha(){
  if(telaNovaSenha) return; telaNovaSenha = true;
  openSheet("Criar nova senha", `
    <div class="note" style="margin-top:0">Escolha a senha que você vai usar para entrar na NAZA.</div>
    <span class="lbl">Nova senha</span><input class="in" id="ljNova" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres" style="text-transform:none">
    <span class="lbl">Repita a nova senha</span><input class="in" id="ljNova2" type="password" autocomplete="new-password" placeholder="Digite de novo" style="text-transform:none">
    <div class="lj-err"></div><div class="lj-sp"></div><button type="button" class="btn pri" id="ljSalvaSenha">Salvar senha</button>`);
  document.getElementById("ljSalvaSenha").addEventListener("click", async e => {
    const s = val("ljNova"), s2 = val("ljNova2");
    if(s.length < 8) return erro("A senha precisa ter pelo menos 8 caracteres.");
    if(s !== s2) return erro("As duas senhas não são iguais. Confira e tente de novo.");
    ocupado(e.currentTarget, true);
    const { error } = await sb.auth.updateUser({ password: s });
    if(error){ ocupado(e.currentTarget, false); return erro(/session|jwt|token/i.test(String(error.message)) ? "O link expirou. Peça um novo em Entrar > Esqueci minha senha." : traduz(error)); }
    telaNovaSenha = false;
    history.replaceState(null, "", location.pathname); toast("Senha alterada."); abrirConta();
  });
}
function avisoLinkInvalido(msg){
  if(location.hash) history.replaceState(null, "", location.pathname + location.search);
  openSheet("Link expirado", `
    <p style="margin-top:0">Esse link de e-mail não vale mais${/expired/i.test(msg) ? " (eles valem por pouco tempo)" : ""}. Peça um novo que chega na hora.</p>
    <div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljNovoLink">Pedir novo link de senha</button>
    <div style="height:8px"></div>
    <button type="button" class="btn ghost" data-close>Fechar</button>`);
  document.getElementById("ljNovoLink").addEventListener("click", () => abrirLogin("senha"));
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
    <div><span class="lbl">Time do coração</span>${selectTime("ljTime", c.time_coracao)}</div></div>
    <div class="lj-err"></div><div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljSalvar">${depois ? "Salvar e continuar" : "Salvar"}</button>`);
  ligaTime("ljTime");
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
      complemento: val("ljComp"), bairro: val("ljBairro"), cidade: val("ljCid"), uf: val("ljUf"), tamanho: val("ljTam"), time_coracao: lerTime("ljTime"),
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
    <div class="note">${encomenda ? `Camisas sob encomenda: primeiro conferimos a disponibilidade do modelo com o fornecedor. Só depois dessa confirmação o pagamento é liberado em Minha conta — entrega em até ${Number(CFG.loja.prazoEncomendaDias || 30)} dias após o pagamento.` : "Pronta entrega: enviamos após a confirmação do pagamento."}</div>
    ${encomenda ? `<div class="lj-box" style="border-color:var(--wine)"><b>Você ainda não paga nada agora</b><div class="note" style="margin-top:2px">Ao enviar o pedido, conferimos a disponibilidade e avisamos você. O botão de pagamento aparece em <b>Minha conta</b> assim que liberarmos, e aí você escolhe cartão ou Pix.</div></div>`
    : `<span class="lbl">Pagamento</span>
    <div class="lj-pay">
      <label><input type="radio" name="ljPag" value="mercadopago" ${pagamento==="mercadopago"?"checked":""}><span><b>Cartão de crédito ou Pix</b><small>Pelo Mercado Pago · crédito à vista ou em até ${Number(CFG.loja.parcelasMax || 2)}x sem juros · confirmação automática</small></span></label>
      ${pixOn ? `<label><input type="radio" name="ljPag" value="pix_chave" ${pagamento==="pix_chave"?"checked":""}><span><b>Pix direto para a loja</b><small>Você paga com a chave Pix e envia o comprovante · confirmamos em até 1 dia útil</small></span></label>` : ""}
    </div>`}
    <div class="lj-err"></div><div style="height:14px"></div>
    <button type="button" class="btn pri" id="ljFinal">${!user ? "Entrar para finalizar" : !perfilOk(cli) ? "Informar endereço" : encomenda ? "Enviar pedido · " + brl(tot) : "Finalizar compra · " + brl(tot)}</button>
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
    if(r.aguardando_disponibilidade){ avisoDisponibilidade(r.pedido); return; }
    if(r.pagar_url){ ocupado(btn, true, "Abrindo o Mercado Pago…"); location.href = r.pagar_url; return; }
    if(r.pix){ abrirPix({ id: r.id, codigo: r.pedido, total: r.total }); return; }
    toast(r.aviso || "Pedido registrado."); abrirConta();
  } catch(err){ ocupado(btn, false); erro(err.message); }
}

function avisoDisponibilidade(codigo){
  openSheet("Pedido enviado!", `
    <div class="lj-box" style="border-color:var(--wine)"><b>Pedido ${esc(codigo)} registrado</b>
      <div class="note" style="margin-top:4px">Agora conferimos a disponibilidade do modelo com o fornecedor. Assim que confirmarmos, <b>liberamos o pagamento</b> em Minha conta e avisamos você pelo WhatsApp.</div></div>
    <div class="note">Nenhuma cobrança é feita antes dessa confirmação. Se o modelo não estiver disponível, o pedido é cancelado sem custo.</div>
    <div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljDispConta">Ver meu pedido</button>
    <div style="height:8px"></div>
    <button type="button" class="btn ghost" data-close>Continuar comprando</button>`);
  document.getElementById("ljDispConta").addEventListener("click", () => abrirConta(codigo));
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
async function sair(){
  try { await sb.auth.signOut(); } catch(e){}
  user = null; cli = null; atualizarBotao();
  if(contaAberta) fecharConta(); else closeSheet();
  toast("Você saiu da conta.");
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
  const tm = achaTime(c.time_coracao), cor = corTime(tm);
  abrirPagina("Minha conta", `
    <div class="lj-ficha${tm ? " tem-time" : ""}"${tm ? ` style="--tc:${cor};--tc2:${tm.c[1] || cor}"` : ""}>
      <div class="lj-ficha-dados">
        <div class="r"><div><b>${esc(c.nome || user.email)}</b>
          <div class="note" style="margin-top:2px">${esc(user.email)}${perfilOk(c) ? "<br>" + esc(c.endereco) + ", " + esc(c.numero) + (c.complemento ? " · " + esc(c.complemento) : "") + " · " + esc(c.bairro) + " · " + esc(c.cidade) + "/" + esc(c.uf) + " · " + esc(c.cep) : ""}</div></div>
          <button type="button" class="lj-link" id="ljMeusDados">${perfilOk(c) ? "Alterar" : "Completar dados"}</button></div>
        ${c.tamanho ? `<span class="lj-tag">Veste ${esc(c.tamanho)}</span>` : ""}
        ${c.time_coracao ? `<span class="lj-tag time">${esc(c.time_coracao)}</span>` : `<button type="button" class="lj-link" id="ljEscolheTime">Escolher meu time do coração</button>`}
      </div>
      ${tm ? `<div class="lj-ficha-escudo">${escudoSVG(tm, 104)}<small>${esc(tm.n)}</small></div>` : ""}
    </div>
    ${(ass || []).map(a => `<div class="lj-ped"><div class="r" style="display:flex;justify-content:space-between;gap:8px"><span class="t">Box Retrô · assinatura</span><span class="lj-chip ${AS_ST[a.status][1]}">${AS_ST[a.status][0]}</span></div>
      <div class="d">Tam. ${esc(a.tamanho)}${a.time_coracao ? " · " + esc(a.time_coracao) : ""} · ${brl(a.valor)}/mês${a.inicio ? " · desde " + dBR(a.inicio + "T12:00") : ""}</div>
      ${a.status === "aguardando_pagamento" ? `<div class="note">Ainda não recebemos a confirmação do Mercado Pago. Se você não concluiu, assine de novo pelo banner do Box Retrô.</div>` : `<div class="note">Para pausar ou cancelar, use a área de assinaturas do seu Mercado Pago ou fale com a loja.</div>`}</div>`).join("")}
    <span class="lbl">Meus pedidos</span>
    ${(peds || []).length ? peds.map(p => cartaoPedido(p, destaque)).join("") : `<div class="note">Você ainda não fez pedidos pelo site.</div>`}
    <div class="lj-sp"></div><div class="lj-sp"></div>
    <button type="button" class="btn ghost" id="ljSair" style="max-width:320px">Sair da conta</button>`);
  document.getElementById("ljMeusDados").addEventListener("click", () => abrirDados(() => abrirConta()));
  const bt = document.getElementById("ljEscolheTime"); if(bt) bt.addEventListener("click", () => abrirDados(() => abrirConta()));
  document.getElementById("ljSair").addEventListener("click", sair);
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
  const emConf = p.status === "aguardando_disponibilidade";
  const pixOn = !!(CFG.pix && CFG.pix.ativo && CFG.pix.chave);
  return `<div class="lj-ped" id="ped-${esc(p.codigo)}" ${destaque === p.codigo ? 'style="border-color:var(--wine)"' : ""}>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="t">Pedido ${esc(p.codigo)}</span><span class="lj-chip ${st[1]}">${st[0]}</span></div>
    <div class="d">${dBR(p.criado_em)} · ${brl(p.total)} · ${p.tipo === "pronta" ? "pronta entrega" : p.tipo === "encomenda" ? "sob encomenda" : "pronta entrega + encomenda"}</div>
    ${(p.pedido_itens || []).map(i => `<div class="d">• ${esc(i.descricao)} · tam. ${esc(i.tamanho)}${i.pers_nome || i.pers_num ? " · " + esc([i.pers_nome, i.pers_num].filter(Boolean).join(" ")) : ""}${i.patch ? " · patch " + esc(i.patch) : ""}</div>`).join("")}
    ${p.rastreio ? `<div class="d" style="color:var(--ink)"><b>Rastreio:</b> ${esc(p.rastreio)} · <a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" rel="noopener">acompanhar</a></div>` : ""}
    ${ev.length > 1 ? `<ul class="lj-tl">${ev.map(x => `<li>${dBR(x.criado_em)} · ${esc((ST[x.status] || [x.status])[0])}</li>`).join("")}</ul>` : ""}
    ${aguard ? `<div class="lj-sp"></div>${p.tipo !== "pronta" ? `<div class="note" style="margin-top:0"><b>Disponibilidade confirmada!</b> Pagamento liberado — é só escolher a forma abaixo.</div>` : ""}${pixOn ? `<button type="button" class="btn pri" data-lj-pix="${esc(p.id)}">Pagar com Pix / enviar comprovante</button><div style="height:6px"></div>` : ""}
      <button type="button" class="btn ${pixOn ? "ghost" : "pri"}" data-lj-pagar="${esc(p.id)}">Pagar com cartão ou Pix (Mercado Pago)</button>
      <button type="button" class="rm" data-lj-cancelar="${esc(p.id)}" style="display:block;margin:10px auto 0">Cancelar pedido</button>` : ""}
    ${emConf ? `<div class="lj-sp"></div><div class="note" style="margin-top:0"><b>Pedido recebido!</b> Estamos conferindo a disponibilidade ${p.tipo === "misto" ? "das camisas sob encomenda" : "do modelo"} com o fornecedor. Assim que confirmarmos, o pagamento é liberado aqui e você recebe um aviso no WhatsApp. Nada é cobrado antes disso.</div>
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
    <span class="lbl">Time do coração</span>${selectTime("ljBxTime", cli.time_coracao)}
    <div class="lj-box"><b>Entrega</b><div class="note" style="margin-top:2px">${esc(cli.endereco)}, ${esc(cli.numero)} · ${esc(cli.cidade)}/${esc(cli.uf)} · <button type="button" class="lj-link" id="ljBxEnd">alterar</button></div></div>
    <label class="lj-chk"><input type="checkbox" id="ljBxOk"><span>Entendi que a box é <b>surpresa e personalizada</b> e que a cobrança é <b>mensal de ${brl(preco)} no cartão</b>, renovada automaticamente até eu cancelar.</span></label>
    <div class="note">No Mercado Pago, use o mesmo e-mail da sua conta aqui (<b>${esc(user.email)}</b>), senão o pagamento é recusado.</div>
    <div class="lj-err"></div><div class="lj-sp"></div>
    <button type="button" class="btn pri" id="ljBxGo">Assinar pelo Mercado Pago</button>`);
  ligaTime("ljBxTime");
  document.getElementById("ljBxEnd").addEventListener("click", () => abrirDados(abrirBox));
  document.getElementById("ljBxGo").addEventListener("click", async e => {
    const tamanho = val("ljBxTam"); if(!tamanho) return erro("Escolha o tamanho.");
    if(!document.getElementById("ljBxOk").checked) return erro("Marque que você entendeu como funciona a box.");
    ocupado(e.currentTarget, true, "Abrindo o Mercado Pago…");
    try { const r = await api("assinar-box", { tamanho, time_coracao: lerTime("ljBxTime") }); location.href = r.pagar_url; }
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
// rolagem própria da grade: atalho para o restante da página
const irFim = document.getElementById("irFim");
if(irFim) irFim.addEventListener("click", () => {
  const alvo = document.getElementById("medidas") || document.querySelector(".sobre") || document.querySelector("footer");
  if(alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
});
// botão de conta no topo
const topActs = document.getElementById("topActs"), ig = document.querySelector(".ig");
if(topActs) topActs.innerHTML = `<button type="button" class="tbtn pri" id="ljAcct">Entrar</button><button type="button" class="tbtn" id="ljCriar">Criar conta</button><button type="button" class="tbtn" id="ljSairTop" hidden>Sair</button>`;
else if(ig) ig.insertAdjacentHTML("beforebegin", `<button type="button" class="acct" id="ljAcct">Entrar</button>`);
document.addEventListener("click", e => {
  if(e.target.closest("#ljAcct")){ user ? abrirConta() : abrirLogin("entrar"); return; }
  if(e.target.closest("#ljCriar")){ abrirLogin("criar"); return; }
  if(e.target.closest("#ljSairTop")){ sair(); return; }
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
// IMPORTANTE: nada de await em chamadas do Supabase dentro deste callback — a biblioteca
// trava (deadlock no lock de autenticação). O trabalho é adiado com setTimeout.
sb.auth.onAuthStateChange((ev, session) => {
  setTimeout(async () => {
    const antes = user;
    user = session ? session.user : null;
    if(ev === "PASSWORD_RECOVERY"){ atualizarBotao(); abrirNovaSenha(); return; }
    atualizarBotao();
    if(user && (!antes || antes.id !== user.id || !cli)){ try { await carregarCliente(); } catch(e){} }
    if(!user) cli = null;
    if(ev === "SIGNED_IN" && depoisLogin){ const f = depoisLogin; depoisLogin = null; if(!perfilOk(cli)) abrirDados(f); else f(); }
    else if(ev === "SIGNED_IN" && !antes && !document.getElementById("sheet").hidden && document.getElementById("ljGo")){ closeSheet(); perfilOk(cli) ? abrirConta() : abrirDados(() => abrirConta()); }
  }, 0);
});
(async () => {
  try { await carregarConfig(); } catch(e){}
  rodape();
  const { data: { session } } = await sb.auth.getSession();
  user = session ? session.user : null; atualizarBotao();
  if(user){ try { await carregarCliente(); } catch(e){} }
  render();
  if(ERRO_LINK) avisoLinkInvalido(ERRO_LINK);
  else if(TIPO_RETORNO === "recovery" || location.hash === "#nova-senha"){
    // a sessão do link pode demorar um instante para nascer; só depois disso o link é dado como vencido
    for(let i = 0; i < 12 && !user; i++){
      await new Promise(r => setTimeout(r, 250));
      const { data } = await sb.auth.getSession();
      user = data.session ? data.session.user : null;
    }
    if(user){ atualizarBotao(); abrirNovaSenha(); } else avisoLinkInvalido("expired");
  }
  else if(TIPO_RETORNO === "signup" || TIPO_RETORNO === "email_change") avisoConfirmado(TIPO_RETORNO);
  else rota();
})();
window.addEventListener("hashchange", rota);
})();
