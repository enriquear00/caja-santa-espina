// PENDIENTE DE PUBLICAR junto con la rama «avisos-stock».
// Sustituye en Código.gs (proyecto «Caja Santa Espina - Envio automatico») el bloque «INVENTARIO DEL BAR» completo por este.
// Añade la columna «Referencia» a la pestaña «Inventario bar» y la devuelve a los móviles para el aviso de comprar más.

/* ============ INVENTARIO DEL BAR (sincronizado con los móviles) ============
 * Va en la misma hoja de cálculo que el inventario de la tienda, en dos pestañas propias:
 * «Inventario bar»: una fila por producto del bar. «Unidades» es la cifra que manda (vacía = no se cuenta, p. ej. los cafés).
 *   «Precio» y «Categoría» sirven para que un producto añadido en un móvil (o a mano aquí) aparezca en todos los demás.
 *   «Referencia»: el total que había tras la última reposición o recuento al alza. Con menos del 30 % de esa cifra, los móviles avisan de comprar más.
 *   «Estado» = Quitado: el producto se ha quitado de Tarifas y desaparece de los móviles (la fila se conserva).
 * «Movimientos bar»: cada consumición, ajuste, alta y baja, con su ID para no aplicarlos dos veces. */
const INVB_CAB = ['Artículo', 'Categoría', 'Unidades', 'Actualizado', 'Último cambio', 'Precio', 'Estado', 'Referencia'];
const INVB_REPONE = ['reposición', 'recuento', 'inventario inicial'];
const esQuitado_ = v => /^quitad/i.test(String(v || '').trim());
function recibirInventarioBar_(d) {
  const movil = String(d.movil || 'Sin nombre').slice(0, 40), movs = Array.isArray(d.movs) ? d.movs.slice(0, 500) : [], prods = Array.isArray(d.prods) ? d.prods.slice(0, 400) : [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = libroInv_(), si = hojaInv_(ss, 'Inventario bar', INVB_CAB), sm = hojaInv_(ss, 'Movimientos bar', MOV_CAB);
    if (si.getRange(1, 8).getValue() === '') si.getRange(1, 8).setValue('Referencia').setFontWeight('bold').setBackground('#e3f0e1');
    const ya = {}; if (sm.getLastRow() > 1) sm.getRange(2, 1, sm.getLastRow() - 1, 1).getValues().forEach(r => ya[String(r[0])] = 1);
    const filas = datos_(si).map(r => INVB_CAB.map((_, j) => r[j] === undefined ? '' : r[j])).filter(r => String(r[0] || '').trim()), idx = {}; filas.forEach((r, i) => { idx[claveArt_(r[0])] = i; });
    const precio_ = v => { const n = +v; return v === '' || v == null || isNaN(n) || n < 0 ? '' : Math.round(n * 100) / 100; };
    const nuevos = [], hechos = []; let tocado = false;
    // Lista de Tarifas del móvil: los productos que la hoja no ha visto nunca se añaden (sin unidades: «sin contar»).
    prods.forEach(p => { const nombre = String(p && p.nombre || '').trim().slice(0, 120), k = claveArt_(nombre); if (!nombre || idx[k] !== undefined) return;
      filas.push([nombre, String(p.cat || '').slice(0, 40), '', new Date(), 'alta · ' + movil, precio_(p.precio), '', '']); idx[k] = filas.length - 1; tocado = true; });
    movs.forEach(m => {
      const id = String(m.id || ''), nombre = String(m.nombre || '').trim().slice(0, 120), tipo = String(m.tipo || '').slice(0, 40);
      const cambio = Math.round(+m.cambio), despues = Math.round(+m.despues), cat = tipo === 'alta' || tipo === 'baja';
      if (!id || !nombre || !tipo || (!cat && isNaN(cambio) && isNaN(despues))) return;
      hechos.push(id); if (ya[id]) return; ya[id] = 1; tocado = true;
      const k = claveArt_(nombre); let i = idx[k];
      if (i === undefined) { if (tipo === 'baja') return; filas.push([nombre, String(m.cat || '').slice(0, 40), '', '', '', precio_(m.precio), '', '']); i = idx[k] = filas.length - 1; }
      const f = filas[i]; f[3] = new Date(); f[4] = tipo + ' · ' + movil;
      if (!f[1] && m.cat) f[1] = String(m.cat).slice(0, 40);
      if (tipo === 'alta') { f[6] = ''; if (precio_(m.precio) !== '') f[5] = precio_(m.precio); if (m.cat) f[1] = String(m.cat).slice(0, 40);
        nuevos.push([id, new Date(+m.fecha || Date.now()), movil, nombre, tipo, '', '', 'Añadido en Tarifas', '', '']); return; }
      if (tipo === 'baja') { f[6] = 'Quitado'; f[2] = ''; f[7] = '';
        nuevos.push([id, new Date(+m.fecha || Date.now()), movil, nombre, tipo, '', '', 'Quitado en Tarifas', '', '']); return; }
      const antes = f[2] === '' || isNaN(+f[2]) ? 0 : +f[2];
      const valor = INV_ABSOLUTOS.indexOf(tipo) >= 0 && !isNaN(despues) ? despues : antes + (isNaN(cambio) ? 0 : cambio);
      f[2] = valor;
      if (INVB_REPONE.indexOf(tipo) >= 0 && valor > 0 && (valor > antes || f[7] === '' || isNaN(+f[7]))) f[7] = valor;
      nuevos.push([id, new Date(+m.fecha || Date.now()), movil, nombre, tipo, valor - antes, valor, String(m.motivo || '').slice(0, 80), String(m.nota || '').slice(0, 120), String(m.ref || '').slice(0, 40)]);
    });
    if (tocado && filas.length) { si.getRange(2, 1, filas.length, INVB_CAB.length).setValues(filas); si.getRange(2, 4, filas.length, 1).setNumberFormat('dd/mm/yyyy HH:mm'); si.getRange(2, 6, filas.length, 1).setNumberFormat('0.00'); }
    if (nuevos.length) { sm.getRange(sm.getLastRow() + 1, 1, nuevos.length, MOV_CAB.length).setValues(nuevos); sm.getRange(2, 2, sm.getLastRow() - 1, 1).setNumberFormat('dd/mm/yyyy HH:mm'); }
    const stock = {}, catalogo = [];
    filas.forEach(r => { const n = String(r[0]).trim(), q = esQuitado_(r[6]);
      if (!q && r[2] !== '' && !isNaN(+r[2])) stock[n] = Math.round(+r[2]);
      catalogo.push({ nombre: n, cat: String(r[1] || ''), precio: r[5] === '' || isNaN(+r[5]) ? null : +r[5], quitado: q, ref: r[7] === '' || isNaN(+r[7]) ? null : +r[7] }); });
    return { ok: true, hechos: hechos, stock: stock, catalogo: catalogo, t: Date.now() };
  } finally { lock.releaseLock(); }
}
