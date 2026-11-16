// Bakt de LUT buiten de hoofdthread, zodat het schuiven met de sliders vloeiend blijft
import { bakLut, lookVoor } from "./look.mjs";

self.onmessage = ({ data }) => {
  const lut = bakLut(lookVoor(data.schuifjes), data.N);
  self.postMessage({ id: data.id, N: data.N, lut }, [lut.buffer]);
};
