; Included by electron-builder's NSIS installer (electron-builder.yml, nsis.include).

; The welcome page carries the same statement as the app's "Data and credit" section. Updates run
; the installer silently, so they never show it.
!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !define MUI_WELCOMEPAGE_TEXT "Setup will install $(^NameDA) on this computer.$\r$\n$\r$\nMetis is an independent project. It is not affiliated with or endorsed by the NBA, the WNBA, ESPN or SportsDataverse.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; electron-updater keeps the last installer and downloaded updates in %LOCALAPPDATA%\metis-updater
; (named after package.json's name), about 110 MB, of no use once Metis is gone. An update runs the
; old uninstaller too, and must keep that folder: the next update is built against it.
; %APPDATA%\Metis, the user's data, is left alone (deleteAppDataOnUninstall: false).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; Electron keeps per-user folders even when the program was installed for everyone.
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}
    RMDir /r "$LOCALAPPDATA\metis-updater"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endIf}
!macroend
