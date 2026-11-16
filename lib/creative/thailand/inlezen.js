// Bestand → iets wat de renderer kan tekenen: rechtop en in sRGB.
//
// Eerst laat ik de browser het doen via <img>. Die draait de foto volgens EXIF
// en zet kleur netjes om naar sRGB zodra hij op een canvas getekend wordt.
// Safari kan zo ook HEIC. Chrome en Firefox kunnen geen HEIC; dan gaat het via
// heic-to (libheif in een worker). Dat levert de ruwe P3-waarden van een iPhone
// zonder kleurbeheer; de shader zet die om (p3: true). libheif draait de foto
// zelf al rechtop, dus de EXIF-oriëntatie wordt dan bewust niet nog eens gebruikt.

const HEIC_NAAM = /\.(heic|heif)$/i;

export function isHeic(bestand) {
  return /hei[cf]/i.test(bestand.type) || HEIC_NAAM.test(bestand.name);
}

async function leesTags(bestand) {
  try {
    const { default: ExifReader } = await import("exifreader");
    return await ExifReader.load(bestand, { expanded: true });
  } catch {
    return null;
  }
}

export async function decodeer(bestand) {
  const url = URL.createObjectURL(bestand);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error("leeg");
    return {
      tekenbaar: img,
      breedte: img.naturalWidth,
      hoogte: img.naturalHeight,
      p3: false,
      sluit: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    if (!isHeic(bestand)) throw new Error(`${bestand.name} kan ik niet openen. Werkt het als JPG of PNG?`);
  }

  const { heicTo } = await import("heic-to");
  const bitmap = await heicTo({ blob: bestand, type: "bitmap" });
  const tags = await leesTags(bestand);
  const profiel = tags?.icc?.["ICC Description"]?.description ?? "";
  return {
    tekenbaar: bitmap,
    breedte: bitmap.width,
    hoogte: bitmap.height,
    // Een iPhone schiet in Display P3; zonder profiel ga ik daar ook van uit
    p3: !profiel || /p3/i.test(profiel),
    sluit: () => bitmap.close(),
  };
}

// Verkleind beeld voor het voorbeeld en de gloed (lange zijde max `zijde`)
export function maakVoorbeeld(gedecodeerd, zijde = 2048) {
  const schaal = Math.min(1, zijde / Math.max(gedecodeerd.breedte, gedecodeerd.hoogte));
  const b = Math.max(1, Math.round(gedecodeerd.breedte * schaal));
  const h = Math.max(1, Math.round(gedecodeerd.hoogte * schaal));
  const kanvas = document.createElement("canvas");
  kanvas.width = b;
  kanvas.height = h;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(gedecodeerd.tekenbaar, 0, 0, b, h);
  const beeld = ctx.getImageData(0, 0, b, h);
  kanvas.width = 1;
  kanvas.height = 1;
  return beeld;
}

// Kleine JPEG voor de fotostrook
export async function maakMiniatuur(gedecodeerd, zijde = 240) {
  const schaal = Math.min(1, zijde / Math.min(gedecodeerd.breedte, gedecodeerd.hoogte));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.max(1, Math.round(gedecodeerd.breedte * schaal));
  kanvas.height = Math.max(1, Math.round(gedecodeerd.hoogte * schaal));
  const ctx = kanvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(gedecodeerd.tekenbaar, 0, 0, kanvas.width, kanvas.height);
  const blob = await new Promise((klaar) => kanvas.toBlob(klaar, "image/jpeg", 0.8));
  kanvas.width = 1;
  kanvas.height = 1;
  return blob ? URL.createObjectURL(blob) : null;
}

// Wat ik meeneem naar de export: datum en camera. Geen locatie.
export async function leesExif(bestand) {
  const exif = (await leesTags(bestand))?.exif;
  if (!exif) return null;
  const tekst = (tag) => exif[tag]?.description?.toString().trim() || undefined;
  return {
    datum: tekst("DateTimeOriginal"),
    merk: tekst("Make"),
    model: tekst("Model"),
    lens: tekst("LensModel"),
  };
}
