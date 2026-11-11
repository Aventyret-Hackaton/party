// Äventyrare-ansikten för kategorin där man ritar ur minnet.

/* ---------- Ansikten (Äventyrare) ---------- */
function renderFaces() {
  const box = $("faceList"); box.innerHTML = "";
  if (!faces.length) { box.innerHTML = `<p class="fine">${t("noFaces")}</p>`; return; }
  faces.forEach(f => {
    const fig = document.createElement("figure");
    const img = document.createElement("img"); img.src = faceSrc(f); img.alt = f.name;
    const cap = document.createElement("figcaption");
    const n = document.createElement("span"); n.textContent = f.name;
    const rm = document.createElement("button"); rm.className = "linkbtn"; rm.textContent = t("remove");
    rm.onclick = async () => { try { await caps.db.doc("faces/" + f.id).delete(); await caps.assets?.delete(f.asset); } catch (e) { console.warn(e); } };
    cap.append(n, rm); fig.append(img, cap); box.appendChild(fig);
  });
}
$("goFaces").onclick = () => { $("faceErr").textContent = caps.assets ? "" : t("facesNoAccess"); renderFaces(); show("s-faces"); };
$("faceAdd").onclick = async () => {
  const name = $("faceName").value.trim(), file = $("faceFile").files[0];
  if (!name || !file) { $("faceErr").textContent = t("faceMissing"); return; }
  if (!caps.assets || !caps.db) { $("faceErr").textContent = t("facesNoAccess"); return; }
  $("faceAdd").disabled = true;
  try {
    const up = await caps.assets.upload(file);
    await caps.db.collection("faces").add({ name, asset: up.id });
    $("faceName").value = ""; $("faceFile").value = ""; $("faceErr").textContent = "";
  } catch (e) { console.warn(e); $("faceErr").textContent = t("facesNoAccess"); }
  $("faceAdd").disabled = false;
};
