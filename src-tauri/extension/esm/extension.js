import GLib from "gi://GLib";
/*
 * Burrow clipboard bridge — GNOME Shell 45+ (ES modules).
 * Same behaviour as ../legacy/extension.js: forward clipboard text to Burrow
 * over D-Bus, skip password-manager copies, store nothing.
 */
import Gio from "gi://Gio";
import Meta from "gi://Meta";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BUS_NAME = "dev.burrow.Clipboard";
const OBJECT_PATH = "/dev/burrow/Clipboard";
const MAX_LENGTH = 200000;

export default class BurrowClipboardExtension extends Extension {
  enable() {
    this._selection = global.display.get_selection();
    this._handlerId = this._selection.connect("owner-changed", (sel, type) => {
      if (type !== Meta.SelectionType.SELECTION_CLIPBOARD) return;
      if (sel.get_mimetypes(type).includes("x-kde-passwordManagerHint")) return;
      St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
        if (!text || text.length > MAX_LENGTH) return;
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
          null,
        );
      });
    });
  }

  disable() {
    if (this._selection && this._handlerId) this._selection.disconnect(this._handlerId);
    this._selection = null;
    this._handlerId = 0;
  }
}
