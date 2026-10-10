"""Synthetic-only selected file/summary handoff acceptance."""
import json,time,os,subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright,expect
with TemporaryDirectory() as directory,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":375,"height":812})
    errors=[];requests=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.on("request",lambda request:requests.append(request.url))
    page.goto("http://127.0.0.1:4173/",wait_until="networkidle")
    page.locator("#work-panel > summary").click()
    summary=Path(directory)/"summary.txt";summary.write_text("현재 목표. 수정 완료 주장. 다음은 테스트.",encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-editor")).to_be_visible()
    page.locator(".work-files-panel > summary").click()
    evidence={"format":"tokenjuice-worktree-evidence-v1","privacy":"explicit_relative_paths","reviewed":True,
        "createdAt":int(time.time()*1000)-7200000,"head":"a"*40,"branch":"feature/hand-off","excluded":0,
        "files":[{"path":"src/한글 파일.js","indexStatus":" ","worktreeStatus":"M","raw":"SECRET"},
            {"path":"do-not-share.js","indexStatus":"?","worktreeStatus":"?"},
            {"path":".env","indexStatus":"?","worktreeStatus":"?"}],"raw":"SECRET"}
    source=Path(directory)/"files.json";source.write_text(json.dumps(evidence),encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-content")).to_be_visible()
    assert page.locator("#work-files-list input").count()==2
    assert "1시간 이상" in page.locator("#work-files-list").inner_text()
    assert "SECRET" not in page.locator("#work-panel").inner_text()
    assert not page.locator("#work-files-review").is_checked()
    assert page.locator("#work-package").is_disabled()
    page.locator("#work-files-list input").first.check()
    page.locator("#work-files-review").check();page.locator("#work-review").check()
    expect(page.locator("#work-package")).to_be_enabled()
    with page.expect_download() as result:page.locator("#work-package").click()
    package=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert len(package["worktree"]["files"])==1
    assert "do-not-share.js" not in json.dumps(package) and "SECRET" not in json.dumps(package)
    with page.expect_download() as result:page.locator("#work-download").click()
    basic=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert basic["format"]=="tokenjuice-work-summary-v1" and "worktree" not in basic
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}})")
    page.locator("#work-copy").click();page.wait_for_function("typeof window.copied==='string'")
    assert "src/한글 파일.js" in page.evaluate("window.copied")
    assert "완료/테스트 증거 아님" in page.evaluate("window.copied")
    page.locator("#work-next").fill("파일 상태 재확인")
    assert not page.locator("#work-files-review").is_checked() and not page.locator("#work-review").is_checked()
    assert page.locator("#work-package").is_disabled()
    before=page.locator("#work-files-meta").inner_text()
    source.write_text("{broken",encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-feedback")).to_contain_text("기존 목록은 유지")
    assert before==page.locator("#work-files-meta").inner_text()
    summary.write_text(json.dumps(package),encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-files-list input")).to_have_count(1)
    assert not page.locator("#work-files-list input").is_checked()
    assert not page.locator("#work-files-review").is_checked() and not page.locator("#work-review").is_checked()
    page.locator("#work-files-list input").focus();page.keyboard.press("Space")
    assert page.locator("#work-files-list input").is_checked()
    committed={"format":"tokenjuice-commit-evidence-v1","privacy":"explicit_relative_paths","reviewed":False,
        "createdAt":int(time.time()*1000)-1000,"head":"a"*40,"branch":"feature/hand-off",
        "scope":"latest_five_first_parent_commits","commits":[{"hash":"a"*40,"excluded":0,
            "files":[{"path":"committed.js","status":"M","raw":"SECRET"},{"path":".env","status":"A"}]},
            {"hash":"b"*40,"excluded":0,"files":[{"path":"skip-commit.js","status":"D"}]}],"author":"SECRET"}
    source.write_text(json.dumps(committed),encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-list input")).to_have_count(3)
    assert "현재 미커밋 변경" in page.locator("#work-files-list").inner_text()
    assert "커밋된 변경" in page.locator("#work-files-list").inner_text()
    assert "SECRET" not in page.locator("#work-panel").inner_text()
    assert page.locator("#work-files-list input:checked").count()==0
    page.locator("#work-files-list input").nth(0).check();page.locator("#work-files-list input").nth(1).check()
    page.locator("#work-files-review").check();page.locator("#work-review").check()
    with page.expect_download() as result:page.locator("#work-package").click()
    combined=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert combined["format"]=="tokenjuice-work-handoff-v2"
    assert len(combined["worktree"]["files"])==1 and len(combined["commits"]["commits"])==1
    assert "skip-commit.js" not in json.dumps(combined) and "SECRET" not in json.dumps(combined)
    page.locator("#work-copy").click()
    expect(page.locator("#work-feedback")).to_contain_text("복사")
    assert "committed.js" in page.evaluate("window.copied") and "현재 미커밋 상태/완료/테스트 증거 아님" in page.evaluate("window.copied")
    summary.write_text(json.dumps(combined),encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-files-list input")).to_have_count(2)
    assert page.locator("#work-files-list input:checked").count()==0
    assert not page.locator("#work-files-review").is_checked() and not page.locator("#work-review").is_checked()
    malformed={**committed,"head":"invalid"}
    source.write_text(json.dumps(malformed),encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-feedback")).to_contain_text("기존 목록은 유지")
    assert page.locator("#work-files-list input").count()==2
    for width,height in [(375,812),(812,375),(1280,900)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.set_viewport_size({"width":375,"height":812})
    page.locator(".work-files-panel").screenshot(path="/tmp/tokenjuice-work-files-mobile.png")
    page.emulate_media(reduced_motion="reduce");page.evaluate("document.documentElement.style.fontSize='32px'")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert all(row.bounding_box()["height"]>=44 for row in page.locator(".work-file-row").all())
    assert page.locator("#work-files-remove").bounding_box()["height"]>=44
    # Commit-only handoffs remain usable, without inventing pending files.
    summary.write_text(json.dumps(basic),encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-files-content")).to_be_hidden()
    source.write_text(json.dumps(committed),encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    page.locator("#work-files-list input").first.check()
    page.locator("#work-files-review").check();page.locator("#work-review").check()
    with page.expect_download() as result:page.locator("#work-package").click()
    commit_only=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert commit_only["worktree"] is None and len(commit_only["commits"]["commits"])==1
    page.locator("#work-files-remove").click()
    assert page.locator("#work-files-content").is_hidden()
    page.locator("#work-review").check();expect(page.locator("#work-copy")).to_be_enabled()
    # Exercise the actual CLI -> JSON -> UI -> download -> reopen boundary.
    # Only this disposable repository is observed, never the user's checkout.
    repo=(Path(directory)/"isolated-repository").resolve();repo.mkdir()
    hooks=Path(directory)/"empty-hooks";hooks.mkdir()
    env={key:value for key,value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1",GIT_CONFIG_GLOBAL=os.devnull,GIT_OPTIONAL_LOCKS="0")
    def run(args):
        return subprocess.run(args,env=env,check=True,capture_output=True,text=True,timeout=20).stdout
    def git(*args):
        return run(["git","-C",str(repo),"-c",f"core.hooksPath={hooks}","-c","commit.gpgsign=false",*args])
    git("init","-b","main");git("config","user.name","PRIVATE_AUTHOR")
    git("config","user.email","private@example.invalid")
    (repo/"한글 파일.txt").write_text("PRIVATE_BODY\n",encoding="utf-8")
    (repo/".env").write_text("PRIVATE_ENV\n",encoding="utf-8")
    git("add",".");git("commit","-m","PRIVATE_MESSAGE")
    (repo/"한글 파일.txt").write_text("COMMITTED_BODY\n",encoding="utf-8")
    git("add",".");git("commit","-m","PRIVATE_SECOND_MESSAGE")
    head=git("rev-parse","HEAD").strip()
    (repo/"pending-only.txt").write_text("PENDING_BODY\n",encoding="utf-8")
    status=git("status","--porcelain=v1","-z")
    index=(repo/".git/index").read_bytes()
    root=Path(__file__).resolve().parents[1]
    pending_raw=run(["bun",str(root/"scripts/worktree-evidence.mjs"),"--repo",str(repo),"--include-paths"])
    commits_raw=run(["bun",str(root/"scripts/commit-evidence.mjs"),"--repo",str(repo),"--include-paths"])
    pending_data=json.loads(pending_raw);commit_data=json.loads(commits_raw)
    assert pending_data["head"]==head==commit_data["head"]
    assert pending_data["files"]==[{"path":"pending-only.txt","indexStatus":"?","worktreeStatus":"?"}]
    assert commit_data["commits"][0]["files"]==[{"path":"한글 파일.txt","status":"M"}]
    assert sum(item["excluded"] for item in commit_data["commits"])==1
    assert (repo/".git/index").read_bytes()==index
    assert git("status","--porcelain=v1","-z")==status
    forbidden=["PRIVATE_AUTHOR","private@example.invalid","PRIVATE_BODY","PRIVATE_ENV",
        "PRIVATE_MESSAGE","PRIVATE_SECOND_MESSAGE","COMMITTED_BODY","PENDING_BODY",str(repo)]
    assert all(secret not in pending_raw+commits_raw for secret in forbidden)
    summary.write_text(json.dumps(basic),encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    for raw in [pending_raw,commits_raw]:
        source.write_text(raw,encoding="utf-8")
        page.locator("#work-files-input").set_input_files(str(source))
        expect(page.locator("#work-files-feedback")).to_contain_text("파일 목록을 열었습니다")
    expect(page.locator("#work-files-list input")).to_have_count(3)
    page.locator(".work-file-row").filter(has_text="pending-only.txt").locator("input").check()
    page.locator(".work-file-row").filter(has_text=head[:12]).locator("input").check()
    page.locator("#work-files-review").check();page.locator("#work-review").check()
    with page.expect_download() as result:page.locator("#work-package").click()
    roundtrip=Path(result.value.path()).read_text(encoding="utf-8")
    exported=json.loads(roundtrip)
    assert exported["format"]=="tokenjuice-work-handoff-v2"
    assert exported["worktree"]["files"]==pending_data["files"]
    assert len(exported["commits"]["commits"])==1
    assert exported["commits"]["commits"][0]==commit_data["commits"][0]
    assert all(secret not in roundtrip for secret in forbidden)
    summary.write_text(roundtrip,encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-files-list input")).to_have_count(2)
    assert page.locator("#work-files-list input:checked").count()==0
    assert not page.locator("#work-files-review").is_checked() and not page.locator("#work-review").is_checked()
    assert page.locator("#work-package").is_disabled()
    assert (repo/".git/index").read_bytes()==index
    assert git("status","--porcelain=v1","-z")==status
    # Clearing while an asynchronous file read is pending must not resurrect data.
    source.write_text(json.dumps(evidence),encoding="utf-8")
    page.evaluate("""() => {const original=File.prototype.text;File.prototype.text=async function(){await new Promise(resolve=>window.releaseFile=resolve);return original.call(this);};} """)
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-open")).to_be_disabled()
    page.locator("#work-clear").click();page.evaluate("window.releaseFile()")
    expect(page.locator("#work-files-open")).to_be_enabled()
    assert page.locator("#work-editor").is_hidden()
    assert page.locator("#work-files-list input").count()==0
    assert page.evaluate("localStorage.length===0 && sessionStorage.length===0")
    assert all(url.startswith("http://127.0.0.1:4173") for url in requests)
    assert not errors,errors
    browser.close()
print("PASS: real isolated Git CLI-to-UI roundtrip, pending/committed selected handoffs, review reset, sensitive-path exclusion, malformed preservation, keyboard, mobile, clear and no upload")
