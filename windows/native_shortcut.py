"""Small Win32 COM interop for the owned Start Menu notification shortcut."""
import ctypes
from pathlib import Path
import subprocess
import sys
import uuid


def create_shell_link(path,launcher,aumid,stub_clsid,icon_path=None):
    if sys.platform!="win32":
        raise OSError("Windows only")
    from ctypes import wintypes

    class GUID(ctypes.Structure):
        _fields_=[("Data1",wintypes.DWORD),("Data2",wintypes.WORD),
                  ("Data3",wintypes.WORD),("Data4",ctypes.c_ubyte*8)]
        @classmethod
        def of(cls,value):
            return cls.from_buffer_copy(uuid.UUID(value.strip("{}")).bytes_le)

    class PROPERTYKEY(ctypes.Structure):
        _fields_=[("fmtid",GUID),("pid",wintypes.DWORD)]

    class VALUE(ctypes.Union):
        _fields_=[("pointer",ctypes.c_void_p),
                  ("storage",ctypes.c_ubyte*(ctypes.sizeof(ctypes.c_void_p)*2))]

    class PROPVARIANT(ctypes.Structure):
        _anonymous_=("value",)
        _fields_=[("vt",wintypes.WORD),("r1",wintypes.WORD),("r2",wintypes.WORD),
                  ("r3",wintypes.WORD),("value",VALUE)]

    def checked(hr):
        if hr<0:
            raise OSError("Could not write notification shortcut")

    def invoke(obj,index,args,*values):
        address=ctypes.cast(obj,ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents[index]
        call=ctypes.WINFUNCTYPE(wintypes.LONG,ctypes.c_void_p,*args)(address)
        result=call(obj,*values)
        checked(result)
        return result

    def query(obj,iid):
        result=ctypes.c_void_p()
        guid=GUID.of(iid)
        invoke(obj,0,[ctypes.POINTER(GUID),ctypes.POINTER(ctypes.c_void_p)],ctypes.byref(guid),ctypes.byref(result))
        return result

    ole=ctypes.OleDLL("ole32")
    ole.CoInitializeEx.argtypes=[ctypes.c_void_p,wintypes.DWORD]
    ole.CoInitializeEx.restype=wintypes.LONG
    hr=ole.CoInitializeEx(None,2)
    # Existing MTA is valid; only balance initializations performed here.
    initialized=hr>=0
    if hr<0 and hr!=-2147417850:
        checked(hr)
    link=store=persist=None
    try:
        clsid=GUID.of("00021401-0000-0000-C000-000000000046")
        iid=GUID.of("000214F9-0000-0000-C000-000000000046")
        link=ctypes.c_void_p()
        ole.CoCreateInstance.argtypes=[ctypes.POINTER(GUID),ctypes.c_void_p,wintypes.DWORD,
                                      ctypes.POINTER(GUID),ctypes.POINTER(ctypes.c_void_p)]
        ole.CoCreateInstance.restype=wintypes.LONG
        checked(ole.CoCreateInstance(ctypes.byref(clsid),None,1,ctypes.byref(iid),ctypes.byref(link)))
        invoke(link,20,[wintypes.LPCWSTR],launcher[0])
        invoke(link,11,[wintypes.LPCWSTR],subprocess.list2cmdline(launcher[1:]))
        invoke(link,9,[wintypes.LPCWSTR],str(Path(launcher[-1]).parent))
        invoke(link,7,[wintypes.LPCWSTR],"TokenJuice usage and notification status")
        invoke(link,15,[ctypes.c_int],7)
        if icon_path:
            invoke(link,17,[wintypes.LPCWSTR,ctypes.c_int],icon_path,0)
        store=query(link,"886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")
        fmtid=GUID.of("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3")
        text=ctypes.create_unicode_buffer(aumid)
        stub=GUID.of(stub_clsid)
        for pid,vt,ptr in [(5,31,ctypes.cast(text,ctypes.c_void_p)),
                           (26,72,ctypes.cast(ctypes.pointer(stub),ctypes.c_void_p))]:
            key=PROPERTYKEY(fmtid,pid)
            value=PROPVARIANT()
            value.vt=vt
            value.pointer=ptr
            invoke(store,6,[ctypes.POINTER(PROPERTYKEY),ctypes.POINTER(PROPVARIANT)],
                   ctypes.byref(key),ctypes.byref(value))
        invoke(store,7,[])
        persist=query(link,"0000010B-0000-0000-C000-000000000046")
        invoke(persist,6,[wintypes.LPCWSTR,wintypes.BOOL],str(Path(path).resolve()),True)
        # Round-trip the actual .lnk; a successful Save alone is insufficient.
        invoke(persist,5,[wintypes.LPCWSTR,wintypes.DWORD],str(Path(path).resolve()),0)
        ole.PropVariantClear.argtypes=[ctypes.POINTER(PROPVARIANT)]
        ole.PropVariantClear.restype=wintypes.LONG
        for pid,expected in ((5,aumid),(26,uuid.UUID(stub_clsid.strip("{}")))):
            key=PROPERTYKEY(fmtid,pid)
            value=PROPVARIANT()
            try:
                invoke(store,5,[ctypes.POINTER(PROPERTYKEY),ctypes.POINTER(PROPVARIANT)],
                       ctypes.byref(key),ctypes.byref(value))
                if pid==5:
                    actual=ctypes.wstring_at(value.pointer) if value.vt==31 and value.pointer else None
                else:
                    actual=uuid.UUID(bytes_le=bytes(ctypes.cast(value.pointer,ctypes.POINTER(GUID)).contents)) if value.vt==72 and value.pointer else None
                if actual!=expected:
                    raise OSError("Notification shortcut identity did not round-trip")
            finally:
                ole.PropVariantClear(ctypes.byref(value))
    finally:
        for obj in (persist,store,link):
            if obj and obj.value:
                address=ctypes.cast(obj,ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents[2]
                ctypes.WINFUNCTYPE(wintypes.ULONG,ctypes.c_void_p)(address)(obj)
        if initialized:
            ole.CoUninitialize()
