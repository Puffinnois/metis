# Windows install and update check

What T1103 could not run, for T1104 to carry out on a Windows machine. The installer and its updates are not code-signed (the owner's decision of 2026-11-16). For what the updater checks, see Plan T1103.

## The test builds

The update check uses two builds made only for it, 0.8.1 and 0.8.2. Each has its own app id (`com.yhabie.metis-updatetest`), name ("Metis Update Test"), install folder, data folder (`%APPDATA%\Metis Update Test`) and updater cache (`%LOCALAPPDATA%\metis-update-test-updater`). Their updater reads a local feed at `http://127.0.0.1:8765/` instead of GitHub. They never touch an installed Metis or `%APPDATA%\Metis`.

They are not in the repository. Package check run [43920126687](https://github.com/Puffinnois/metis/actions/runs/43920126687) built them and keeps them as the artifact **Metis-update-test** until 2026-11-23. The artifact has three folders: `install` (the 0.8.1 installer), `feed-newer` (0.8.2's installer, blockmap and `latest.yml`) and `feed-same` (0.8.1's). The same run also keeps the real installer as the artifact **Metis-Setup**.

After 2026-11-23, build them again. Cut a throwaway branch `check/<name>` from `main`. In its `.github/workflows/package-check.yml`, replace the steps after "Keep the unpacked app" with the steps below, then push. The branch never merges; delete it once the run is done. Running the workflow by hand (Run workflow) builds only the unpacked app.

```yaml
- name: Configure the update test builds
  shell: bash
  run: |
    node -e "
      const yaml = require('js-yaml'); const fs = require('fs');
      const c = yaml.load(fs.readFileSync('electron-builder.yml', 'utf8'));
      c.appId = 'com.yhabie.metis-updatetest';
      c.productName = 'Metis Update Test';
      c.nsis.artifactName = 'Metis-Update-Test-Setup-\${version}.\${ext}';
      c.nsis.shortcutName = 'Metis Update Test';
      c.nsis.uninstallDisplayName = 'Metis Update Test';
      c.publish = { provider: 'generic', url: 'http://127.0.0.1:8765/' };
      fs.writeFileSync('update-test-builder.json', JSON.stringify(c, null, 2));
    "
    sed -i 's/metis-updater/metis-update-test-updater/' build/installer.nsh
    npm pkg set name=metis-update-test productName="Metis Update Test"
    # electron-builder packs whatever the project folder holds, so builds go outside it.
    rm -rf dist
- name: Package the update test builds
  shell: bash
  run: |
    npm pkg set version=0.8.1
    npx electron-builder --win --publish never --config update-test-builder.json -c.directories.output=../dist-a
    npm pkg set version=0.8.2
    npx electron-builder --win --publish never --config update-test-builder.json -c.directories.output=../dist-b
    mkdir -p update-test/install update-test/feed-newer update-test/feed-same
    cp ../dist-a/Metis-Update-Test-Setup-0.8.1.exe update-test/install/
    cp ../dist-b/Metis-Update-Test-Setup-0.8.2.exe* ../dist-b/latest.yml update-test/feed-newer/
    cp ../dist-a/Metis-Update-Test-Setup-0.8.1.exe* ../dist-a/latest.yml update-test/feed-same/
- uses: actions/upload-artifact@v7
  with:
    name: Metis-update-test
    path: update-test
    retention-days: 7
```

Each installer is about 112 MB. One much larger means a build packed an earlier output folder.

## The checklist

Python is needed for the local feed (`python -m http.server`).

1. Download the **Metis-update-test** artifact and unzip it to `C:\metis-test`.
2. Run `install\Metis-Update-Test-Setup-0.8.1.exe`. SmartScreen says Windows "protected your PC". Click **More info**, then **Run anyway**.
3. The installer window and its title bar show the owl. The welcome page reads "Metis is an independent project. It is not affiliated with or endorsed by the NBA, ESPN or SportsDataverse."
4. On the install-mode page, **Only for me** is selected. Keep it and click Next: no admin prompt appears. On the last page, untick Run and click Finish.
5. The Start menu entry and desktop shortcut **Metis Update Test** show the owl. Settings > Apps > Installed apps lists **Metis Update Test**, version 0.8.1, with the owl.
6. In a terminal, run `cd C:\metis-test\feed-newer`, then `python -m http.server 8765 --bind 127.0.0.1`. Leave it running.
7. Open Metis Update Test. Its first load starts into its own folder: on the Data screen, click **Pause**.
8. Within a minute, the top bar shows **Downloading x%** and then **Update to 0.8.2**. The terminal logs `GET /latest.yml` and the installer.
9. Click the pill. The dialog reads "Update to 0.8.2" and "You're on 0.8.1". Click **Later** and quit Metis. Open it again: Installed apps still says 0.8.1, and the pill comes back. Quitting does not install.
10. Click the pill, then **Update & restart**. Metis closes and opens again by itself. Installed apps says 0.8.2. No pill shows, since the feed has nothing newer.
11. Stop the server (Ctrl+C) and reopen Metis. No pill and no error dialog appear.
12. Uninstall **Metis Update Test** from Installed apps. Its folder under `%LOCALAPPDATA%\Programs`, both shortcuts and `%LOCALAPPDATA%\metis-update-test-updater` are gone. `%APPDATA%\Metis Update Test` is still there. Delete it and `C:\metis-test` by hand.
13. The real path: open the installed Metis 0.7.0. Within a minute it shows **Update to 0.8.0**, the published release on GitHub. Click **Update & restart**. It reopens as 0.8.0 with its data. This runs 0.7.0's own updater, which still installs on quit.

The test builds' uninstaller removes `metis-update-test-updater`. The real one removes `%LOCALAPPDATA%\metis-updater` and keeps `%APPDATA%\Metis`: check that at T1104's own uninstall, if it does one.
