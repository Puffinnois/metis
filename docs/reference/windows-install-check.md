# Windows install and update check

This is what T1103 could not run, for T1104 to carry out on a Windows machine. The installer and its updates are not code-signed (the owner's decision of 2026-11-16). Plan T1103 says what the updater checks.

## The test builds

The update check uses two builds made only for it, 0.8.1 and 0.8.2. Their updater reads a local feed at `http://127.0.0.1:8765/` instead of GitHub.

**The first test builds were not separate.** They were built on 2026-11-16 (run 43920126687; do not use them). They changed the app id, product name and package name, but kept `win.executableName: Metis`. electron-builder takes the install folder, the executable and the uninstaller from that setting, so they installed into `%LOCALAPPDATA%\Programs\Metis` and replaced the installed Metis there. Their data folder and updater cache were separate.

**What is proven for the current test builds, and how.** The job that builds them also builds the real installer from the same commit. `scripts/check-installer-identity.mjs` then compares the two before the test builds are kept, and the job fails on any match. It compares three things:

- the makensis defines in electron-builder's debug output, which give the app id, the registry keys, the install folder, the executable, the uninstaller, the shortcut and display names, and the updater cache;
- 7-Zip's listing of each installer and of its embedded `app-64.7z`, which give the uninstaller and executable actually packed;
- the `package.json` inside each `app.asar`, which sets the data folder.

The test folder name also may not contain the real one: the real installer treats any chosen folder whose path holds "Metis" as its own.

Run [43939122396](https://github.com/Puffinnois/metis/actions/runs/43939122396) read these values, the same for 0.8.1 and 0.8.2:

| What                 | Real Metis                                           | Test builds                                          |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| App id               | `com.yhabie.metis`                                   | `com.yhabie.metis-updatetest`                        |
| Install folder       | `%LOCALAPPDATA%\Programs\Metis`                      | `%LOCALAPPDATA%\Programs\UpdateTestBuild`            |
| Executable           | `Metis.exe`                                          | `UpdateTestBuild.exe`                                |
| Uninstaller          | `Uninstall Metis.exe`                                | `Uninstall UpdateTestBuild.exe`                      |
| Install key (HKCU)   | `Software\063baf90-7132-5a86-84e6-4c79db217473`      | `Software\148fcf01-4be5-5de5-9b0e-2cbea1132906`      |
| Uninstall key (HKCU) | `...\Uninstall\063baf90-7132-5a86-84e6-4c79db217473` | `...\Uninstall\148fcf01-4be5-5de5-9b0e-2cbea1132906` |
| Shortcuts, Apps list | Metis                                                | Metis Update Test                                    |
| Data folder          | `%APPDATA%\Metis`                                    | `%APPDATA%\Metis Update Test`                        |
| Updater cache        | `%LOCALAPPDATA%\metis-updater`                       | `%LOCALAPPDATA%\metis-update-test-updater`           |

That is a reading of the built installers, not an install. Two things are shared and do not touch files or keys. The app sets the same Windows taskbar id at run time (`com.yhabie.metis`, in `src/main/index.ts`), so the two can group together on the taskbar. And the test builds show the same owl.

**Getting them.** Run 43939122396 keeps them as the artifact **UpdateTestBuild-isolated** until 2026-11-23. It has two folders: `install` (`UpdateTestBuild-Setup-0.8.1.exe`) and `feed-newer` (`UpdateTestBuild-Setup-0.8.2.exe`, its blockmap and `latest.yml`). With `gh`:

```bash
gh run download 43939122396 -R Puffinnois/metis -n UpdateTestBuild-isolated -D C:\metis-test
```

After 2026-11-23, build them again. They are not in the repository; only the check script is. Cut a throwaway branch `check/<name>` from `main`. In its `.github/workflows/package-check.yml`, keep the steps up to `npm run build`, replace the rest with the steps below, and push. Delete the branch once the run is done.

```yaml
- name: Package the real installer, for comparison
  shell: bash
  env:
    DEBUG: electron-builder
  run: |
    npx electron-builder --win --publish never -c.directories.output=../real > ../real.log 2>&1 || { tail -40 ../real.log; exit 1; }
    7z l ../real/Metis-Setup-*.exe > ../real-listing.txt
    7z e -y -o../real-7z ../real/Metis-Setup-*.exe app-64.7z -r >/dev/null
    7z l ../real-7z/app-64.7z >> ../real-listing.txt

# The test builds' own identity. win.executableName names the install folder, the executable and
# the uninstaller (electron-builder's productFilename), so it must change with the rest, and must
# not contain "Metis": the real installer takes any chosen folder holding that name as its own.
- name: Configure the update test builds
  shell: bash
  run: |
    node -e "
      const yaml = require('js-yaml'); const fs = require('fs');
      const c = yaml.load(fs.readFileSync('electron-builder.yml', 'utf8'));
      c.appId = 'com.yhabie.metis-updatetest';
      c.productName = 'Metis Update Test';
      c.win.executableName = 'UpdateTestBuild';
      c.nsis.artifactName = 'UpdateTestBuild-Setup-\${version}.\${ext}';
      c.nsis.shortcutName = 'Metis Update Test';
      c.nsis.uninstallDisplayName = 'Metis Update Test';
      c.publish = { provider: 'generic', url: 'http://127.0.0.1:8765/' };
      fs.writeFileSync('../update-test-builder.json', JSON.stringify(c, null, 2));
    "
    sed -i 's/metis-updater/metis-update-test-updater/' build/installer.nsh
    npm pkg set name=metis-update-test productName="Metis Update Test"

# Each build goes outside the project folder, which electron-builder packs whole. Each is checked
# against the real installer before it is kept: the job fails on any shared path, key or name.
- name: Package and check the update test builds
  shell: bash
  env:
    DEBUG: electron-builder
  run: |
    for v in 0.8.1 0.8.2; do
      npm pkg set version=$v
      npx electron-builder --win --publish never --config ../update-test-builder.json -c.directories.output=../test-$v > ../test-$v.log 2>&1 || { tail -40 ../test-$v.log; exit 1; }
      7z l ../test-$v/UpdateTestBuild-Setup-$v.exe > ../test-$v-listing.txt
      7z e -y -o../test-$v-7z ../test-$v/UpdateTestBuild-Setup-$v.exe app-64.7z -r >/dev/null
      7z l ../test-$v-7z/app-64.7z >> ../test-$v-listing.txt
      echo "== $v"
      node scripts/check-installer-identity.mjs \
        --real-log ../real.log --test-log ../test-$v.log \
        --real-listing ../real-listing.txt --test-listing ../test-$v-listing.txt \
        --real-asar ../real/win-unpacked/resources/app.asar \
        --test-asar ../test-$v/win-unpacked/resources/app.asar
    done
    mkdir -p update-test/install update-test/feed-newer
    cp ../test-0.8.1/UpdateTestBuild-Setup-0.8.1.exe update-test/install/
    cp ../test-0.8.2/UpdateTestBuild-Setup-0.8.2.exe* ../test-0.8.2/latest.yml update-test/feed-newer/
    ls -l update-test/*

- uses: actions/upload-artifact@v7
  with:
    name: UpdateTestBuild-isolated
    path: update-test
    retention-days: 7
```

Each installer is about 112 MB. One much larger means a build packed an earlier output folder.

## The checklist

Python is needed for the local feed (`python -m http.server`).

0. Close Metis. Copy `%APPDATA%\Metis\metis.db` and `%APPDATA%\Metis\stats.duckdb` somewhere outside `%APPDATA%`, so they can be put back if anything goes wrong.
1. Get the artifact into `C:\metis-test`, with the `gh` command above or from the run's page. Before running anything, check that `install` holds `UpdateTestBuild-Setup-0.8.1.exe`. A `Metis-Update-Test-Setup-*.exe` is one of the first, unsafe builds.
2. Run `install\UpdateTestBuild-Setup-0.8.1.exe`. SmartScreen shows only for a file a browser downloaded, which carries the Mark of the Web; a file downloaded with `gh` does not. If it shows, it says Windows "protected your PC": click **More info**, then **Run anyway**. To see SmartScreen as users will, download `Metis-Setup-*.exe` from the releases page in a browser and open it, then cancel the installer.
3. The installer window and its title bar show the owl. The welcome page reads "Metis is an independent project. It is not affiliated with or endorsed by the NBA, ESPN or SportsDataverse."
4. On the install-mode page, **Only for me** is selected. Keep it and click Next: no admin prompt appears. On the folder page, the folder ends in `\Programs\UpdateTestBuild`; if it ends in `\Programs\Metis`, cancel. On the last page, untick Run and click Finish.
5. The Start menu entry and the desktop shortcut **Metis Update Test** show the owl. Settings > Apps > Installed apps lists **Metis Update Test** 0.8.1 with the owl, and **Metis** still at its own version.
6. In a terminal, run `cd C:\metis-test\feed-newer`, then `python -m http.server 8765 --bind 127.0.0.1`. Leave it running.
7. Open Metis Update Test. Its first load starts, into `%APPDATA%\Metis Update Test`: on the Data screen, click **Pause**.
8. Within a minute the top bar shows **Downloading x%**, then **Update to 0.8.2**. The terminal logs `GET /latest.yml` and the installer.
9. Click the pill. The dialog reads "Update to 0.8.2" and "You're on 0.8.1". Click **Later** and quit. Open it again: Installed apps still says 0.8.1, and the pill comes back. Quitting does not install.
10. Click the pill, then **Update & restart**. The app closes and opens again by itself. Installed apps says 0.8.2. No pill shows, since the feed has nothing newer.
11. Stop the server (Ctrl+C) and reopen the app. No pill and no error dialog appear.
12. Uninstall **Metis Update Test** from Installed apps. Then check: `%LOCALAPPDATA%\Programs\UpdateTestBuild`, both shortcuts and `%LOCALAPPDATA%\metis-update-test-updater` are gone; `%APPDATA%\Metis Update Test` is still there; **Metis**, `%LOCALAPPDATA%\Programs\Metis` and `%APPDATA%\Metis` are untouched. Delete `%APPDATA%\Metis Update Test` and `C:\metis-test` by hand.
13. The real update path, from GitHub. This cannot be run until a release newer than the installed version is published, which for a machine on 0.8.0 means v1.0.0 (T1106). Once it is published, open the installed Metis. Within a minute it shows **Update to 1.0.0**. Click **Update & restart**: it reopens as 1.0.0 with its data. This runs 0.8.0's own updater, which still also installs a downloaded update on quit.

The real uninstaller, checked at T1104's own uninstall if it does one, removes `%LOCALAPPDATA%\metis-updater` and keeps `%APPDATA%\Metis`.
