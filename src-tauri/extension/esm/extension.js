import GLib from "gi://GLib";
/*
 * Burrow helper — GNOME Shell 45+ (ES modules).
 * Same behaviour as ../legacy/extension.js: forward clipboard text to Burrow
 * over D-Bus (skipping password-manager copies, storing nothing), and keep
 * Burrow's window on top when it's pinned.
 */
import Gio from "gi://Gio";
import Meta from "gi://Meta";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BUS_NAME = "dev.burrow.Clipboard";
const OBJECT_PATH = "/dev/burrow/Clipboard";
const MAX_LENGTH = 200000;

// Window helper: Wayland apps can't keep themselves on top, but the Shell can.
// Burrow calls SetAbove(its own pid, true) when you pin it, and Center(its own
// pid) each time it opens (Wayland apps can't position themselves either).
// Exported on the Shell's own bus connection (org.gnome.Shell) at
// /dev/burrow/Shell. The worst any caller can do is toggle "always on top" for
// a window or move it to the middle of the monitor the pointer is on.
const HELPER_VERSION = 3;
const HELPER_PATH = "/dev/burrow/Shell";
const HELPER_XML = `<node>
  <interface name="dev.burrow.Shell">
    <method name="Ping"><arg type="u" direction="out" name="version"/></method>
    <method name="SetAbove">
      <arg type="u" direction="in" name="pid"/>
      <arg type="b" direction="in" name="above"/>
      <arg type="b" direction="out" name="found"/>
    </method>
    <method name="Center">
      <arg type="u" direction="in" name="pid"/>
      <arg type="b" direction="out" name="found"/>
    </method>
  </interface>
</node>`;

const windowHelper = {
  Ping() {
    return HELPER_VERSION;
  },
  SetAbove(pid, above) {
    let found = false;
    for (const actor of global.get_window_actors()) {
      const win = actor.get_meta_window();
      if (!win || win.get_pid() !== pid) continue;
      found = true;
      if (above) win.make_above();
      else win.unmake_above();
    }
    return found;
  },
  // Centre the pid's window on the monitor under the pointer (Spotlight-style).
  // Returns false until the window is mapped and has a size, so callers retry.
  Center(pid) {
    for (const actor of global.get_window_actors()) {
      const win = actor.get_meta_window();
      if (!win || win.get_pid() !== pid) continue;
      const monitor = global.display.get_current_monitor();
      if (win.get_monitor() !== monitor) win.move_to_monitor(monitor);
      const frame = win.get_frame_rect();
      if (frame.width === 0 || frame.height === 0) return false;
      const area = win.get_work_area_for_monitor(monitor);
      win.move_frame(
        true,
        area.x + Math.round((area.width - frame.width) / 2),
        area.y + Math.round((area.height - frame.height) / 2),
      );
      return true;
    }
    return false;
  },
};

export default class BurrowClipboardExtension extends Extension {
  enable() {
    this._helper = Gio.DBusExportedObject.wrapJSObject(HELPER_XML, windowHelper);
    this._helper.export(Gio.DBus.session, HELPER_PATH);
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
    this._helper?.unexport();
    this._helper = null;
    if (this._selection && this._handlerId) this._selection.disconnect(this._handlerId);
    this._selection = null;
    this._handlerId = 0;
  }
}
