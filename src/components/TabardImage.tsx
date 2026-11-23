import { createEffect, createSignal } from "solid-js";
import { packDesign, type Design } from "../../shared/tabard.ts";
import { frontUrl } from "../lib/tabardRender.ts";

/** The flat front view of a design, rendered in the browser. Keeps the previous image until the new one is ready. */
export function TabardImage(props: { design: Design; alt?: string; class?: string }) {
  const [src, setSrc] = createSignal<string>();
  createEffect(
    () => ({ key: packDesign(props.design), design: props.design }),
    ({ design }) => {
      let current = true;
      frontUrl(design).then(
        (url) => current && setSrc(url),
        () => {},
      );
      return () => {
        current = false;
      };
    },
  );
  return <img class={props.class} src={src()} alt={props.alt ?? ""} />;
}
