"""No credentials, OS registration or notifications; injectable platform boundaries."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from native_notifications import (
    ACTIVATION_URI, AUMID_KEY, PROTOCOL_KEY, OWNER, IdentityConflict,
    NativeIdentity, NativeToastBackend, activation_requested, launcher_command,
    notification_message,
)


class MemoryRegistry:
    def __init__(self):
        self.keys = {}
    def read(self, key):
        return self.keys.get(key)
    def write(self, key, values):
        self.keys.setdefault(key, {}).update(values)
    def delete(self, key):
        self.keys.pop(key, None)


class NativeTests(unittest.TestCase):
    def test_activation_is_exact_and_cannot_inject_commands(self):
        self.assertTrue(activation_requested(["--notification-activate", ACTIVATION_URI]))
        for args in [[],["--notification-activate"],["--notification-activate",ACTIVATION_URI,"--topics"],
                     ["--notification-activate",ACTIVATION_URI+"?command=evil"],
                     ["--notification-activate","file:///private"],
                     ["--notification-activate","https://example.test"],
                     ["--notification-activate",ACTIVATION_URI+'"; calc.exe']]:
            self.assertFalse(activation_requested(args))
        command = launcher_command([r"C:\Program Files\TokenJuice\tokenjuice.exe"])
        self.assertTrue(command.endswith('--notification-activate "%1"'))
        self.assertTrue(command.startswith(r'"C:\Program Files\TokenJuice\tokenjuice.exe"'))
        with self.assertRaises(ValueError):
            launcher_command(['bad"executable'])

    def test_event_filter_and_bound(self):
        events = [None, {}, {"title":"Other","body":"SECRET"}, {"title":"TokenJuice","body":[]},
                  {"title":"TokenJuice","body":"valid\x00body"}, {"title":"TokenJuice","body":"x"*1025}]
        self.assertEqual(notification_message(events),"validbody")
        self.assertLessEqual(len(notification_message([{"title":"TokenJuice","body":"x"*1024}]*20)),768)
        self.assertIsNone(notification_message([]))
        self.assertIsNone(notification_message("invalid"))

    def test_identity_idempotence_and_foreign_ownership(self):
        with tempfile.TemporaryDirectory() as folder:
            registry=MemoryRegistry(); shortcut=Path(folder)/"TokenJuice.lnk"
            writer=Mock(side_effect=lambda *_: shortcut.write_bytes(b"fixture link"))
            identity=NativeIdentity(registry,shortcut,writer)
            launcher=[r"C:\Program Files\TokenJuice\tokenjuice.exe"]
            identity.register(launcher)
            self.assertTrue(identity.ready())
            self.assertEqual(registry.keys[AUMID_KEY]["TokenJuiceOwner"],OWNER)
            identity.register(launcher)
            self.assertTrue(identity.ready())
            registry.keys[PROTOCOL_KEY]["TokenJuiceOwner"]="another-app"
            before={k:dict(v) for k,v in registry.keys.items()}
            with self.assertRaises(IdentityConflict):
                identity.unregister()
            self.assertEqual(registry.keys,before)
            self.assertTrue(shortcut.exists())
            with self.assertRaises(IdentityConflict):
                identity.register(launcher)

    def test_uninstall_removes_only_owned_entries_and_link(self):
        with tempfile.TemporaryDirectory() as folder:
            registry=MemoryRegistry(); shortcut=Path(folder)/"TokenJuice.lnk"
            keep=Path(folder)/"unrelated.txt";keep.write_text("keep")
            identity=NativeIdentity(registry,shortcut,lambda *_:shortcut.write_bytes(b"link"))
            identity.register([r"C:\tokenjuice.exe"])
            identity.unregister()
            self.assertFalse(identity.ready())
            self.assertFalse(shortcut.exists())
            self.assertTrue(keep.exists())
            self.assertFalse(registry.keys)
            identity.unregister()

    def test_partial_registration_is_not_ready(self):
        with tempfile.TemporaryDirectory() as folder:
            registry=MemoryRegistry();shortcut=Path(folder)/"TokenJuice.lnk"
            identity=NativeIdentity(registry,shortcut,Mock(side_effect=RuntimeError("fixture failure")))
            with self.assertRaises(RuntimeError):
                identity.register([r"C:\tokenjuice.exe"])
            self.assertFalse(identity.ready())

    def test_changed_shortcut_is_not_overwritten_or_deleted(self):
        with tempfile.TemporaryDirectory() as folder:
            registry=MemoryRegistry();shortcut=Path(folder)/"TokenJuice.lnk"
            identity=NativeIdentity(registry,shortcut,lambda *_:shortcut.write_bytes(b"owned"))
            identity.register([r"C:\tokenjuice.exe"])
            shortcut.write_bytes(b"changed by user")
            self.assertFalse(identity.ready())
            with self.assertRaises(IdentityConflict):
                identity.register([r"C:\tokenjuice.exe"])
            with self.assertRaises(IdentityConflict):
                identity.unregister()
            self.assertEqual(shortcut.read_bytes(),b"changed by user")

    def test_only_unchanged_owned_icon_is_removed(self):
        with tempfile.TemporaryDirectory() as folder:
            registry=MemoryRegistry();shortcut=Path(folder)/"TokenJuice.lnk";icon=Path(folder)/"brand.ico"
            identity=NativeIdentity(registry,shortcut,lambda *_:shortcut.write_bytes(b"link"),icon)
            identity.register([r"C:\tokenjuice.exe"],icon_bytes=b"\x00\x00\x01\x00fixture")
            self.assertEqual(registry.keys[AUMID_KEY]["IconUri"],str(icon))
            icon.write_bytes(b"user changed icon")
            identity.unregister()
            self.assertTrue(icon.exists())

    def test_native_toast_is_protocol_only_and_does_not_retry(self):
        library=Mock()
        library.WindowsToaster.return_value.toastNotifier.setting=0
        library.Toast.side_effect=lambda **kw:Mock(**kw)
        identity=Mock();identity.ready.return_value=True
        backend=NativeToastBackend(identity=identity,library=library)
        self.assertTrue(backend.ready)
        backend.show("observed threshold")
        toast=library.WindowsToaster.return_value.show_toast.call_args.args[0]
        self.assertEqual(toast.launch_action,ACTIVATION_URI)
        self.assertIn("observed threshold",toast.text_fields)
        self.assertIn("기록",toast.text_fields[-1])
        self.assertIsNone(toast.on_activated)
        library.WindowsToaster.return_value.show_toast.side_effect=RuntimeError("PRIVATE")
        with self.assertRaises(RuntimeError):
            backend.show("failed send")
        self.assertEqual(library.WindowsToaster.return_value.show_toast.call_count,2)
        backend.clear_history()
        library.WindowsToaster.return_value.clear_toasts.assert_called_once()

    def test_windows_notification_policy_is_not_bypassed_with_balloons(self):
        library=Mock()
        library.WindowsToaster.return_value.toastNotifier.setting=1
        identity=Mock();identity.ready.return_value=True
        backend=NativeToastBackend(identity=identity,library=library)
        self.assertFalse(backend.ready)
        self.assertFalse(backend.can_fallback)
        library.WindowsToaster.return_value.toastNotifier.setting=0
        backend.refresh_status()
        self.assertTrue(backend.ready)

    def test_unregistered_native_does_not_load_sdk(self):
        identity=Mock();identity.ready.return_value=False
        loader=Mock()
        backend=NativeToastBackend(identity=identity,loader=loader)
        self.assertFalse(backend.ready)
        loader.assert_not_called()


if __name__=="__main__":
    unittest.main()
