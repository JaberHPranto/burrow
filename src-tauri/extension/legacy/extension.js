/*
 * Burrow helper — GNOME Shell 42–44.
 *
 * GNOME on Wayland doesn't let regular apps watch the clipboard, but the Shell
 * can. This extension listens for clipboard changes and forwards the text to
 * Burrow over D-Bus (dev.burrow.Clipboard.Push). It does nothing else: no
 * storage, no network. Copies marked as passwords by password managers
 * (x-kde-passwordManagerHint) are skipped. It also keeps Burrow's window on
 * top when you pin it (see the window helper below).
 */
const { Gio, GLib, Meta, St } = imports.gi;

const BUS_NAME = "dev.burrow.Clipboard";
const OBJECT_PATH = "/dev/burrow/Clipboard";
const MAX_LENGTH = 200000;

// Window helper: Wayland apps can't keep themselves on top, but the Shell can.
// Burrow calls SetAbove(its own pid, true) when you pin it. Exported on the
// Shell's own bus connection (org.gnome.Shell) at /dev/burrow/Shell. The worst
// any caller can do is toggle "always on top" for a window.
const HELPER_VERSION = 2;
const HELPER_PATH = "/dev/burrow/Shell";
const HELPER_XML = `<node>
  <interface name="dev.burrow.Shell">
    <method name="Ping"><arg type="u" direction="out" name="version"/></method>
    <method name="SetAbove">
      <arg type="u" direction="in" name="pid"/>
      <arg type="b" direction="in" name="above"/>
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
};

let selection = null;
let handlerId = 0;
let helper = null;

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
  helper = Gio.DBusExportedObject.wrapJSObject(HELPER_XML, windowHelper);
  helper.export(Gio.DBus.session, HELPER_PATH);
  selection = global.display.get_selection();
  handlerId = selection.connect("owner-changed", onOwnerChanged);
}

function disable() {
  if (helper) helper.unexport();
  helper = null;
  if (selection && handlerId) selection.disconnect(handlerId);
  selection = null;
  handlerId = 0;
}
