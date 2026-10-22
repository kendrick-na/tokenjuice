"""Windows native toast transport. No quota maths, credentials or policy changes."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import importlib
from hashlib import sha256
import os
from pathlib import Path
import re
import subprocess
import sys

AUMID = "TokenJuice.Desktop"
PROTOCOL = "tokenjuice-native"
ACTIVATION_URI = PROTOCOL + "://status"
OWNER = "e1f8d179-fcf1-4ec3-835c-095e486a62ec"
STUB_CLSID = "{E1F8D179-FCF1-4EC3-835C-095E486A62EC}"
AUMID_KEY = "Software\\Classes\\AppUserModelId\\" + AUMID
PROTOCOL_KEY = "Software\\Classes\\" + PROTOCOL
COMMAND_KEY = PROTOCOL_KEY + "\\shell\\open\\command"
KEYS = (AUMID_KEY, PROTOCOL_KEY, PROTOCOL_KEY+"\\shell", PROTOCOL_KEY+"\\shell\\open", COMMAND_KEY)


def activation_requested(args):
    return args == ["--notification-activate", ACTIVATION_URI]


def launcher_command(launcher):
    if not launcher or any(not isinstance(part,str) or not part or
                           any(char in part for char in ['"', "\x00", "\n", "\r"]) or "%1" in part
                           for part in launcher):
        raise ValueError("Invalid notification launcher")
    return subprocess.list2cmdline([*launcher,"--notification-activate"]) + ' "%1"'


def notification_message(events, limit=768):
    if not isinstance(events,list):
        return None
    bodies=[]
    for event in events[:20]:
        if not isinstance(event,dict) or event.get("title")!="TokenJuice":
            continue
        body=event.get("body")
        if isinstance(body,str) and 0<len(body)<=1024:
            clean=re.sub(r"[\x00-\x08\x0b-\x1f\x7f]","",body).strip()
            if clean:
                bodies.append(clean)
    message="\n".join(bodies)
    if not message:
        return None
    return message if len(message)<=limit else message[:limit-1]+"…"


class IdentityConflict(RuntimeError):
    pass


class WindowsRegistry:
    """All keys are fixed current-user product keys, never arbitrary targets."""
    def __init__(self):
        if sys.platform!="win32":
            raise OSError("Windows only")
        import winreg
        self.reg=winreg

    def read(self,path):
        reg=self.reg
        try:
            with reg.OpenKey(reg.HKEY_CURRENT_USER,path) as key:
                result={}
                index=0
                while True:
                    try:
                        name,value,_=reg.EnumValue(key,index)
                        result[name]=value
                        index+=1
                    except OSError:
                        break
                return result
        except FileNotFoundError:
            return None

    def write(self,path,values):
        reg=self.reg
        with reg.CreateKeyEx(reg.HKEY_CURRENT_USER,path,0,reg.KEY_WRITE) as key:
            for name,value in values.items():
                reg.SetValueEx(key,name,0,reg.REG_DWORD if isinstance(value,int) else reg.REG_SZ,value)

    def delete(self,path):
        try:
            self.reg.DeleteKey(self.reg.HKEY_CURRENT_USER,path)
        except FileNotFoundError:
            pass


class NativeIdentity:
    def __init__(self,registry,shortcut,link_writer,icon_path=None):
        self.registry=registry
        self.shortcut=Path(shortcut)
        self.link_writer=link_writer
        self.icon_path=Path(icon_path) if icon_path else None

    def _owned(self):
        for key in (AUMID_KEY,PROTOCOL_KEY):
            values=self.registry.read(key)
            if values is not None and values.get("TokenJuiceOwner")!=OWNER:
                raise IdentityConflict("Existing notification identity belongs to another installation")
        protocol=self.registry.read(PROTOCOL_KEY) or {}
        command=self.registry.read(COMMAND_KEY) or {}
        expected=protocol.get("TokenJuiceCommand")
        if expected and command.get("")!=expected:
            raise IdentityConflict("Notification protocol command was changed outside this installer")
        root=self.registry.read(AUMID_KEY) or {}
        digest=root.get("TokenJuiceShortcutSha256")
        if self.shortcut.is_symlink() or (digest and self.shortcut.is_file() and
                sha256(self.shortcut.read_bytes()).hexdigest()!=digest):
            raise IdentityConflict("Notification shortcut was changed outside this installer")

    def ready(self):
        try:
            self._owned()
            roots=[self.registry.read(key) for key in (AUMID_KEY,PROTOCOL_KEY)]
            command=self.registry.read(COMMAND_KEY)
            return all(root and root.get("TokenJuiceReady")==1 for root in roots) and bool(
                command and command.get("") and self.shortcut.is_file())
        except Exception:
            return False

    def register(self,launcher,icon_bytes=None):
        command=launcher_command(launcher)
        self._owned()
        if self.shortcut.exists() and not self.registry.read(AUMID_KEY):
            raise IdentityConflict("Refusing to overwrite an unowned Start Menu shortcut")
        root=self.registry.read(AUMID_KEY) or {}
        if self.icon_path and self.icon_path.exists():
            digest=root.get("TokenJuiceIconSha256")
            if self.icon_path.is_symlink() or not root or (
                    digest and sha256(self.icon_path.read_bytes()).hexdigest()!=digest):
                raise IdentityConflict("Refusing to overwrite an unowned notification icon")
        # Ready is committed only after the shortcut and every key are written.
        # Failed installs remain visibly unready and can be explicitly repaired.
        marker={"TokenJuiceOwner":OWNER,"TokenJuiceReady":0}
        self.registry.write(AUMID_KEY,marker)
        self.registry.write(PROTOCOL_KEY,marker)
        self.shortcut.parent.mkdir(parents=True,exist_ok=True)
        if self.icon_path and icon_bytes:
            if not isinstance(icon_bytes,bytes) or len(icon_bytes)>512*1024 or not icon_bytes.startswith(b"\x00\x00\x01\x00"):
                raise ValueError("Invalid notification icon")
            self.icon_path.parent.mkdir(parents=True,exist_ok=True)
            self.icon_path.write_bytes(icon_bytes)
            self.registry.write(AUMID_KEY,{"IconUri":str(self.icon_path),
                "TokenJuiceIconSha256":sha256(icon_bytes).hexdigest()})
            self.link_writer(self.shortcut,launcher,AUMID,STUB_CLSID,str(self.icon_path))
        else:
            self.link_writer(self.shortcut,launcher,AUMID,STUB_CLSID)
        self.registry.write(AUMID_KEY,{"DisplayName":"TokenJuice","CustomActivator":STUB_CLSID})
        self.registry.write(PROTOCOL_KEY,{"":"URL:TokenJuice notification","URL Protocol":""})
        for key in KEYS[2:-1]:
            self.registry.write(key,{})
        self.registry.write(COMMAND_KEY,{"":command})
        self.registry.write(PROTOCOL_KEY,{"TokenJuiceCommand":command})
        self.registry.write(AUMID_KEY,{"TokenJuiceShortcutSha256":sha256(self.shortcut.read_bytes()).hexdigest()})
        for key in (AUMID_KEY,PROTOCOL_KEY):
            self.registry.write(key,{"TokenJuiceReady":1})

    def unregister(self):
        self._owned()  # Validate every root before removing anything.
        owned=any(self.registry.read(key) for key in (AUMID_KEY,PROTOCOL_KEY))
        if not owned:
            return
        icon_hash=(self.registry.read(AUMID_KEY) or {}).get("TokenJuiceIconSha256")
        # Do not recursively delete unknown child keys or unrelated files.
        for key in reversed(KEYS):
            self.registry.delete(key)
        if self.shortcut.is_file() and not self.shortcut.is_symlink():
            self.shortcut.unlink()
        if self.icon_path and self.icon_path.is_file() and not self.icon_path.is_symlink() and icon_hash and sha256(self.icon_path.read_bytes()).hexdigest()==icon_hash:
            self.icon_path.unlink()


def default_identity():
    from native_shortcut import create_shell_link
    appdata=os.environ.get("APPDATA")
    localdata=os.environ.get("LOCALAPPDATA")
    if not appdata or not localdata:
        raise OSError("Windows user profile unavailable")
    shortcut=Path(appdata)/"Microsoft"/"Windows"/"Start Menu"/"Programs"/"TokenJuice.lnk"
    icon=Path(localdata)/"TokenJuice"/"Notifications"/(OWNER+".ico")
    return NativeIdentity(WindowsRegistry(),shortcut,create_shell_link,icon)


def current_launcher(script):
    executable=Path(sys.executable)
    if getattr(sys,"frozen",False):
        return [str(executable)]
    pythonw=executable.with_name("pythonw.exe")
    return [str(pythonw if pythonw.is_file() else executable),str(Path(script).resolve())]


class NativeToastBackend:
    def __init__(self,identity=None,library=None,loader=importlib.import_module):
        self.ready=False
        self.toaster=None
        self.library=None
        self.can_fallback=True
        self.last_error=None
        try:
            identity=identity or default_identity()
            if not identity.ready():
                return
            library=library or loader("windows_toasts")
            self.toaster=library.WindowsToaster(AUMID)
            self.library=library
            self.refresh_status()
        except Exception:
            # No backend error strings: they can include private local paths.
            self.ready=False

    def refresh_status(self):
        if self.toaster is None:
            return
        self.can_fallback=False
        try:
            # NotificationSetting.ENABLED == 0. Never route around OS policy
            # through a balloon when the registered native app is disabled.
            self.ready=int(self.toaster.toastNotifier.setting)==0
        except Exception:
            self.ready=False

    def show(self,message):
        if not self.ready:
            raise RuntimeError("Native notifications unavailable")
        now=datetime.now(timezone.utc)
        toast=self.library.Toast(
            text_fields=["사용량 알림 기록",message,"알림 발생 시점의 기록 · 클릭하여 현재 상태 확인"],
            launch_action=ACTIVATION_URI,
            expiration_time=now+timedelta(days=1),
            timestamp=now,
            on_activated=None,
            on_failed=lambda *_:setattr(self,"last_error","Windows 알림 표시 실패 · 알림 설정을 확인하세요."),
        )
        self.last_error=None
        self.toaster.show_toast(toast)

    def clear_history(self):
        if self.toaster is None:
            raise RuntimeError("Native notifications unavailable")
        self.toaster.clear_toasts()  # This registered AUMID only.
        self.last_error=None
