import { For, Show, createSignal } from "solid-js";
import { decodeCode, encodeCode, type Design } from "../../shared/tabard.ts";
import { TabardImage } from "./TabardImage.tsx";

export type SavedDesign = { name: string; design: Design; savedAt: number };

type Props = {
  design: Design;
  saved: SavedDesign[];
  onLoad: (design: Partial<Design>) => void;
  onSave: (name: string) => void;
  onDelete: (index: number) => void;
};

export function SharePanel(props: Props) {
  const [message, setMessage] = createSignal<{ text: string; error?: boolean } | null>(null);

  const code = () => encodeCode(props.design);

  const flash = (text: string, error = false) => {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 2500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code());
      flash("Copied!");
    } catch {
      flash("Select the code and press Ctrl+C", true);
    }
  };

  const tryPaste = (input: HTMLInputElement, quiet: boolean) => {
    const text = input.value;
    if (!text.trim()) return;
    const r = decodeCode(text);
    if ("error" in r) return quiet ? undefined : flash(r.error, true);
    props.onLoad(r.design);
    input.value = "";
    flash(r.name ? `Loaded “${r.name}”` : "Design loaded");
  };

  return (
    <div class="share">
      <section class="panel-section">
        <h3 class="section-title">Share this design</h3>
        <div class="code-row">
          <input class="code" readonly value={code()} onFocus={(e) => e.currentTarget.select()} aria-label="Design code" />
          <button type="button" class="btn" onClick={copy}>
            Copy code
          </button>
        </div>
        <label class="field">
          <span>Paste a code (or a whole chat line)</span>
          <input
            type="text"
            placeholder="TS1:43.6.4.13.28"
            onInput={(e) => tryPaste(e.currentTarget, true)}
            onChange={(e) => tryPaste(e.currentTarget, false)}
          />
        </label>
        <Show when={message()}>{(m) => <p class={["message", { error: m().error }]}>{m().text}</p>}</Show>
        <p class="hint">
          Codes are compatible with the <em>Tabard Studio</em> addon (Retail, Classic and Forever).
        </p>
      </section>

      <section class="panel-section">
        <h3 class="section-title">
          My designs
          <button
            type="button"
            class="link-btn small"
            onClick={() => {
              props.onSave(`Design ${props.saved.length + 1}`);
              flash("Saved");
            }}
          >
            + Save current
          </button>
        </h3>
        <Show when={props.saved.length} fallback={<p class="hint">Saved designs are kept in this browser.</p>}>
          <ul class="saved">
            <For each={props.saved}>
              {(s, i) => (
                <li>
                  <button type="button" class="saved-load" onClick={() => props.onLoad(s.design)} title="Load">
                    <TabardImage design={s.design} />
                    <span class="saved-name">{s.name}</span>
                    <span class="saved-code">{encodeCode(s.design)}</span>
                  </button>
                  <button type="button" class="saved-delete" aria-label={`Delete ${s.name}`} onClick={() => props.onDelete(i())}>
                    ×
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </div>
  );
}
