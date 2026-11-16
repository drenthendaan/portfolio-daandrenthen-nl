// Van pixels naar een bestand dat je kunt bewaren: JPEG, opnamedatum en camera
// terugzetten (zonder locatie), en dan delen of downloaden.

import { zipSync } from "fflate";

export function bestandsnaam(origineel) {
  return `${origineel.replace(/\.[^.]+$/, "")}-thailand.jpg`;
}

// Gooit een fout als het canvas te groot is voor dit apparaat; de aanroeper
// probeert het dan kleiner.
export async function naarJpeg({ pixels, breedte, hoogte }, kwaliteit = 0.92) {
  const kanvas = document.createElement("canvas");
  kanvas.width = breedte;
  kanvas.height = hoogte;
  try {
    const ctx = kanvas.getContext("2d", { colorSpace: "srgb" });
    if (!ctx) throw new Error("Te groot canvas");
    ctx.putImageData(new ImageData(pixels, breedte, hoogte), 0, 0);
    const blob = await new Promise((klaar) => kanvas.toBlob(klaar, "image/jpeg", kwaliteit));
    if (!blob) throw new Error("Te groot canvas");
    return blob;
  } finally {
    kanvas.width = 1;
    kanvas.height = 1;
  }
}

// canvas.toBlob gooit alle metadata weg. Datum en camera zet ik terug, zodat de
// foto in je fotobibliotheek op de goede dag staat. De oriëntatie staat al in
// de pixels, dus die wordt 1; GPS neem ik bewust niet over.
export async function metExif(jpeg, exif) {
  if (!exif) return jpeg;
  try {
    const { default: piexif } = await import("piexifjs");
    const nul = { [piexif.ImageIFD.Orientation]: 1, [piexif.ImageIFD.Software]: "Thailand-filter (daandrenthen.nl)" };
    const details = {};
    if (exif.merk) nul[piexif.ImageIFD.Make] = exif.merk;
    if (exif.model) nul[piexif.ImageIFD.Model] = exif.model;
    if (exif.datum) {
      nul[piexif.ImageIFD.DateTime] = exif.datum;
      details[piexif.ExifIFD.DateTimeOriginal] = exif.datum;
      details[piexif.ExifIFD.DateTimeDigitized] = exif.datum;
    }
    if (exif.lens) details[piexif.ExifIFD.LensModel] = exif.lens;
    const blok = piexif.dump({ "0th": nul, Exif: details });

    // APP1-segment ("Exif\0\0" + TIFF) direct na de SOI-marker, zoals piexif.insert doet
    const app1 = new Uint8Array(4 + blok.length);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1[2] = (blok.length + 2) >> 8;
    app1[3] = (blok.length + 2) & 0xff;
    for (let i = 0; i < blok.length; i++) app1[4 + i] = blok.charCodeAt(i);
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    return new Blob([bytes.subarray(0, 2), app1, bytes.subarray(2)], { type: "image/jpeg" });
  } catch {
    return jpeg; // liever een foto zonder datum dan geen foto
  }
}

// Op een telefoon wil je naar je fotobibliotheek: dat gaat via het deelmenu
export function deeltNaarFotos(bestanden) {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: bestanden });
  } catch {
    return false;
  }
}

export function download(bestand) {
  const url = URL.createObjectURL(bestand);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestand.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function alsZip(bestanden, naam = "thailand-filter.zip") {
  const inhoud = {};
  for (const { naam: bestandNaam, bytes } of bestanden) {
    // JPEG is al gecomprimeerd: alleen opslaan, niet nog eens inpakken
    inhoud[bestandNaam] = [bytes, { level: 0 }];
  }
  return new File([zipSync(inhoud)], naam, { type: "application/zip" });
}

// Geeft "gedeeld", "gedownload" of "geannuleerd". Een NotAllowedError (de klik
// is te lang geleden voor het deelmenu) gooit hij door, zodat de knop het
// opnieuw kan vragen.
export async function bewaar(bestanden) {
  if (deeltNaarFotos(bestanden)) {
    try {
      await navigator.share({ files: bestanden });
      return "gedeeld";
    } catch (fout) {
      if (fout?.name === "AbortError") return "geannuleerd";
      throw fout;
    }
  }
  if (bestanden.length === 1) {
    download(bestanden[0]);
    return "gedownload";
  }
  const metBytes = await Promise.all(
    bestanden.map(async (f) => ({ naam: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
  download(alsZip(metBytes));
  return "gedownload";
}
