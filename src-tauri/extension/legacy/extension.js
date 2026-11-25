/*
 * Burrow clipboard bridge — GNOME Shell 42–44.
 *
 * GNOME on Wayland doesn't let regular apps watch the clipboard, but the Shell
 * can. This extension listens for clipboard changes and forwards the text to
 * Burrow over D-Bus (dev.burrow.Clipboard.Push). It does nothing else: no
 * storage, no network. Copies marked as passwords by password managers
 * (x-kde-passwordManagerHint) are skipped.
 */
const { Gio, GLib, Meta, St } = imports.gi;

const BUS_NAME = "dev.burrow.Clipboard";
const OBJECT_PATH = "/dev/burrow/Clipboard";
const MAX_LENGTH = 200000;

let selection = null;
let handlerId = 0;

function push(text) {
  Gio.DBus.session.call(
    BUS_NAME,
    OBJECT_PATH,
    BUS_NAME,
    "Push",
    new GLib.Variant("(s)", [text]),
    null,
    Gio.DBusCallFlags.NO_AUTO_START,
    1000,
    null,
    null, // fire and forget: Burrow may not be running
  );
}

function onOwnerChanged(sel, type) {
  if (type !== Meta.SelectionType.SELECTION_CLIPBOARD) return;
  const mimetypes = sel.get_mimetypes(type);
  if (mimetypes.includes("x-kde-passwordManagerHint")) return;
  St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
    if (text && text.length <= MAX_LENGTH) push(text);
  });
}

function init() {}

function enable() {
  selection = global.display.get_selection();
  handlerId = selection.connect("owner-changed", onOwnerChanged);
}

function disable() {
  if (selection && handlerId) selection.disconnect(handlerId);
  selection = null;
  handlerId = 0;
}
